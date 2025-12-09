
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
      <div className="text-center p-8 text-stone-600 text-sm italic flex flex-col items-center justify-center h-full opacity-60">
        <Search className="w-12 h-12 mb-3 text-stone-700" />
        <p className="font-medium">No clues yet</p>
        <p className="text-xs mt-1 text-stone-500">Inspect a hole to start the investigation</p>
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
              ${entry.found ? 'bg-emerald-950/30 border-emerald-900' : 'bg-stone-800 border-stone-700'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${entry.found ? 'bg-emerald-900 text-emerald-300' : 'bg-stone-700 text-stone-400'}`}>
                Day {entry.day}
              </span>
              <span className="flex items-center gap-1.5 text-stone-300 font-medium">
                Hole <span className="text-base font-bold text-stone-100">{entry.checkedHoleIndex + 1}</span>
              </span>
            </div>

            {entry.found ? (
              <div className="flex items-center text-emerald-400 text-xs font-bold gap-1 bg-emerald-900/50 px-2 py-1 rounded-md border border-emerald-800">
                <span>FOUND</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="flex items-center text-stone-400 text-xs gap-1.5 bg-stone-900/50 px-2 py-1 rounded-md border border-stone-800">
                <span className="font-mono font-bold text-stone-300">{entry.remainingPossibilitiesCount}</span>
                <span>Possible</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
