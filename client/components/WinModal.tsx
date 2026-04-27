import React from 'react';
import { Trophy, ArrowRight, Play, RefreshCw, X } from 'lucide-react';

interface WinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNextLevel: () => void;
  onReplay: () => void;
  onRestart: () => void;
  holeCount: number;
  isDay: boolean;
  userName: string | null;
}

export const WinModal: React.FC<WinModalProps> = ({ 
  isOpen, 
  onClose, 
  onNextLevel, 
  onReplay, 
  onRestart,
  holeCount, 
  isDay,
  userName 
}) => {
  if (!isOpen) return null;

  const isMaxLevel = holeCount >= 10;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-sm transform transition-all duration-500 ease-out animate-in zoom-in slide-in-from-bottom-8 ${isDay ? 'bg-white' : 'bg-stone-900'} rounded-[2.5rem] shadow-2xl overflow-hidden border-4 ${isDay ? 'border-emerald-500' : 'border-emerald-600'}`}>
        
        {/* Victory Header */}
        <div className="h-40 relative overflow-hidden flex flex-col items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-600">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent animate-pulse" />
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/30 mb-2 animate-bounce">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Victory!</h2>
          </div>

          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 text-center space-y-6">
          <div className="space-y-1">
            <p className={`text-xl font-bold ${isDay ? 'text-stone-800' : 'text-stone-100'}`}>
              Excellent Hunt, {userName || 'Fox'}!
            </p>
            <p className={`text-sm font-medium ${isDay ? 'text-stone-500' : 'text-stone-400'}`}>
              You caught the rabbit in {holeCount} holes.
            </p>
          </div>

          <div className="grid gap-3">
            {!isMaxLevel && (
              <button
                onClick={onNextLevel}
                className="group relative w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                Next Level <ArrowRight className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onRestart}
              className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] border-2 ${
                isDay 
                  ? 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100' 
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className="w-4 h-4" /> Play Again
            </button>

            <button
              onClick={onReplay}
              className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                isDay 
                  ? 'text-emerald-600 hover:bg-emerald-50' 
                  : 'text-emerald-400 hover:bg-emerald-900/30'
              }`}
            >
              <Play className="w-4 h-4 fill-current" /> Watch Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
