import React, { useState, useCallback } from 'react';
import { Hole } from './components/Hole';
import { Log } from './components/Log';
import { Assistant } from './components/Assistant';
import { GameState, GameStatus, HistoryEntry } from './types';
import { RefreshCw, Trophy, Info, Minus, Plus, X, Play, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const initialHoleCount = 5;

  // Initial State: Rabbit could be anywhere
  const [gameState, setGameState] = useState<GameState>({
    holeCount: initialHoleCount,
    possibleHoles: Array.from({ length: initialHoleCount }, (_, i) => i),
    candidatesHistory: [Array.from({ length: initialHoleCount }, (_, i) => i)], // Day 1 candidates
    day: 1,
    history: [],
    status: GameStatus.PLAYING,
    lastCheckedIndex: null,
    rabbitPath: [],
  });

  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  // --- Logic Helpers ---

  // Backtracking algorithm to generate a valid rabbit path after winning
  const backtrackPath = (candidatesHistory: number[][], history: HistoryEntry[], winningHole: number): number[] => {
    const path: number[] = [winningHole];
    let currentPos = winningHole;

    // Iterate backwards from the day BEFORE the win, down to Day 1
    // history array length excludes the winning move when this is called inside handleCheckHole if we aren't careful,
    // but here we will pass the full history including the win, or manage indices carefully.
    // Let's assume 'history' passed here EXCLUDES the winning entry (Day N).
    // The loop goes from Day N-1 down to Day 1.
    // candidatesHistory has entries for Day 1 to Day N.

    for (let i = candidatesHistory.length - 2; i >= 0; i--) {
      const candidatesForDay = candidatesHistory[i];
      const checkedHoleThatDay = history[i].checkedHoleIndex;

      // Find a hole in candidatesForDay that is:
      // 1. NOT the hole we checked that day (rabbit wasn't there)
      // 2. Adjacent to currentPos (where rabbit is the next day)
      
      // Note: The logic ensures at least one such parent exists if the game logic is sound.
      // If multiple exist, we pick the first one (randomly effectively) or could randomize.
      
      const validParents = candidatesForDay.filter(p => 
        p !== checkedHoleThatDay && Math.abs(p - currentPos) === 1
      );

      if (validParents.length > 0) {
        // Pick a random valid parent for variety in replay
        const parent = validParents[Math.floor(Math.random() * validParents.length)];
        path.unshift(parent);
        currentPos = parent;
      } else {
        console.error("Critical Logic Error: No valid parent found during backtrack", { day: i + 1, currentPos, candidatesForDay, checkedHoleThatDay });
        path.unshift(candidatesForDay[0]); // Fallback to prevent crash
      }
    }
    return path;
  };

  // --- Game Loop ---

  const handleCheckHole = useCallback(async () => {
    if (selectedHole === null || gameState.status !== GameStatus.PLAYING || isProcessing) return;

    setIsProcessing(true);
    
    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, 500));

    const { possibleHoles, day, history, candidatesHistory, holeCount } = gameState;
    
    // 1. Check Step
    // To win, the rabbit must be FORCED to be in the selected hole.
    // This happens if the selected hole is the ONLY possibility left.
    // (If there are multiple possibilities and we pick one, we just eliminated one possibility, we didn't catch it for sure).
    
    const isWin = possibleHoles.length === 1 && possibleHoles[0] === selectedHole;
    
    if (isWin) {
       // VICTORY
       const path = backtrackPath(candidatesHistory, history, selectedHole);
       
       const winEntry: HistoryEntry = {
         day,
         checkedHoleIndex: selectedHole,
         found: true,
         remainingPossibilitiesCount: 0
       };

       setGameState(prev => ({
         ...prev,
         status: GameStatus.WON,
         history: [...prev.history, winEntry],
         lastCheckedIndex: selectedHole,
         rabbitPath: path
       }));
       
       setIsProcessing(false);
       setSelectedHole(null);
       return;
    }

    // NOT VICTORY
    // 1. Elimination: If selected hole was a possibility, remove it.
    // (If it wasn't a possibility, we just learned nothing new about location, but time passes).
    const afterCheckCandidates = possibleHoles.filter(h => h !== selectedHole);
    
    // 2. Movement (Next Day): Expand remaining candidates to adjacent holes
    const nextDayCandidatesSet = new Set<number>();
    afterCheckCandidates.forEach(pos => {
      if (pos - 1 >= 0) nextDayCandidatesSet.add(pos - 1);
      if (pos + 1 < holeCount) nextDayCandidatesSet.add(pos + 1);
    });
    const nextPossibleHoles = Array.from(nextDayCandidatesSet).sort((a, b) => a - b);

    const newEntry: HistoryEntry = {
      day,
      checkedHoleIndex: selectedHole,
      found: false,
      remainingPossibilitiesCount: afterCheckCandidates.length // Count *after* check, before move
    };

    setGameState(prev => ({
      ...prev,
      day: prev.day + 1,
      history: [...prev.history, newEntry],
      possibleHoles: nextPossibleHoles,
      candidatesHistory: [...prev.candidatesHistory, nextPossibleHoles],
      lastCheckedIndex: selectedHole
    }));

    setIsProcessing(false);
    setSelectedHole(null);

  }, [selectedHole, gameState, isProcessing]);


  const resetGame = (newHoleCount: number = gameState.holeCount) => {
    const allHoles = Array.from({ length: newHoleCount }, (_, i) => i);
    setGameState({
      holeCount: newHoleCount,
      possibleHoles: allHoles,
      candidatesHistory: [allHoles],
      day: 1,
      history: [],
      status: GameStatus.PLAYING,
      lastCheckedIndex: null,
      rabbitPath: [],
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

  const isReplayMode = replayIndex !== null && gameState.status === GameStatus.WON;

  // --- Derived Display Values ---
  const displayDayIndex = isReplayMode 
    ? replayIndex 
    : (gameState.status === GameStatus.WON ? gameState.history.length - 1 : gameState.day - 1);

  // In playing mode, we don't show the rabbit.
  // In replay mode, we show the rabbit from the backtracked path.
  const displayRabbitPos = isReplayMode 
    ? gameState.rabbitPath[displayDayIndex] 
    : (gameState.status === GameStatus.WON ? gameState.lastCheckedIndex! : -1);

  const displayCheckedPos = isReplayMode
    ? gameState.history[displayDayIndex]?.checkedHoleIndex
    : gameState.lastCheckedIndex;

  const displayDayNumber = isReplayMode 
    ? gameState.history[displayDayIndex]?.day 
    : gameState.day;

  const currentPossibilities = isReplayMode 
    ? -1 // Don't show possibilities during replay, show path
    : gameState.possibleHoles.length;

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
                <>Day {gameState.day} • {currentPossibilities} Suspects Left</>
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
             <div className="text-sm text-stone-600 space-y-3">
               <p>The rabbit is in <strong>superposition</strong>! It could be in ANY valid hole.</p>
               <ul className="list-disc pl-5 space-y-1">
                 <li>Every day, inspect one hole.</li>
                 <li>If the rabbit <em>could</em> be there, checking it rules out that possibility for today.</li>
                 <li>The remaining "possible rabbits" move to adjacent holes (left or right) for the next day.</li>
                 <li><strong>Win Condition:</strong> Reduce the possibilities to just <strong>one</strong> hole and catch it!</li>
               </ul>
               <p className="bg-stone-100 p-2 rounded text-xs italic">
                 Note: You only win when you are 100% certain. If you check a hole and the rabbit <em>could</em> have been elsewhere, the game continues.
               </p>
             </div>
             <button 
               onClick={() => setShowRules(false)}
               className="w-full py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-700"
             >
               Start Hunting
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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 relative overflow-hidden">
           {/* Progress Hint Background */}
           {gameState.status === GameStatus.PLAYING && (
              <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                   style={{ width: `${Math.max(5, ((gameState.holeCount - currentPossibilities) / gameState.holeCount) * 100)}%` }} 
              />
           )}

           {/* Scrollable Container for Holes */}
           <div className="overflow-x-auto -mx-6 px-6 scrollbar-hide">
             <div className="inline-flex items-center justify-center gap-2 relative min-w-full pt-12 pb-6">
               {/* Connector Line */}
               <div className="absolute top-1/2 left-2 right-2 h-1 bg-stone-200 -z-10 -translate-y-1/2 rounded-full mt-3" />
               
               {Array.from({ length: gameState.holeCount }).map((_, i) => {
                 // Logic for visual state
                 const isChecked = displayCheckedPos === i;
                 // In Replay: Show rabbit if it's in the path at this index.
                 // In Play: Rabbit is invisible (quantum), but we show it if we WON.
                 const isRabbit = isReplayMode 
                    ? displayRabbitPos === i 
                    : (gameState.status === GameStatus.WON && gameState.lastCheckedIndex === i);
                 
                 const isSelected = (!isReplayMode && selectedHole === i) || (isReplayMode && displayCheckedPos === i);
                 
                 // Debug visualization for dev (optional)
                 // const isPossible = gameState.possibleHoles.includes(i); 

                 return (
                   <div key={i} className="flex-shrink-0 relative">
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
                    Replay Day {displayDayNumber}: Rabbit revealed at Hole {displayRabbitPos + 1}
                  </span>
                ) : (
                  <span className="text-green-600 font-bold flex items-center justify-center gap-2 animate-bounce">
                    <Trophy className="w-5 h-5" /> Gotcha! The rabbit is cornered!
                  </span>
                )
             ) : selectedHole !== null ? (
               <span className="text-stone-500 font-medium animate-pulse">
                 Check Hole {selectedHole + 1}?
               </span>
             ) : (
               <span className="text-stone-400 text-sm">
                 {currentPossibilities} possible locations. Who to eliminate?
               </span>
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
            {isProcessing ? 'Checking...' : 'Inspect Hole'}
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
                      <Play className="w-4 h-4" /> Watch Rabbit's Path
                    </button>
                 ) : (
                    <div className="flex w-full items-center justify-between px-2">
                       <div className="flex gap-1">
                         <button onClick={startReplay} disabled={replayIndex === 0} className="p-2 hover:bg-stone-700 rounded disabled:opacity-30"><SkipBack className="w-4 h-4"/></button>
                         <button onClick={prevReplayDay} disabled={replayIndex === 0} className="p-2 hover:bg-stone-700 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
                       </div>
                       
                       <span className="text-sm font-mono font-bold text-stone-300">
                         Day {displayDayNumber}
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