import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AIConcierge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Welcome to ITX SHOP MEER. I am your personal horology consultant. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Initialize Gemini API client as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: newMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: "You are a luxury watch expert and concierge for 'ITX SHOP MEER', a premium watch store in Pakistan. You are sophisticated, knowledgeable about horology (especially brands like Audemars Piguet, Patek Philippe, and minimalist styles), and helpful. Provide concise, expert advice. Mention that we offer Cash on Delivery across Pakistan and a 7-day return policy. Focus on the available categories: Luxury Artisan, Minimalist / Heritage, and Professional Series.",
          temperature: 0.7,
        },
      });

      // Directly access .text property as per guidelines
      const modelResponse = response.text || "I apologize, I'm having trouble connecting to my knowledge base. Please try again or contact support.";
      setMessages(prev => [...prev, { role: 'model', text: modelResponse }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I encountered an error. Please check your connection and try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-600 transition-all active:scale-95"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-comment-dots'} text-xl`}></i>
      </button>

      {/* Concierge Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] w-[90vw] md:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-fadeIn">
          <div className="bg-black p-5 flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <i className="fas fa-crown text-white text-xs"></i>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic">ITX CONCIERGE</p>
              <h3 className="text-white text-xs font-bold uppercase tracking-tight">AI Horology Consultant</h3>
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-grow h-80 overflow-y-auto p-5 space-y-4 bg-gray-50/50 custom-scrollbar"
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white font-medium rounded-tr-none' 
                    : 'bg-white border border-gray-100 text-gray-800 font-medium shadow-sm rounded-tl-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex items-center space-x-3">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about watches..."
              className="flex-grow bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-medium outline-none focus:border-blue-600 transition"
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center hover:bg-blue-600 disabled:opacity-30 transition"
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIConcierge;