import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Product, Order, User, UserRole } from './types';
import AdminDashboard from './views/AdminDashboard';

const SUPABASE_URL = 'https://hwkotlfmxuczloonjziz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a290bGZteHVjemxvb25qeml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzE5ODUsImV4cCI6MjA4NDgwNzk4NX0.GUFuxE-xMBy4WawTWbiyCOWr3lcqNF7BoqQ55-UMe3Y';

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

export interface SystemLog {
  id: number;
  timestamp: string;
  type: 'error' | 'success' | 'info' | 'warning';
  module: string;
  message: string;
  details?: any;
}

interface AdminToast {
  id: number;
  message: string;
  orderId?: string;
  type?: 'success' | 'error' | 'info';
  persistent?: boolean;
}

const DEFAULT_ALERT_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const AdminApp: React.FC = () => {
  const recentUpdates = useRef<Record<string, { status: string, time: number }>>({});
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('itx_admin_orders_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    return localStorage.getItem('itx_admin_audio_enabled') === 'true';
  });
  
  const [customSound, setCustomSound] = useState<string | null>(() => {
    return localStorage.getItem('itx_admin_custom_sound');
  });
  
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('itx_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const addLog = useCallback((type: SystemLog['type'], module: string, message: string, details?: any) => {
    const newLog: SystemLog = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      module,
      message,
      details
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
    console.log(`[${module}] ${message}`, details || '');
  }, []);

  const addAdminToast = useCallback((message: string, orderId?: string, type: AdminToast['type'] = 'info', persistent = false) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, orderId, type, persistent }]);
    if (!persistent) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 10000);
    }
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const soundSrc = customSound || DEFAULT_ALERT_URL;
      const audio = new Audio(soundSrc);
      audio.play().catch(e => {
        addLog('warning', 'Audio', 'Playback blocked by browser settings');
      });
    } catch (e) {
      addLog('error', 'Audio', 'Sound engine failure', e);
    }
  }, [audioEnabled, customSound, addLog]);

  const refreshOrders = useCallback(async (isSilent = false) => {
    try {
      const { data, error } = await adminSupabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); 
      
      if (error) throw error;
      if (data) {
        if (!isSilent && rawOrders.length > 0) {
          const currentIds = new Set(rawOrders.map(o => String(o.order_id || o.id)));
          const newOrders = data.filter(o => !currentIds.has(String(o.order_id || o.id)));
          if (newOrders.length > 0) {
            playNotificationSound();
            newOrders.forEach(o => addAdminToast(`New Order: ${o.customer_name}`, o.order_id || String(o.id), 'success'));
          }
        }
        setRawOrders(data);
      }
    } catch (e: any) {
      addLog('error', 'Orders', 'Sync failed', e.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [rawOrders, playNotificationSound, addAdminToast, addLog]);

  const refreshProducts = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setProducts(data.map(p => ({
          id: String(p.id),
          name: p.name || 'Untitled',
          description: p.description || '',
          price: Number(p.price || p.price_pkr || 0),
          image: p.image || p.image_url || '',
          images: typeof p.images === 'string' ? JSON.parse(p.images) : (Array.isArray(p.images) ? p.images : []),
          category: p.category || 'Luxury',
          inventory: Number(p.inventory || 0),
          variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (Array.isArray(p.variants) ? p.variants : []),
          rating: 5,
          reviews: []
        })));
        addLog('success', 'Catalog', `Refreshed ${data.length} items`);
      }
    } catch (e: any) {
      addLog('error', 'Catalog', 'Sync failed', e.message);
    }
  }, [addLog]);

  const initData = useCallback(async () => {
    addLog('info', 'System', 'Initializing secure data sync...');
    await Promise.allSettled([refreshOrders(), refreshProducts()]);
    setLoading(false);
  }, [refreshOrders, refreshProducts, addLog]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      initData();
    } else {
      setLoading(false);
    }
  }, [user, initData]);

  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={
          <AdminDashboard 
            logs={logs}
            orders={rawOrders} // Pass raw orders for mapping in dashboard if needed
            products={products}
            user={user}
            toasts={toasts}
            removeToast={removeToast}
            audioEnabled={audioEnabled}
            customSound={customSound}
            setCustomSound={(base64: string | null) => {
              setCustomSound(base64);
              if (base64) localStorage.setItem('itx_admin_custom_sound', base64);
              else localStorage.removeItem('itx_admin_custom_sound');
            }}
            playTestSound={() => playNotificationSound()}
            enableAudio={() => {
                setAudioEnabled(true);
                localStorage.setItem('itx_admin_audio_enabled', 'true');
                playNotificationSound();
            }}
            disableAudio={() => {
                setAudioEnabled(false);
                localStorage.setItem('itx_admin_audio_enabled', 'false');
            }}
            login={(role: UserRole) => {
              const u: User = { id: 'admin', email: 'admin@itx.com', role, name: 'Store Manager' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
              addLog('success', 'Auth', 'Admin access granted');
            }}
            logout={() => { 
              setUser(null); 
              localStorage.removeItem('itx_user_session');
            }}
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            refreshData={initData}
            uploadMedia={async (file: File) => {
              addLog('info', 'Upload', `Attempting cloud upload: ${file.name} (${Math.round(file.size/1024)}KB)`);
              try {
                const name = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data, error } = await adminSupabase.storage.from('products').upload(name, file);
                
                if (error) {
                  addLog('warning', 'Upload', `Supabase Storage error: ${error.message}. Checking bucket...`, error);
                  throw error;
                }

                const { data: { publicUrl } } = adminSupabase.storage.from('products').getPublicUrl(data.path);
                addLog('success', 'Upload', 'Cloud storage upload successful', publicUrl);
                return publicUrl;
              } catch (e: any) {
                addLog('warning', 'Upload', 'Cloud failure. Falling back to local Base64 encoding.', e.message);
                return new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64 = reader.result as string;
                    if (base64.length > 2000000) {
                      addAdminToast("Warning: Image is very large. May fail database save.", undefined, 'error', true);
                    }
                    resolve(base64);
                  };
                  reader.readAsDataURL(file);
                });
              }
            }}
            saveProduct={async (p: any) => {
              // Fix: Changed undefined setIsLoading to setLoading and ensuring it is reset in finally block
              setLoading(true);
              addLog('info', 'Database', 'Publishing item update...');
              try {
                const productImages = Array.isArray(p.images) ? p.images : [];
                const primaryImage = p.image || productImages[0] || '';

                const payload = { 
                  name: p.name, 
                  description: p.description, 
                  price: Number(p.price),
                  price_pkr: Number(p.price), 
                  image: primaryImage,
                  image_url: primaryImage, 
                  images: JSON.stringify(productImages), 
                  category: p.category, 
                  inventory: Number(p.inventory), 
                  variants: JSON.stringify(Array.isArray(p.variants) ? p.variants : []),
                  updated_at: new Date().toISOString()
                };

                let result;
                if (p.id && p.id !== 'undefined' && p.id !== '') {
                  result = await adminSupabase.from('products').update(payload).eq('id', p.id);
                } else {
                  result = await adminSupabase.from('products').insert([payload]);
                }

                if (result.error) throw result.error;
                
                addLog('success', 'Database', 'Publish successful');
                await refreshProducts();
                addAdminToast("Product Published", undefined, 'success');
                return true;
              } catch (e: any) {
                addLog('error', 'Database', `Save failed: ${e.message}`, e);
                addAdminToast(`Save Error: ${e.message}`, undefined, 'error', true);
                return false;
              } finally {
                setLoading(false);
              }
            }}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;