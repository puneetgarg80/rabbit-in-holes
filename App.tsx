import React, { useState, useCallback } from 'react';
import { Hole } from './components/Hole';
import { Log } from './components/Log';
import { Assistant } from './components/Assistant';
import { GameState, GameStatus, HistoryEntry } from './types';
import { RefreshCw, Trophy, Info, Minus, Plus, X, Play, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const initialHoleCount = 5;
  const initialRabbitPos = Math.floor(Math.random() * initialHoleCount);

  const [gameState, setGameState] = useState<GameState>({
    holeCount: initialHoleCount,
    rabbitIndex: initialRabbitPos,
    day: 1,
    history: [],
    status: GameStatus.PLAYING,
    lastCheckedIndex: null,
    rabbitPath: [initialRabbitPos],
  });

  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  // --- Game Logic ---

  const handleCheckHole = useCallback(async () => {
    if (selectedHole === null || gameState.status !== GameStatus.PLAYING || isProcessing) return;

    setIsProcessing(true);

    // 1. Check if rabbit is found
    const found = gameState.rabbitIndex === selectedHole;
    
    // Create history entry
    const newEntry: HistoryEntry = {
      day: gameState.day,
      checkedHoleIndex: selectedHole,
      found,
    };

    if (found) {
      setGameState(prev => ({
        ...prev,
        history: [...prev.history, newEntry],
        status: GameStatus.WON,
        lastCheckedIndex: selectedHole
      }));
      setIsProcessing(false);
      return;
    }

    // 2. Rabbit Moves
    // Delay slightly for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 600));

    setGameState(prev => {
      const currentRabbitPos = prev.rabbitIndex;
      let nextRabbitPos;

      // Logic: Move adjacent
      if (currentRabbitPos === 0) {
        nextRabbitPos = 1;
      } else if (currentRabbitPos === prev.holeCount - 1) {
        nextRabbitPos = prev.holeCount - 2;
      } else {
        // Random left or right
        nextRabbitPos = Math.random() > 0.5 ? currentRabbitPos + 1 : currentRabbitPos - 1;
      }

      return {
        ...prev,
        rabbitIndex: nextRabbitPos,
        day: prev.day + 1,
        history: [...prev.history, newEntry],
        lastCheckedIndex: selectedHole,
        rabbitPath: [...prev.rabbitPath, nextRabbitPos]
      };
    });

    setSelectedHole(null);
    setIsProcessing(false);
  }, [selectedHole, gameState.rabbitIndex, gameState.status, gameState.day, isProcessing]);

  const resetGame = (newHoleCount: number = gameState.holeCount) => {
    const startPos = Math.floor(Math.random() * newHoleCount);
    setGameState({
      holeCount: newHoleCount,
      rabbitIndex: startPos,
      day: 1,
      history: [],
      status: GameStatus.PLAYING,
      lastCheckedIndex: null,
      rabbitPath: [startPos],
    });
    setSelectedHole(null);
    setReplayIndex(null);
  };

  const changeHoleCount = (delta: number) => {
    const newCount = Math.min(10, Math.max(3, gameState.holeCount + delta));
    if (newCount !== gameState.holeCount) {
        resetGame(newCount);
    }
  };

  // --- Replay Logic ---
  const startReplay = () => setReplayIndex(0);
  const nextReplayDay = () => setReplayIndex(prev => (prev !== null && prev < gameState.history.length - 1 ? prev + 1 : prev));
  const prevReplayDay = () => setReplayIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
  const endReplay = () => setReplayIndex(gameState.history.length - 1);
  const closeReplay = () => setReplayIndex(null);

  // Determine what to display
  const isReplayMode = replayIndex !== null && gameState.status === GameStatus.WON;
  
  // If playing, we don't show rabbit (unless debug/won). 
  // If won and NOT replaying, we show final state (rabbit caught).
  // If replaying, we show the state at replayIndex.
  
  const displayDayIndex = isReplayMode 
    ? replayIndex 
    : (gameState.status === GameStatus.WON ? gameState.history.length - 1 : gameState.day - 1);

  // Safe checks for arrays
  const displayRabbitPos = isReplayMode 
    ? gameState.rabbitPath[displayDayIndex]
    : (gameState.status === GameStatus.WON ? gameState.rabbitIndex : -1); // -1 means hidden

  const displayCheckedPos = isReplayMode
    ? gameState.history[displayDayIndex]?.checkedHoleIndex
    : gameState.lastCheckedIndex;

  const displayDayNumber = isReplayMode 
    ? gameState.history[displayDayIndex]?.day 
    : gameState.day;

  // --- Render ---

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 flex flex-col items-center">
      
      {/* Header */}
      <header className="w-full bg-white border-b border-stone-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-800 tracking-tight">Fox & Rabbit</h1>
            <p className="text-xs text-stone-500 font-medium">
              {isReplayMode ? (
                <span className="text-amber-600 font-bold">Replay: Day {displayDayNumber}</span>
              ) : (
                <>Day {gameState.day} • {gameState.status === GameStatus.WON ? 'Success' : 'Hunting'}</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowRules(true)}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
              aria-label="Rules"
            >
              <Info className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold text-stone-800">How to Play</h3>
               <button onClick={() => setShowRules(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5"/></button>
             </div>
             <ul className="text-sm text-stone-600 space-y-2 list-disc pl-5">
               <li>There are {gameState.holeCount} holes. A rabbit hides in one.</li>
               <li>Each morning, you inspect <strong>one</strong> hole.</li>
               <li>If the rabbit is there, you win!</li>
               <li>If not, the rabbit moves to an <strong>adjacent</strong> hole (left or right) for the next day.</li>
               <li>Use logic to trap the rabbit!</li>
             </ul>
             <button 
               onClick={() => setShowRules(false)}
               className="w-full py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-700"
             >
               Got it
             </button>
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-md p-4 flex flex-col gap-6 overflow-hidden">
        
        {/* Controls Bar */}
        <div className="flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-4 bg-white px-4 py-3 rounded-2xl shadow-sm border border-stone-200">
               <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Holes</span>
               <div className="flex items-center gap-3">
                   <button 
                       onClick={() => changeHoleCount(-1)} 
                       disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode}
                       className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg text-stone-600 hover:bg-stone-200 disabled:opacity-50 transition-colors active:scale-95"
                       aria-label="Decrease holes"
                   >
                       <Minus className="w-4 h-4" />
                   </button>
                   <span className="font-mono font-bold text-xl text-stone-800 w-5 text-center">{gameState.holeCount}</span>
                   <button 
                       onClick={() => changeHoleCount(1)} 
                       disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode}
                       className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg text-stone-600 hover:bg-stone-200 disabled:opacity-50 transition-colors active:scale-95"
                       aria-label="Increase holes"
                   >
                       <Plus className="w-4 h-4" />
                   </button>
               </div>
           </div>

           <button 
               onClick={() => resetGame()} 
               disabled={isProcessing}
               className="p-3 bg-white text-stone-500 hover:text-stone-800 rounded-2xl shadow-sm border border-stone-200 transition-colors active:scale-95 disabled:opacity-50"
               title="Restart Game"
           >
               <RefreshCw className="w-6 h-6" />
           </button>
        </div>

        {/* The Holes (Board) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
           {/* Scrollable Container for Holes */}
           <div className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
             <div className="inline-flex items-center justify-center gap-4 relative min-w-full py-2">
               {/* Connector Line (Visual only) */}
               <div className="absolute top-1/2 left-2 right-2 h-1 bg-stone-200 -z-10 -translate-y-1/2 rounded-full" />
               
               {Array.from({ length: gameState.holeCount }).map((_, i) => {
                 // Determine props for this hole based on display mode
                 const isChecked = displayCheckedPos === i;
                 const isRabbit = displayRabbitPos === i; // Only true in Replay or Won state
                 const isSelected = (!isReplayMode && selectedHole === i) || (isReplayMode && displayCheckedPos === i);
                 
                 return (
                   <div key={i} className="flex-shrink-0">
                     <Hole 
                       index={i}
                       isSelected={isSelected}
                       isChecked={isChecked} 
                       isRabbit={isRabbit}
                       gameStatus={gameState.status}
                       onSelect={setSelectedHole}
                       disabled={gameState.status !== GameStatus.PLAYING || isProcessing || isReplayMode}
                     />
                   </div>
                 );
               })}
             </div>
           </div>

           {/* Feedback Text */}
           <div className="text-center mt-2 h-8">
             {gameState.status === GameStatus.WON ? (
                isReplayMode ? (
                  <span className="text-amber-600 font-medium animate-in fade-in">
                    Day {displayDayNumber}: Rabbit was at Hole {displayRabbitPos + 1}
                  </span>
                ) : (
                  <span className="text-green-600 font-bold flex items-center justify-center gap-2 animate-bounce">
                    <Trophy className="w-5 h-5" /> Gotcha! The rabbit was caught!
                  </span>
                )
             ) : selectedHole !== null ? (
               <span className="text-stone-500 font-medium animate-pulse">
                 Ready to check Hole {selectedHole + 1}?
               </span>
             ) : (
               <span className="text-stone-400 text-sm">Select a hole to inspect</span>
             )}
           </div>
        </div>

        {/* Action Button / Replay Controls */}
        {gameState.status === GameStatus.PLAYING ? (
          <button
            onClick={handleCheckHole}
            disabled={selectedHole === null || isProcessing}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95 flex-shrink-0
              ${selectedHole !== null && !isProcessing
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30' 
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'}
            `}
          >
            {isProcessing ? 'Checking...' : 'Check Hole'}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
             {/* Replay Controls - Only visible if Won */}
             {gameState.status === GameStatus.WON && (
               <div className="w-full bg-stone-800 text-white rounded-xl p-2 flex items-center justify-between shadow-lg">
                 {!isReplayMode ? (
                    <button 
                      onClick={startReplay}
                      className="w-full flex items-center justify-center gap-2 py-2 font-medium hover:bg-stone-700 rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4" /> Watch Replay
                    </button>
                 ) : (
                    <div className="flex w-full items-center justify-between px-2">
                       <div className="flex gap-1">
                         <button onClick={startReplay} disabled={replayIndex === 0} className="p-2 hover:bg-stone-700 rounded disabled:opacity-30"><SkipBack className="w-4 h-4"/></button>
                         <button onClick={prevReplayDay} disabled={replayIndex === 0} className="p-2 hover:bg-stone-700 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
                       </div>
                       
                       <span className="text-sm font-mono font-bold text-stone-300">
                         Day {displayDayNumber} / {gameState.history.length}
                       </span>
                       
                       <div className="flex gap-1">
                         <button onClick={nextReplayDay} disabled={replayIndex === gameState.history.length - 1} className="p-2 hover:bg-stone-700 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
                         <button onClick={endReplay} disabled={replayIndex === gameState.history.length - 1} className="p-2 hover:bg-stone-700 rounded disabled:opacity-30"><SkipForward className="w-4 h-4"/></button>
                         <button onClick={closeReplay} className="p-2 hover:bg-red-900/50 text-red-300 rounded ml-2"><X className="w-4 h-4"/></button>
                       </div>
                    </div>
                 )}
               </div>
             )}
             
             {/* Play Again */}
             <button
               onClick={() => resetGame()}
               className="w-full py-4 rounded-xl font-bold text-lg bg-white border border-stone-300 text-stone-800 shadow-sm hover:bg-stone-50 active:scale-95 flex items-center justify-center gap-2 flex-shrink-0"
             >
               <RefreshCw className="w-5 h-5" /> Play New Game
             </button>
          </div>
        )}

        {/* Assistant / Gemini */}
        <Assistant history={gameState.history} holeCount={gameState.holeCount} />

        {/* Log */}
        <div className="flex-1 min-h-[200px] bg-stone-50 rounded-2xl p-1 border border-stone-200 shadow-inner overflow-hidden flex flex-col">
           <Log history={gameState.history} />
        </div>

      </main>
      
    </div>
  );
};

export default App;