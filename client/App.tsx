import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Hole } from './components/Hole';
import { Log } from './components/Log';

import { GameState, GameStatus, HistoryEntry } from './types';
import { RefreshCw, Trophy, Info, Minus, Plus, X, Play, SkipBack, SkipForward, ChevronLeft, ChevronRight, Pause, ClipboardList, Smartphone } from 'lucide-react';

const App: React.FC = () => {
  const initialHoleCount = 5;

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>({
    holeCount: initialHoleCount,
    possibleHoles: Array.from({ length: initialHoleCount }, (_, i) => i),
    candidatesHistory: [Array.from({ length: initialHoleCount }, (_, i) => i)],
    day: 1,
    history: [],
    status: GameStatus.PLAYING,
    lastCheckedIndex: null,
    rabbitPath: [],
  });

  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRules, setShowRules] = useState(true);

  // Replay State
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const replayTimerRef = useRef<number | null>(null);

  // UI State for Bottom Sheet
  const [activeTab, setActiveTab] = useState<'log' | null>(null);

  // Orientation State
  const [isLandscape, setIsLandscape] = useState(true); // Default to true to avoid flash, check on mount
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Check if device is likely mobile (small width) and portrait
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const isPortrait = window.innerHeight > window.innerWidth;

      setIsLandscape(!isPortrait);

      // If mobile and portrait, suggest rotation
      if (isMobile && isPortrait) {
        setShowRotatePrompt(true);
      } else {
        setShowRotatePrompt(false);
        // Attempt lock if possible (Chrome Android etc)
        if (screen.orientation && 'lock' in screen.orientation) {
          // We act "optimistically" here, catch errors silently
          (screen.orientation as any).lock('landscape').catch(() => { });
        }
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', checkOrientation);
      }
    };
  }, []);


  // --- Logic Helpers ---
  const backtrackPath = (candidatesHistory: number[][], history: HistoryEntry[], winningHole: number): number[] => {
    const path: number[] = [winningHole];
    let currentPos = winningHole;
    for (let i = candidatesHistory.length - 2; i >= 0; i--) {
      const candidatesForDay = candidatesHistory[i];
      const checkedHoleThatDay = history[i].checkedHoleIndex;
      const validParents = candidatesForDay.filter(p =>
        p !== checkedHoleThatDay && Math.abs(p - currentPos) === 1
      );
      if (validParents.length > 0) {
        const parent = validParents[Math.floor(Math.random() * validParents.length)];
        path.unshift(parent);
        currentPos = parent;
      } else {
        path.unshift(candidatesForDay[0]);
      }
    }
    return path;
  };

  // --- Game Loop ---
  /* Updated to support direct index passing for single-tap */
  const handleCheckHole = useCallback(async (indexOverride?: number) => {
    // Use override if provided, otherwise fallback to selectedHole (though single-tap should always provide it)
    const targetHole = indexOverride !== undefined ? indexOverride : selectedHole;

    if (targetHole === null || gameState.status !== GameStatus.PLAYING || isProcessing) return;

    // Set selected hole immediately for UI feedback (Fox movement)
    setSelectedHole(targetHole);

    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const { possibleHoles, day, history, candidatesHistory, holeCount } = gameState;
    const isWin = possibleHoles.length === 1 && possibleHoles[0] === targetHole;

    if (isWin) {
      const path = backtrackPath(candidatesHistory, history, targetHole);
      const winEntry: HistoryEntry = { day, checkedHoleIndex: targetHole, found: true, remainingPossibilitiesCount: 0 };

      setGameState(prev => ({
        ...prev, status: GameStatus.WON, history: [...prev.history, winEntry], lastCheckedIndex: targetHole, rabbitPath: path
      }));
      setIsProcessing(false);
      setSelectedHole(null);
      return;
    }

    const afterCheckCandidates = possibleHoles.filter(h => h !== targetHole);
    const nextDayCandidatesSet = new Set<number>();
    afterCheckCandidates.forEach(pos => {
      if (pos - 1 >= 0) nextDayCandidatesSet.add(pos - 1);
      if (pos + 1 < holeCount) nextDayCandidatesSet.add(pos + 1);
    });
    const nextPossibleHoles = Array.from(nextDayCandidatesSet).sort((a, b) => a - b);

    const newEntry: HistoryEntry = { day, checkedHoleIndex: targetHole, found: false, remainingPossibilitiesCount: afterCheckCandidates.length };

    setGameState(prev => ({
      ...prev, day: prev.day + 1, history: [...prev.history, newEntry], possibleHoles: nextPossibleHoles, candidatesHistory: [...prev.candidatesHistory, nextPossibleHoles], lastCheckedIndex: targetHole
    }));

    setIsProcessing(false);
    setSelectedHole(null);
  }, [selectedHole, gameState, isProcessing]);

  const handleHoleClick = (index: number) => {
    // Single tap -> Inspect immediately
    handleCheckHole(index);
  };


  const resetGame = (newHoleCount: number = gameState.holeCount) => {
    const allHoles = Array.from({ length: newHoleCount }, (_, i) => i);
    setGameState({
      holeCount: newHoleCount, possibleHoles: allHoles, candidatesHistory: [allHoles], day: 1, history: [], status: GameStatus.PLAYING, lastCheckedIndex: null, rabbitPath: [],
    });
    setSelectedHole(null);
    setReplayIndex(null);
    setIsPlayingReplay(false);
    setActiveTab(null);
    if (replayTimerRef.current) clearInterval(replayTimerRef.current);
  };

  const changeHoleCount = (delta: number) => {
    const newCount = Math.min(10, Math.max(3, gameState.holeCount + delta));
    if (newCount !== gameState.holeCount) resetGame(newCount);
  };

  // --- Replay Logic ---
  const isReplayMode = replayIndex !== null && gameState.status === GameStatus.WON;
  const startReplay = () => { setReplayIndex(0); setIsPlayingReplay(true); };
  const toggleAutoReplay = () => { setIsPlayingReplay(prev => !prev); };

  useEffect(() => {
    if (isPlayingReplay && replayIndex !== null) {
      replayTimerRef.current = window.setInterval(() => {
        setReplayIndex(prev => {
          if (prev === null) return 0;
          if (prev < gameState.history.length - 1) return prev + 1;
          else { setIsPlayingReplay(false); return prev; }
        });
      }, 1500);
    }
    return () => { if (replayTimerRef.current) clearInterval(replayTimerRef.current); };
  }, [isPlayingReplay, gameState.history.length]);

  const nextReplayDay = () => { setIsPlayingReplay(false); setReplayIndex(prev => (prev !== null && prev < gameState.history.length - 1 ? prev + 1 : prev)); };
  const prevReplayDay = () => { setIsPlayingReplay(false); setReplayIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev)); };
  const endReplay = () => { setIsPlayingReplay(false); setReplayIndex(gameState.history.length - 1); };
  const closeReplay = () => { setIsPlayingReplay(false); setReplayIndex(null); };

  // --- Display Values ---
  const displayDayIndex = isReplayMode ? replayIndex : (gameState.status === GameStatus.WON ? gameState.history.length - 1 : gameState.day - 1);
  const displayRabbitPos = isReplayMode ? gameState.rabbitPath[displayDayIndex] : (gameState.status === GameStatus.WON ? gameState.lastCheckedIndex! : -1);
  const displayCheckedPos = isReplayMode ? gameState.history[displayDayIndex]?.checkedHoleIndex : gameState.lastCheckedIndex;
  const displayDayNumber = isReplayMode ? gameState.history[displayDayIndex]?.day : gameState.day;
  const currentPossibilities = isReplayMode ? -1 : gameState.possibleHoles.length;
  const foxPosition = isReplayMode
    ? displayCheckedPos
    : (gameState.status === GameStatus.WON ? gameState.lastCheckedIndex : selectedHole);
  const showFox = (foxPosition !== null);

  return (
    <div className="h-[100dvh] bg-stone-50 text-stone-800 flex flex-col overflow-hidden relative font-sans">

      {/* 1. Header (Fixed) */}
      <header className="flex-none bg-white border-b border-stone-200 z-10 shadow-sm px-4 h-14 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-stone-800 tracking-tight leading-tight">Catch the Rabbit</h1>
          <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wide">
            {isReplayMode ? <span className="text-amber-600">Replay Mode</span> : `Day ${gameState.day}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hole Controls moved to Header for Landscape */}
          <div className="hidden landscape:flex items-center gap-2 mr-4 bg-stone-100 rounded-lg p-1">
            <button onClick={() => changeHoleCount(-1)} disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-white rounded text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition-colors"><Minus className="w-3 h-3" /></button>
            <span className="font-mono font-bold text-sm text-stone-800 w-4 text-center">{gameState.holeCount}</span>
            <button onClick={() => changeHoleCount(1)} disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-white rounded text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition-colors"><Plus className="w-3 h-3" /></button>
          </div>

          <button onClick={() => setShowRules(true)} className="p-2 text-stone-400 hover:text-stone-600 bg-stone-50 rounded-full">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Main Game Area (Flex-Grow) */}
      <main className="flex-1 flex flex-col relative w-full max-w-4xl mx-auto overflow-hidden landscape:flex-row">

        {/* Top Controls: Hole Count & Restart (Portrait Only) */}
        <div className="flex-none p-4 pb-0 flex items-center justify-between animate-in slide-in-from-top-2 landscape:hidden">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow-sm border border-stone-200">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Holes</span>
            <button onClick={() => changeHoleCount(-1)} disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded text-stone-600 disabled:opacity-30 hover:bg-stone-200 transition-colors"><Minus className="w-3 h-3" /></button>
            <span className="font-mono font-bold text-lg text-stone-800 w-4 text-center">{gameState.holeCount}</span>
            <button onClick={() => changeHoleCount(1)} disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded text-stone-600 disabled:opacity-30 hover:bg-stone-200 transition-colors"><Plus className="w-3 h-3" /></button>
          </div>
          <button onClick={() => resetGame()} disabled={isProcessing} className="p-2 bg-white/80 backdrop-blur text-stone-500 rounded-xl shadow-sm border border-stone-200 hover:bg-white active:scale-95 disabled:opacity-50 hover:text-stone-800 transition-colors"><RefreshCw className="w-5 h-5" /></button>
        </div>

        {/* Sidebar Controls (Landscape Only) */}
        <div className="hidden landscape:flex flex-col justify-center gap-4 p-4 pr-0 z-20">
          {/* Replay Controls in Sidebar */}
          {gameState.status === GameStatus.WON && (
            isReplayMode ? (
              <div className="flex flex-col gap-2 bg-stone-800 text-white rounded-xl p-2 shadow-lg">
                <button onClick={toggleAutoReplay} className="p-3 hover:bg-stone-700 rounded-lg text-amber-400 transition-colors flex justify-center">{isPlayingReplay ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}</button>
                <div className="flex flex-col gap-1">
                  <button onClick={prevReplayDay} disabled={replayIndex === 0} className="p-3 hover:bg-stone-700 rounded-lg disabled:opacity-30 transition-colors flex justify-center"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={nextReplayDay} disabled={replayIndex === gameState.history.length - 1} className="p-3 hover:bg-stone-700 rounded-lg disabled:opacity-30 transition-colors flex justify-center"><ChevronRight className="w-5 h-5" /></button>
                </div>
                <button onClick={closeReplay} className="p-3 hover:bg-red-900/50 text-red-300 rounded-lg transition-colors flex justify-center"><X className="w-5 h-5" /></button>
              </div>
            ) : (
              <button onClick={startReplay} className="p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/30 active:scale-[0.95] transition-all" title="Watch Replay"><Play className="w-5 h-5 fill-current" /></button>
            )
          )}

          {(!isReplayMode || gameState.status !== GameStatus.WON) && (
            <button onClick={() => resetGame()} disabled={isProcessing} className="p-3 bg-white text-stone-600 rounded-xl shadow-sm border border-stone-200 hover:bg-stone-50 active:scale-95 disabled:opacity-50 transition-colors" title="New Game"><RefreshCw className="w-5 h-5" /></button>
          )}
        </div>


        {/* THE BOARD (Takes up all remaining space, centering content) */}
        <div className="flex-1 flex flex-col justify-center relative min-h-0">
          {/* Holes Container - Scaled to fill width */}
          <div className="w-full overflow-x-auto scrollbar-hide py-20 landscape:py-8">
            <div className="flex justify-center min-w-full px-6 landscape:px-12">
              <div className="relative flex gap-2 sm:gap-4 md:gap-6">
                {/* Connector Line */}
                <div className="absolute top-1/2 left-2 right-2 h-1 bg-stone-300 -z-10 -translate-y-1/2 rounded-full" />

                {/* Sliding Fox Cursor */}
                {showFox && (
                  <div className="absolute -top-12 left-0 z-20 w-10 h-10 sm:w-16 sm:h-16 flex justify-center transition-transform duration-300 ease-out pointer-events-none" style={{ transform: `translateX(calc(${foxPosition} * (100% + ${window.innerWidth >= 768 ? '1.5rem' : (window.innerWidth >= 640 ? '1rem' : '0.5rem')})))` }}>
                    <div className="text-4xl animate-bounce drop-shadow-md filter">🦊</div>
                  </div>
                )}

                {Array.from({ length: gameState.holeCount }).map((_, i) => {
                  const isChecked = displayCheckedPos === i;
                  const isRabbit = isReplayMode ? displayRabbitPos === i : (gameState.status === GameStatus.WON && gameState.lastCheckedIndex === i);
                  const isSelected = (!isReplayMode && selectedHole === i) || (isReplayMode && displayCheckedPos === i);
                  return (
                    <div key={i} className="flex-shrink-0 relative">
                      <Hole index={i} isSelected={isSelected} isChecked={isChecked} isRabbit={isRabbit} gameStatus={gameState.status} onSelect={handleHoleClick} disabled={gameState.status !== GameStatus.PLAYING || isProcessing || isReplayMode} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Feedback Text - Floating below board */}
          <div className="text-center h-10 flex items-center justify-center w-full px-4 mt-2">
            {gameState.status === GameStatus.WON ? (
              isReplayMode ? (
                <span className="text-amber-700 font-bold animate-in fade-in bg-amber-50 px-4 py-1.5 rounded-full text-sm border border-amber-100 shadow-sm flex items-center gap-2">
                  <Play className="w-3 h-3 fill-current" /> Replay Day {displayDayNumber}
                </span>
              ) : (
                <span className="text-emerald-700 font-bold flex items-center gap-2 animate-bounce bg-emerald-50 px-5 py-2 rounded-full border border-emerald-100 shadow-sm">
                  <Trophy className="w-4 h-4" /> Caught at Hole #{selectedHole! + 1}!
                </span>
              )
            ) : selectedHole !== null ? (
              <span className="text-stone-700 font-bold animate-pulse bg-white/60 backdrop-blur px-5 py-1.5 rounded-full shadow-sm border border-stone-200/50">
                Tap again to inspect Hole #{selectedHole + 1}
              </span>
            ) : (
              <span className="text-stone-500 text-sm font-medium bg-stone-200/50 px-4 py-1.5 rounded-full">
                {currentPossibilities} possibilities remaining
              </span>
            )}
          </div>
        </div>

        {/* Bottom Action Area (Fixed within Main) - Hidden in Landscape if empty */}
        <div className="flex-none p-4 pt-0 landscape:hidden">
          {gameState.status === GameStatus.PLAYING ? (
            <div className="h-4" />
          ) : (
            <div className="flex gap-3">
              {gameState.status === GameStatus.WON && (
                !isReplayMode ? (
                  <button onClick={startReplay} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"><Play className="w-5 h-5 fill-current" /> Watch Replay</button>
                ) : (
                  <div className="flex-1 flex items-center justify-between bg-stone-800 text-white rounded-2xl px-2 shadow-lg">
                    <button onClick={toggleAutoReplay} className="p-3 hover:bg-stone-700 rounded-xl text-amber-400 transition-colors">{isPlayingReplay ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}</button>
                    <div className="flex gap-1">
                      <button onClick={prevReplayDay} disabled={replayIndex === 0} className="p-3 hover:bg-stone-700 rounded-xl disabled:opacity-30 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={nextReplayDay} disabled={replayIndex === gameState.history.length - 1} className="p-3 hover:bg-stone-700 rounded-xl disabled:opacity-30 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <button onClick={closeReplay} className="p-3 hover:bg-red-900/50 text-red-300 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                )
              )
              }
              {(!isReplayMode || gameState.status !== GameStatus.WON) && (
                <button onClick={() => resetGame()} className="flex-1 bg-white border border-stone-200 text-stone-800 py-4 rounded-2xl font-bold shadow-sm hover:bg-stone-50 active:scale-[0.98] transition-all">New Game</button>
              )}
            </div>
          )}
        </div>
      </main >

      {/* 3. Bottom Navigation Bar - Landscape: Move to Side? Or Keep? Keep for now but ensure it doesn't take too much vertical space. */}
      {/* For landscape, maybe we just hide the Label and make it smaller? */}
      <div className="flex-none bg-white border-t border-stone-200 px-6 py-2 pb-4 safe-area-bottom z-20 flex justify-center shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.03)] landscape:py-1 landscape:pb-1">
        <button
          onClick={() => setActiveTab(activeTab === 'log' ? null : 'log')}
          className={`flex flex-col items-center justify-center gap-1.5 py-2 rounded-2xl transition-all duration-300 px-6 ${activeTab === 'log' ? 'bg-stone-100 text-stone-900 -translate-y-1' : 'text-stone-400 hover:text-stone-600'} landscape:flex-row landscape:py-1`}
        >
          <ClipboardList className={`w-6 h-6 ${activeTab === 'log' ? 'stroke-2' : 'stroke-1.5'}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider landscape:text-xs">Log</span>
        </button>
      </div>

      {/* 4. Bottom Sheet Overlay (Drawer) */}
      {
        activeTab && (
          <>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-[2px] z-30 animate-in fade-in duration-300" onClick={() => setActiveTab(null)} />

            {/* Sheet Content */}
            <div className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-[2rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300 flex flex-col h-[55vh] max-h-[600px] landscape:h-[80vh] landscape:max-w-md landscape:left-auto landscape:right-0 landscape:rounded-l-[2rem] landscape:rounded-t-none">
              {/* Handle Bar (Hidden in side sheet mode) */}
              <div className="w-full flex justify-center pt-3 pb-1 landscape:hidden" onClick={() => setActiveTab(null)}>
                <div className="w-12 h-1.5 bg-stone-200 rounded-full" />
              </div>

              <div className="flex-none px-6 py-3 border-b border-stone-50 flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-stone-500" /> Investigation Log
                </h3>
                <button onClick={() => setActiveTab(null)} className="p-2 bg-stone-50 rounded-full hover:bg-stone-100 transition-colors text-stone-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-stone-50/30">
                <Log history={gameState.history} />
              </div>
            </div>
          </>
        )
      }

      {/* Rules Modal Overlay */}
      {
        showRules && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-5 border border-white/50 landscape:max-w-md landscape:flex landscape:flex-row landscape:gap-6 landscape:p-8 landscape:items-center">
              <div className="flex-1 space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-stone-800 tracking-tight">Fox & Rabbit Rules</h3>
                  <button onClick={() => setShowRules(false)} className="text-stone-400 hover:text-stone-600 p-1 landscape:hidden"><X className="w-6 h-6" /></button>
                </div>
                <div className="text-sm text-stone-600 space-y-3 leading-relaxed">
                  <p>The rabbit is in a <strong>superposition</strong>! It exists in ALL possible holes at once.</p>
                  <ul className="list-disc pl-4 space-y-2 marker:text-amber-500">
                    <li>Check a hole to <strong>collapse</strong> the possibilities.</li>
                    <li>If the rabbit <em>could</em> be there, checking it removes that possibility.</li>
                    <li>After a check, all potential rabbits move 1 step (left or right).</li>
                  </ul>
                  <div className="bg-stone-100 p-4 rounded-2xl text-xs font-medium text-stone-500 border border-stone-200/60">
                    Win by eliminating all possibilities except <strong>ONE</strong>, then catch it!
                  </div>
                </div>
              </div>
              <div className="landscape:w-40 landscape:flex landscape:flex-col landscape:gap-2">
                <button onClick={() => setShowRules(false)} className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-transform active:scale-[0.98] shadow-xl shadow-stone-900/20">Let's Hunt</button>
                <button onClick={() => setShowRules(false)} className="hidden landscape:block w-full py-2 text-stone-400 hover:text-stone-600">Close</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Orientation Prompt Overlay */}
      {showRotatePrompt && (
        <div className="fixed inset-0 z-[60] bg-stone-900/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <Smartphone className="w-16 h-16 text-stone-400 mb-6 animate-spin-slow" style={{ animationDuration: '3s' }} />
          <h2 className="text-2xl font-bold text-white mb-2">Please Rotate Your Device</h2>
          <p className="text-stone-400 max-w-xs">We need a bit more space to hunt properly! Switch to landscape mode for the best experience.</p>
        </div>
      )}
    </div>
  );
};

export default App;