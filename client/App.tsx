import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Hole } from './components/Hole';
import { Log } from './components/Log';

import { GameState, GameStatus, HistoryEntry } from './types';
import { RefreshCw, Trophy, Info, Minus, Plus, X, Play, SkipBack, SkipForward, ChevronLeft, ChevronRight, Pause, ClipboardList, Smartphone, Rabbit, MapPin, Repeat } from 'lucide-react';
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
  const foxPosition = isReplayMode ? displayCheckedPos : gameState.lastCheckedIndex;
  const showFox = (foxPosition !== null);

  return (
    <div className="h-[100dvh] bg-stone-950 text-stone-200 flex flex-col overflow-hidden relative font-sans">

      {/* 1. Header (Fixed) */}
      <header className="flex-none bg-stone-900 border-b border-stone-800 z-10 shadow-md px-4 h-14 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-stone-100 tracking-tight leading-tight">Catch the Rabbit</h1>
          <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wide">
            {isReplayMode ? <span className="text-amber-500">Replay Mode</span> : `Day ${gameState.day}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hole Controls moved to Header for Landscape */}
          <div className="hidden landscape:flex items-center gap-2 mr-4 bg-stone-800 rounded-lg p-1 border border-stone-700">
            <button onClick={() => changeHoleCount(-1)} disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-700 rounded text-stone-400 disabled:opacity-30 hover:bg-stone-600 transition-colors"><Minus className="w-3 h-3" /></button>
            <span className="font-mono font-bold text-sm text-stone-300 w-4 text-center">{gameState.holeCount}</span>
            <button onClick={() => changeHoleCount(1)} disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-700 rounded text-stone-400 disabled:opacity-30 hover:bg-stone-600 transition-colors"><Plus className="w-3 h-3" /></button>
          </div>

          <button onClick={() => setShowRules(true)} className="p-2 text-stone-500 hover:text-stone-300 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Main Game Area (Flex-Grow) */}
      <main className="flex-1 flex flex-col relative w-full max-w-4xl mx-auto overflow-hidden landscape:flex-row">

        {/* Top Controls: Hole Count & Restart (Portrait Only) */}
        <div className="flex-none p-4 pb-0 flex items-center justify-between animate-in slide-in-from-top-2 landscape:hidden">
          <div className="flex items-center gap-2 bg-stone-900/80 backdrop-blur px-3 py-2 rounded-xl shadow-lg border border-stone-800">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mr-1">Holes</span>
            <button onClick={() => changeHoleCount(-1)} disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-800 rounded text-stone-400 disabled:opacity-30 hover:bg-stone-700 transition-colors"><Minus className="w-3 h-3" /></button>
            <span className="font-mono font-bold text-lg text-stone-200 w-4 text-center">{gameState.holeCount}</span>
            <button onClick={() => changeHoleCount(1)} disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-800 rounded text-stone-400 disabled:opacity-30 hover:bg-stone-700 transition-colors"><Plus className="w-3 h-3" /></button>
          </div>
          <button onClick={() => resetGame()} disabled={isProcessing} className="p-2 bg-stone-900/80 backdrop-blur text-stone-500 rounded-xl shadow-lg border border-stone-800 hover:bg-stone-800 active:scale-95 disabled:opacity-50 hover:text-stone-300 transition-colors"><RefreshCw className="w-5 h-5" /></button>
        </div>

        {/* Sidebar Controls (Landscape Only) */}
        <div className="hidden landscape:flex flex-col justify-center gap-4 p-4 pr-0 z-20">
          {/* Replay Controls in Sidebar */}
          {gameState.status === GameStatus.WON && (
            isReplayMode ? (
              <div className="flex flex-col gap-2 bg-stone-900 border border-stone-800 text-white rounded-xl p-2 shadow-xl">
                <button onClick={toggleAutoReplay} className="p-3 hover:bg-stone-800 rounded-lg text-amber-500 transition-colors flex justify-center">{isPlayingReplay ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}</button>
                <div className="flex flex-col gap-1">
                  <button onClick={prevReplayDay} disabled={replayIndex === 0} className="p-3 hover:bg-stone-800 rounded-lg disabled:opacity-30 transition-colors flex justify-center"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={nextReplayDay} disabled={replayIndex === gameState.history.length - 1} className="p-3 hover:bg-stone-800 rounded-lg disabled:opacity-30 transition-colors flex justify-center"><ChevronRight className="w-5 h-5" /></button>
                </div>
                <button onClick={closeReplay} className="p-3 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors flex justify-center"><X className="w-5 h-5" /></button>
              </div>
            ) : (
              <button onClick={startReplay} className="p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-600/20 active:scale-[0.95] transition-all" title="Watch Replay"><Play className="w-5 h-5 fill-current" /></button>
            )
          )}

          {(!isReplayMode || gameState.status !== GameStatus.WON) && (
            <button onClick={() => resetGame()} disabled={isProcessing} className="p-3 bg-stone-900 text-stone-500 rounded-xl shadow-lg border border-stone-800 hover:bg-stone-800 hover:text-stone-300 active:scale-95 disabled:opacity-50 transition-colors" title="New Game"><RefreshCw className="w-5 h-5" /></button>
          )}
        </div>


        {/* THE BOARD (Takes up all remaining space, centering content) */}
        <div className="flex-1 flex flex-col justify-center relative min-h-0">
          {/* Holes Container - Scaled to fill width */}
          <div className="w-full overflow-x-auto scrollbar-hide py-20 landscape:pt-16 landscape:pb-8">
            <div className="flex justify-center min-w-full px-6 landscape:px-12">
              <div className="relative flex gap-2 sm:gap-4 md:gap-6">
                {/* Connector Line */}
                <div className="absolute top-1/2 left-2 right-2 h-1 bg-stone-800 -z-10 -translate-y-1/2 rounded-full" />

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
                <span className="text-amber-500 font-bold animate-in fade-in bg-amber-950/30 px-4 py-1.5 rounded-full text-sm border border-amber-900/50 shadow-sm flex items-center gap-2">
                  <Play className="w-3 h-3 fill-current" /> Replay Day {displayDayNumber}
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-2 animate-bounce bg-emerald-950/40 px-5 py-2 rounded-full border border-emerald-900/50 shadow-sm">
                  <Trophy className="w-4 h-4" /> Caught at Hole #{selectedHole! + 1}!
                </span>
              )
            ) : selectedHole !== null ? (
              <span className="text-stone-300 font-bold animate-pulse bg-stone-900/80 backdrop-blur px-5 py-1.5 rounded-full shadow-sm border border-stone-800">
                Checking Hole #{selectedHole + 1}
              </span>
            ) : (
              <span className="text-stone-500 text-sm font-medium bg-stone-900/50 px-4 py-1.5 rounded-full border border-stone-800/50">
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
                  <button onClick={startReplay} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"><Play className="w-5 h-5 fill-current" /> Watch Replay</button>
                ) : (
                  <div className="flex-1 flex items-center justify-between bg-stone-900 border border-stone-800 text-white rounded-2xl px-2 shadow-xl">
                    <button onClick={toggleAutoReplay} className="p-3 hover:bg-stone-800 rounded-xl text-amber-500 transition-colors">{isPlayingReplay ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}</button>
                    <div className="flex gap-1">
                      <button onClick={prevReplayDay} disabled={replayIndex === 0} className="p-3 hover:bg-stone-800 rounded-xl disabled:opacity-30 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={nextReplayDay} disabled={replayIndex === gameState.history.length - 1} className="p-3 hover:bg-stone-800 rounded-xl disabled:opacity-30 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <button onClick={closeReplay} className="p-3 hover:bg-red-900/40 text-red-400 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                )
              )
              }
              {(!isReplayMode || gameState.status !== GameStatus.WON) && (
                <button onClick={() => resetGame()} className="flex-1 bg-stone-900 border border-stone-800 text-stone-300 py-4 rounded-2xl font-bold shadow-lg hover:bg-stone-800 active:scale-[0.98] transition-all">New Game</button>
              )}
            </div>
          )}
        </div>
      </main >

      {/* 3. Bottom Navigation Bar - Landscape: Move to Side? Or Keep? Keep for now but ensure it doesn't take too much vertical space. */}
      {/* For landscape, maybe we just hide the Label and make it smaller? */}
      <div className="flex-none bg-stone-900 border-t border-stone-800 px-6 py-2 pb-4 safe-area-bottom z-20 flex justify-center shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.2)] landscape:py-1 landscape:pb-1">
        <button
          onClick={() => setActiveTab(activeTab === 'log' ? null : 'log')}
          className={`flex flex-col items-center justify-center gap-1.5 py-2 rounded-2xl transition-all duration-300 px-6 ${activeTab === 'log' ? 'bg-stone-800 text-stone-200 -translate-y-1 shadow-md' : 'text-stone-500 hover:text-stone-400'} landscape:flex-row landscape:py-1`}
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-30 animate-in fade-in duration-300" onClick={() => setActiveTab(null)} />

            {/* Sheet Content */}
            <div className="absolute bottom-0 left-0 right-0 z-40 bg-stone-900 border-t border-stone-800 rounded-t-[2rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 flex flex-col h-[55vh] max-h-[600px] landscape:h-[80vh] landscape:max-w-md landscape:left-auto landscape:right-0 landscape:rounded-l-[2rem] landscape:rounded-t-none landscape:border-l landscape:border-t-0">
              {/* Handle Bar (Hidden in side sheet mode) */}
              <div className="w-full flex justify-center pt-3 pb-1 landscape:hidden" onClick={() => setActiveTab(null)}>
                <div className="w-12 h-1.5 bg-stone-700 rounded-full" />
              </div>

              <div className="flex-none px-6 py-3 border-b border-stone-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-200 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-stone-500" /> Investigation Log
                </h3>
                <button onClick={() => setActiveTab(null)} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors text-stone-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-stone-950/30">
                <Log history={gameState.history} />
              </div>
            </div>
          </>
        )
      }

      {/* Rules Modal Overlay */}
      {
        showRules && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-stone-900 border border-stone-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="bg-orange-700 p-1 text-white relative">
                <button
                  onClick={() => setShowRules(false)}
                  className="absolute top-1 right-4 p-1 hover:bg-orange-600 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
                <div className="flex items-center gap-1 mb-1">
                  <Rabbit size={32} className="text-orange-200" />
                  <h2 className="text-3xl bangers tracking-wide">The Great Chase</h2>
                </div>
                <p className="text-orange-100 font-medium">Can you outsmart the cheeky rabbit?</p>
              </div>

              <div className="p-1 space-y-1">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 w-10 h-10 bg-stone-800 rounded-full flex items-center justify-center text-orange-500">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-200">The Hideout</h3>
                      <p className="text-sm text-stone-400">The rabbit is hiding in one of the holes below. Pick one to inspect each morning.</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-shrink-0 w-10 h-10 bg-stone-800 rounded-full flex items-center justify-center text-orange-500">
                      <Repeat size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-200">The Rabbit's Move</h3>
                      <p className="text-sm text-stone-400">If you miss, the rabbit hops to an <span className="font-bold underline text-stone-300">adjacent</span> hole overnight. It never stays still!</p>
                    </div>
                  </div>

                  <div className="bg-stone-800 p-2 rounded-xl border border-stone-700">
                    <p className="text-xs text-stone-400 leading-relaxed italic">
                      "Finding me takes logic, Fox! Hint: The holes follow a numerical sequence. If I'm in hole 3 today, I'll be in 2 or 4 tomorrow."
                    </p>
                  </div>
                </div>

                <div className="landscape:w-40 landscape:flex landscape:flex-col landscape:gap-2">
                  <button
                    onClick={() => setShowRules(false)}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-2xl shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    <Play size={5} fill="currentColor" />
                    Start Hunting
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Orientation Prompt Overlay */}
      {showRotatePrompt && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <Smartphone className="w-16 h-16 text-stone-600 mb-6 animate-spin-slow" style={{ animationDuration: '3s' }} />
          <h2 className="text-2xl font-bold text-stone-200 mb-2">Please Rotate Your Device</h2>
          <p className="text-stone-500 max-w-xs">We need a bit more space to hunt properly! Switch to landscape mode for the best experience.</p>
        </div>
      )}
    </div>
  );
};

export default App;