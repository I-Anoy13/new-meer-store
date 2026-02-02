
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Product } from '../types';

interface AIConciergeProps {
  products: Product[];
}

const AIConcierge: React.FC<AIConciergeProps> = ({ products }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: "Welcome to the ITX Vault. I am your personal horologist. How may I assist you in selecting your next masterpiece today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const productContext = products.map(p => 
        `Name: ${p.name}, Category: ${p.category}, Price: Rs. ${p.price}, Description: ${p.description}`
      ).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }]
          }
        ],
        config: {
          systemInstruction: `You are the ITX AI Concierge, a master horologist and luxury sales expert for "ITX SHOP MEER". 
          Your tone is sophisticated, professional, and slightly poetic, fitting for high-end watches.
          
          Context of available products:
          ${productContext}

          Rules:
          1. Only recommend products from the provided list.
          2. Focus on craftsmanship, engineering, and style suitability (e.g., formal, professional, adventurous).
          3. Mention prices in PKR (Rs.).
          4. Always refer to the customer as "Guest" or "Sir/Madam" with high respect.
          5. Keep responses concise but impactful.`
        }
      });

      const aiResponse = response.text || "I apologize, my connection to the vault is momentarily disrupted. How else can I help?";
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'ai', text: "The vault's security protocols are currently high. Please browse our collection while I re-establish connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[350px] md:w-[400px] h-[500px] bg-white rounded-[2rem] shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-fadeIn">
          <div className="bg-black p-6 flex justify-between items-center">
            <div>
              <h3 className="text-white font-serif italic text-lg leading-tight uppercase">ITX AI Concierge</h3>
              <p className="text-blue-400 text-[9px] font-black uppercase tracking-widest mt-1">Master Horologist Active</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar bg-gray-50/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-700 shadow-sm rounded-tl-none font-medium italic'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-100">
            <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-4 py-2 border border-gray-100">
              <input 
                type="text" 
                placeholder="Ask your concierge..." 
                className="flex-grow bg-transparent border-none outline-none text-xs py-2 font-medium text-black"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} className="text-blue-600 hover:text-black transition">
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transform transition-all duration-500 hover:scale-110 active:scale-95 ${isOpen ? 'bg-red-500' : 'bg-black'}`}
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-robot'} text-xl`}></i>
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600"></span>
          </span>
        )}
      </button>

      {/* WhatsApp Quick Link (Bottom Left of Floating Area) */}
      <a 
        href="https://wa.me/923XXXXXXXXX" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 w-14 h-14 bg-green-500 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-green-600 transition-all hover:scale-110 active:scale-95"
      >
        <i className="fab fa-whatsapp text-2xl"></i>
      </a>
    </div>
  );
};

export default AIConcierge;
