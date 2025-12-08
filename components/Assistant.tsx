import React, { useState } from 'react';
import { HistoryEntry } from '../types';
import { getGameHint } from '../services/geminiService';
import { Lightbulb, Loader2, Bot } from 'lucide-react';

interface AssistantProps {
  history: HistoryEntry[];
  holeCount: number;
}

export const Assistant: React.FC<AssistantProps> = ({ history, holeCount }) => {
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleAsk = async () => {
    if (loading) return;
    setIsOpen(true);
    setLoading(true);
    setHint(null);
    try {
      const response = await getGameHint(history, holeCount);
      setHint(response);
    } catch (e) {
      setHint("Failed to get a hint. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {!isOpen ? (
        <button
          onClick={handleAsk}
          className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium border border-indigo-200 shadow-sm"
        >
          <Lightbulb className="w-5 h-5" />
          Ask the Wise Owl (Hint)
        </button>
      ) : (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm relative animate-in fade-in zoom-in-95 duration-200">
           <button 
             onClick={() => setIsOpen(false)}
             className="absolute top-2 right-2 text-indigo-300 hover:text-indigo-500 p-1"
           >
             ✕
           </button>
           
           <div className="flex items-start gap-3">
             <div className="bg-indigo-200 p-2 rounded-full shrink-0">
               <Bot className="w-6 h-6 text-indigo-700" />
             </div>
             <div className="flex-1">
               <h4 className="font-semibold text-indigo-900 text-sm mb-1">Wise Owl says:</h4>
               {loading ? (
                 <div className="flex items-center gap-2 text-indigo-500 text-sm py-2">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   Analyzing rabbit tracks...
                 </div>
               ) : (
                 <p className="text-indigo-800 text-sm leading-relaxed whitespace-pre-wrap">
                   {hint}
                 </p>
               )}
             </div>
           </div>
           
           {!loading && (
             <button 
                onClick={handleAsk}
                className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 underline ml-11"
             >
               Ask again
             </button>
           )}
        </div>
      )}
    </div>
  );
};
