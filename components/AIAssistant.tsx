import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, ChatMessage, LLMProvider, SketchModule } from '../types';
import { UI_TEXT } from '../constants';
import { chatWithAssistant } from '../services/aiService';
import ScreenshotOverlay from './ScreenshotOverlay';

interface AIAssistantProps {
  settings: AppSettings;
  modules: SketchModule[]; // New prop: Current Canvas State
  onCommand: (toolCalls: any[]) => void; // New prop: Handler for AI commands
}

const AIAssistant: React.FC<AIAssistantProps> = ({ settings, modules, onCommand }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // Base64
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = UI_TEXT[settings.language];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'model',
        content: t.chatWelcome,
        timestamp: Date.now()
      }]);
    }
  }, [t.chatWelcome]);

  const handleSendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      image: selectedImage || undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      // Clean image string for API (remove prefix)
      const imagePayload = userMsg.image ? userMsg.image.split(',')[1] : undefined;

      // Call AI Service with Modules Context and Settings (which contains API Key)
      const { text, functionCalls } = await chatWithAssistant(history, userMsg.content, modules, imagePayload, settings);

      let responseText = text;

      // Handle Function Calls
      if (functionCalls && functionCalls.length > 0) {
          console.log("[AI Assistant] Received Tool Calls:", functionCalls);
          onCommand(functionCalls);
          
          if (!responseText) {
             responseText = "I've updated the dashboard layout for you.";
          }
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText || "Done.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          content: "Sorry, I had trouble processing that request.",
          timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartScreenshot = () => {
    setIsOpen(false); // Hide the chat window
    setIsScreenshotMode(true); // Show the overlay
  };

  const handleCaptureComplete = (base64Image: string) => {
    setSelectedImage(`data:image/png;base64,${base64Image}`);
    setIsScreenshotMode(false);
    setIsOpen(true); // Re-open chat
  };

  return (
    <>
      {/* Screenshot Overlay */}
      {isScreenshotMode && (
        <ScreenshotOverlay 
            settings={settings}
            onCapture={handleCaptureComplete}
            onClose={() => {
                setIsScreenshotMode(false);
                setIsOpen(true);
            }}
        />
      )}

      <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none ${isScreenshotMode ? 'hidden' : ''}`}>
        
        {/* Chat Window */}
        {isOpen && (
          <div className="bg-white w-80 sm:w-96 h-[500px] rounded-2xl shadow-2xl border border-gray-200 mb-4 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
              <div className="flex items-center space-x-2">
                 <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                 <h3 className="font-semibold text-sm">{t.aiAssistant}</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'
                  }`}>
                    {msg.image && (
                      <img src={msg.image} alt="User upload" className="mb-2 rounded-lg max-h-32 object-cover border border-white/20" />
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                   <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                      <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-100"></div>
                          <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-200"></div>
                      </div>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-gray-100">
               {selectedImage && (
                  <div className="flex items-center bg-gray-100 p-2 rounded-lg mb-2">
                      <span className="text-xs text-gray-500 truncate flex-1">Image attached</span>
                      <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                      </button>
                  </div>
               )}
              <div className="flex items-center space-x-2">
                  <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                  />
                  {/* Screenshot Button */}
                  <button
                      onClick={handleStartScreenshot}
                      className="p-2 text-gray-400 hover:text-blue-500 transition hover:bg-blue-50 rounded-full"
                      title={t.screenshot}
                  >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                  </button>

                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-blue-500 transition hover:bg-blue-50 rounded-full"
                  >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                  </button>
                  <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={t.typeMessage}
                      className="flex-1 bg-gray-50 border-0 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  <button 
                      onClick={handleSendMessage}
                      disabled={(!input && !selectedImage) || isLoading}
                      className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center group"
        >
          <svg className="w-8 h-8 group-hover:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <svg className="w-8 h-8 hidden group-hover:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default AIAssistant;