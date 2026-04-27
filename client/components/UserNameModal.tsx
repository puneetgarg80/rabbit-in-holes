import React, { useState } from 'react';
import { User, ArrowRight, Sparkles } from 'lucide-react';

interface UserNameModalProps {
  onComplete: (name: string) => void;
  isDay: boolean;
}

export const UserNameModal: React.FC<UserNameModalProps> = ({ onComplete, isDay }) => {
  const [name, setName] = useState('');
  const [isEntering, setIsEntering] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setIsEntering(false);
      setTimeout(() => onComplete(name.trim()), 500);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${isEntering ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`w-full max-w-md transform transition-all duration-500 ease-out ${isEntering ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'} ${isDay ? 'bg-white' : 'bg-stone-900'} rounded-[2.5rem] shadow-2xl overflow-hidden border ${isDay ? 'border-stone-200' : 'border-stone-800'}`}>
        
        {/* Decorative Header */}
        <div className={`h-32 relative overflow-hidden flex items-center justify-center ${isDay ? 'bg-gradient-to-br from-sky-400 to-indigo-500' : 'bg-gradient-to-br from-orange-600 to-rose-700'}`}>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-24 h-24 bg-white/30 rounded-full -translate-x-12 -translate-y-12 blur-2xl" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-900/30 rounded-full translate-x-16 translate-y-16 blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl mb-2 ${isDay ? 'bg-white/20 backdrop-blur-md border border-white/30' : 'bg-black/20 backdrop-blur-md border border-white/10'}`}>
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome, Hunter!</h2>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <p className={`text-lg font-medium ${isDay ? 'text-stone-800' : 'text-stone-200'}`}>
              What should we call you?
            </p>
            <p className={`text-sm ${isDay ? 'text-stone-500' : 'text-stone-400'}`}>
              Every great rabbit hunter needs a legendary name.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                className={`w-full px-6 py-4 rounded-2xl text-lg font-medium transition-all outline-none border-2 ${
                  isDay 
                    ? 'bg-stone-50 border-stone-200 focus:border-sky-500 text-stone-800 placeholder:text-stone-400' 
                    : 'bg-stone-800/50 border-stone-700 focus:border-orange-500 text-stone-100 placeholder:text-stone-600'
                }`}
                maxLength={20}
              />
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center transition-opacity duration-300 ${name.trim() ? 'opacity-100' : 'opacity-0'}`}>
                <Sparkles className={`w-5 h-5 ${isDay ? 'text-sky-500' : 'text-orange-500'}`} />
              </div>
            </div>

            <button
              disabled={!name.trim()}
              type="submit"
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale shadow-lg ${
                isDay 
                  ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/25'
              }`}
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <p className={`text-center text-xs ${isDay ? 'text-stone-400' : 'text-stone-500'}`}>
            Your name will be saved locally for future hunts.
          </p>
        </div>
      </div>
    </div>
  );
};
