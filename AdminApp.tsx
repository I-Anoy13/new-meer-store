
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
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(() => localStorage.getItem('itx_admin_audio_enabled') === 'true');
  const [customSound, setCustomSound] = useState<string | null>(() => localStorage.getItem('itx_admin_custom_sound'));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('itx_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const addLog = useCallback((type: SystemLog['type'], module: string, message: string, details?: any) => {
    const newLog: SystemLog = { id: Date.now(), timestamp: new Date().toLocaleTimeString(), type, module, message, details };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  const addAdminToast = useCallback((message: string, orderId?: string, type: AdminToast['type'] = 'info', persistent = false) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, orderId, type, persistent }]);
    if (!persistent) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 10000);
  }, []);

  const compressImage = (file: File): Promise<Blob | File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve(blob || file);
          }, 'image/jpeg', 0.8);
        };
      };
    });
  };

  const refreshProducts = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProducts((data || []).map(p => ({
        id: String(p.id),
        name: p.name || 'Untitled',
        description: p.description || '',
        price: Number(p.price || p.price_pkr || 0),
        image: p.image || p.image_url || '',
        images: typeof p.images === 'string' ? JSON.parse(p.images) : (Array.isArray(p.images) ? p.images : []),
        category: p.category || 'Luxury',
        inventory: Number(p.inventory || 0),
        variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (Array.isArray(p.variants) ? p.variants : []),
        rating: 5, reviews: []
      })));
    } catch (e: any) {
      addLog('error', 'Catalog', 'Sync failed', e.message);
    }
  }, [addLog]);

  const initData = useCallback(async () => {
    setIsSyncing(true);
    const { data: oData } = await adminSupabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
    if (oData) setRawOrders(oData);
    await refreshProducts();
    setLoading(false);
    setIsSyncing(false);
  }, [refreshProducts]);

  useEffect(() => { if (user?.role === UserRole.ADMIN) initData(); else setLoading(false); }, [user, initData]);

  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={
          <AdminDashboard 
            logs={logs}
            orders={rawOrders}
            products={products}
            user={user}
            toasts={toasts}
            isSyncing={isSyncing}
            removeToast={(id: number) => setToasts(p => p.filter(t => t.id !== id))}
            audioEnabled={audioEnabled}
            setCustomSound={(base64: string | null) => {
              setCustomSound(base64);
              if (base64) localStorage.setItem('itx_admin_custom_sound', base64);
              else localStorage.removeItem('itx_admin_custom_sound');
            }}
            enableAudio={() => { setAudioEnabled(true); localStorage.setItem('itx_admin_audio_enabled', 'true'); }}
            disableAudio={() => { setAudioEnabled(false); localStorage.setItem('itx_admin_audio_enabled', 'false'); }}
            login={(role: UserRole) => {
              const u: User = { id: 'admin', email: 'admin@itx.com', role, name: 'Store Manager' };
              setUser(u);
              localStorage.setItem('itx_user_session', JSON.stringify(u));
            }}
            logout={() => { setUser(null); localStorage.removeItem('itx_user_session'); }}
            systemPassword={localStorage.getItem('systemPassword') || 'admin123'}
            refreshData={initData}
            uploadMedia={async (file: File) => {
              addLog('info', 'Upload', `Processing: ${file.name}`);
              const compressed = await compressImage(file);
              try {
                const name = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data, error } = await adminSupabase.storage.from('products').upload(name, compressed);
                if (error) throw error;
                const { data: { publicUrl } } = adminSupabase.storage.from('products').getPublicUrl(data.path);
                addLog('success', 'Upload', 'Cloud upload OK');
                return publicUrl;
              } catch (e: any) {
                addLog('warning', 'Upload', 'Using local encoding fallback');
                return new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(compressed);
                });
              }
            }}
            saveProduct={async (p: any) => {
              setIsSyncing(true);
              try {
                const productImages = Array.isArray(p.images) ? p.images : [];
                const payload = { 
                  name: p.name, description: p.description, price: Number(p.price),
                  price_pkr: Number(p.price), image: p.image || productImages[0] || '',
                  images: JSON.stringify(productImages), category: p.category, 
                  inventory: Number(p.inventory), variants: JSON.stringify(p.variants || [])
                };
                const result = p.id ? await adminSupabase.from('products').update(payload).eq('id', p.id) : await adminSupabase.from('products').insert([payload]);
                if (result.error) throw result.error;
                await refreshProducts();
                addAdminToast("Product Published", undefined, 'success');
                return true;
              } catch (e: any) {
                addLog('error', 'Database', e.message);
                addAdminToast(`Save Error: ${e.message}`, undefined, 'error', true);
                return false;
              } finally { setIsSyncing(false); }
            }}
          />
        } />
      </Routes>
    </HashRouter>
  );
};

export default AdminApp;
