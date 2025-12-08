
import React, { useRef, useEffect } from 'react';
import { HistoryEntry } from '../types';
import { Search, HelpCircle, CheckCircle2 } from 'lucide-react';

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
      <div className="text-center p-8 text-stone-400 text-sm italic flex flex-col items-center justify-center h-full opacity-60">
        <Search className="w-12 h-12 mb-3 text-stone-300" />
        <p className="font-medium">No clues yet</p>
        <p className="text-xs mt-1">Inspect a hole to start the investigation</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 p-1 scrollbar-hide scroll-smooth min-h-0"
      >
        {history.map((entry) => (
          <div 
            key={entry.day} 
            className={`flex items-center justify-between p-3 rounded-xl shadow-sm border text-sm animate-in slide-in-from-bottom-2 fade-in duration-300
              ${entry.found ? 'bg-green-50 border-green-200' : 'bg-white border-stone-200'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${entry.found ? 'bg-green-200 text-green-800' : 'bg-stone-100 text-stone-600'}`}>
                Day {entry.day}
              </span>
              <span className="flex items-center gap-1.5 text-stone-700 font-medium">
                Hole <span className="text-base font-bold">{entry.checkedHoleIndex + 1}</span>
              </span>
            </div>
            
            {entry.found ? (
              <div className="flex items-center text-green-700 text-xs font-bold gap-1 bg-green-100 px-2 py-1 rounded-md">
                 <span>FOUND</span>
                 <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="flex items-center text-stone-500 text-xs gap-1.5 bg-stone-50 px-2 py-1 rounded-md border border-stone-100">
                 <span className="font-mono font-bold">{entry.remainingPossibilitiesCount}</span>
                 <span>Possible</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
