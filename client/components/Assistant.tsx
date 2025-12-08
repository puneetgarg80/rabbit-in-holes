import React, { useState, useEffect } from 'react';
import { HistoryEntry } from '../types';
import { getGameHint } from '../services/geminiService';
import { Lightbulb, Loader2, Bot, Sparkles, RefreshCcw } from 'lucide-react';

interface AssistantProps {
  history: HistoryEntry[];
  holeCount: number;
}

export const Assistant: React.FC<AssistantProps> = ({ history, holeCount }) => {
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleAsk = async () => {
    if (loading) return;
    setLoading(true);
    setHint(null);
    try {
      const response = await getGameHint(history, holeCount);
      setHint(response);
    } catch (e) {
      setHint("The Wise Owl is having trouble seeing through the fog. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset hint when game resets (day 1, empty history)
  useEffect(() => {
    if (history.length === 0) {
        setHint(null);
    }
  }, [history.length]);

  return (
    <div className="w-full flex flex-col h-full">
      {/* Empty State / Intro */}
      {!hint && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="bg-indigo-100 p-4 rounded-full mb-4 ring-8 ring-indigo-50">
                  <Bot className="w-10 h-10 text-indigo-600" />
              </div>
              <h4 className="text-lg font-bold text-indigo-950 mb-2">Need a clue?</h4>
              <p className="text-sm text-indigo-900/60 mb-6 max-w-xs leading-relaxed">
                  The Wise Owl can analyze the quantum tracks of the mouse and suggest your next optimal move.
              </p>
              <button
                onClick={handleAsk}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                  <Sparkles className="w-5 h-5" />
                  Ask Wise Owl
              </button>
          </div>
      )}

      {/* Loading State */}
      {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-indigo-600">
              <Loader2 className="w-10 h-10 animate-spin mb-4 opacity-50" />
              <p className="text-sm font-medium tracking-wide uppercase animate-pulse">Analyzing Probabilities...</p>
          </div>
      )}

      {/* Hint Result */}
      {hint && !loading && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm relative flex-1 overflow-y-auto mb-4">
                 <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 p-2 rounded-lg shrink-0">
                        <Bot className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1 space-y-2">
                        <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-wider">Analysis</h4>
                        <p className="text-indigo-900 text-base leading-relaxed whitespace-pre-wrap font-medium">
                            {hint}
                        </p>
                    </div>
                 </div>
              </div>
              
              <button 
                onClick={handleAsk}
                className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-3 rounded-xl transition-colors"
              >
                <RefreshCcw className="w-3 h-3" />
                Regenerate Hint
              </button>
          </div>
      )}
    </div>
  );
};