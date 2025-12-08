import React, { useRef, useEffect } from 'react';
import { HistoryEntry } from '../types';
import { Search, XCircle } from 'lucide-react';

interface LogProps {
  history: HistoryEntry[];
}

export const Log: React.FC<LogProps> = ({ history }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest entry
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="text-center p-4 text-stone-400 text-sm italic border-2 border-dashed border-stone-300 rounded-xl bg-white/50">
        No checks yet. Select a hole to begin the hunt!
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-stone-600 mb-2 px-1 uppercase tracking-wider">Investigation Log</h3>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 p-1 scrollbar-hide scroll-smooth"
        style={{ maxHeight: '200px' }}
      >
        {history.map((entry) => (
          <div 
            key={entry.day} 
            className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-stone-200 text-sm animate-in slide-in-from-bottom-2 fade-in duration-300"
          >
            <div className="flex items-center gap-3">
              <span className="bg-stone-200 text-stone-700 px-2 py-0.5 rounded text-xs font-mono font-bold">
                Day {entry.day}
              </span>
              <span className="flex items-center gap-1 text-stone-700">
                <Search className="w-3 h-3 text-stone-400" />
                Checked Hole <span className="font-bold">{entry.checkedHoleIndex + 1}</span>
              </span>
            </div>
            <div className="flex items-center text-stone-400 text-xs gap-1">
               <span>Empty</span>
               <XCircle className="w-4 h-4 text-stone-300" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
