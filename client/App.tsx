import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Hole } from './components/Hole';

import { GameState, GameStatus, HistoryEntry } from './types';
import { RefreshCw, Trophy, Info, Minus, Plus, X, Play, SkipBack, SkipForward, ChevronLeft, ChevronRight, Pause, Smartphone, Rabbit, MapPin, Repeat, Bug, Sun, Moon, Undo2 } from 'lucide-react';
const App: React.FC = () => {
  const initialHoleCount = 4;

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
  const [foxHole, setFoxHole] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [isClosingRules, setIsClosingRules] = useState(false);
  const [rulesModalStyle, setRulesModalStyle] = useState<React.CSSProperties>({});

  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const rulesModalRef = useRef<HTMLDivElement>(null);

  // Debug Mode
  const [isDebugMode, setIsDebugMode] = useState(true);

  // Day/Night Cycle Phase
  const [phase, setPhase] = useState<'day' | 'sunset' | 'night' | 'sunrise'>('day');

  // Replay State
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const replayTimerRef = useRef<number | null>(null);


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

    // 1. Initial Fox Animation (Movement + Inspection)
    await new Promise(resolve => setTimeout(resolve, 600));

    const { possibleHoles, day, history, candidatesHistory, holeCount } = gameState;
    const isWin = possibleHoles.length === 1 && possibleHoles[0] === targetHole;

    if (isWin) {
      // WIN LOGIC - No Day Cycle needed, just reveal
      const path = backtrackPath(candidatesHistory, history, targetHole);
      const winEntry: HistoryEntry = { day, checkedHoleIndex: targetHole, found: true, remainingPossibilitiesCount: 0 };

      setGameState(prev => ({
        ...prev, status: GameStatus.WON, history: [...prev.history, winEntry], lastCheckedIndex: targetHole, rabbitPath: path
      }));
      setIsProcessing(false);
      setSelectedHole(null);
      return;
    }

    // MISS LOGIC - Trigger Day/Night Cycle
    // Phase 1: Sunset (Day ending)
    setPhase('sunset');
    const afterCheckCandidates = possibleHoles.filter(h => h !== targetHole);
    setGameState(prev => ({ ...prev, possibleHoles: afterCheckCandidates, lastCheckedIndex: null }));
    await new Promise(resolve => setTimeout(resolve, 1500)); // Darkening (Slower)

    // UPDATE STATE: Remove checked hole from possibilities (Visual: Ghost rabbit disappears)
    // AND Close the hole / Remove Fox immediately ("Same Day")
    setSelectedHole(null);
    setFoxHole(null);

    // Phase 2: Night (Rabbit moves)
    setPhase('night');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Rabbit moving (Slower)

    const nextDayCandidatesSet = new Set<number>();
    afterCheckCandidates.forEach(pos => {
      if (pos - 1 >= 0) nextDayCandidatesSet.add(pos - 1);
      if (pos + 1 < holeCount) nextDayCandidatesSet.add(pos + 1);
    });
    const nextPossibleHoles = Array.from(nextDayCandidatesSet).sort((a, b) => a - b);

    const newEntry: HistoryEntry = { day, checkedHoleIndex: targetHole, found: false, remainingPossibilitiesCount: afterCheckCandidates.length };

    // Update Game State (New Day)
    setGameState(prev => ({
      ...prev, day: prev.day + 1, history: [...prev.history, newEntry], possibleHoles: nextPossibleHoles, candidatesHistory: [...prev.candidatesHistory, nextPossibleHoles]
    }));

    // Phase 3: Sunrise
    setPhase('sunrise');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Brightening (Slower)

    // Phase 4: Day (Ready for input)
    setPhase('day');
    setIsProcessing(false);

  }, [selectedHole, gameState, isProcessing]);

  const undoLastMove = useCallback(() => {
    if (gameState.history.length === 0 || isProcessing) return;

    setGameState(prev => {
      const newHistory = prev.history.slice(0, -1);
      const newCandidatesHistory = prev.candidatesHistory.slice(0, -1);
      const previousPossibleHoles = newCandidatesHistory[newCandidatesHistory.length - 1];

      return {
        ...prev,
        day: prev.day - 1,
        history: newHistory,
        possibleHoles: previousPossibleHoles,
        candidatesHistory: newCandidatesHistory,
        status: GameStatus.PLAYING,
        lastCheckedIndex: null,
        rabbitPath: []
      };
    });

    setSelectedHole(null);
    setFoxHole(null);
    setPhase('day');
  }, [gameState.history, isProcessing]);

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
    setFoxHole(null);
    setReplayIndex(null);
    setIsPlayingReplay(false);
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
      }, 2000);
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
    : (selectedHole !== null ? selectedHole : (gameState.lastCheckedIndex !== null ? gameState.lastCheckedIndex : foxHole));
  const showFox = (foxPosition !== null);

  // --- Visual Helpers for Sky ---
  const getSkyClass = () => {
    return 'bg-sky-100'; // Always Day Theme
  };

  const isDay = true;
  const textColor = isDay ? 'text-stone-800' : 'text-stone-200';
  const subTextColor = isDay ? 'text-stone-500' : 'text-stone-400';

  // UI Component Classes
  const headerClass = isDay
    ? 'bg-white/80 border-stone-200 text-stone-800'
    : 'bg-stone-900/60 border-stone-800/50 text-stone-200';

  const bottomNavClass = isDay
    ? 'bg-white border-stone-200 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]'
    : 'bg-stone-900 border-stone-800 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.2)]';

  const navButtonActive = isDay
    ? 'bg-stone-100 text-stone-900 shadow-sm'
    : 'bg-stone-800 text-stone-200 shadow-md';

  return (
    <div className={`h-[100dvh] transition-colors duration-[1500ms] ease-in-out ${textColor} flex flex-col overflow-hidden relative font-sans ${getSkyClass()} `}>

      {/* Dynamic Sky Objects (Sun/Moon) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Sun - Visible in Day, sets in Sunset, rises in Sunrise */}
        <div className={`absolute top-10 right-10 transition-all duration-[1500ms] ease-in-out transform
            ${phase === 'day' ? 'translate-y-0 opacity-100' : ''}
            ${phase === 'sunset' ? 'translate-y-32 opacity-50 contrast-125' : ''}
            ${phase === 'night' ? 'translate-y-96 opacity-0' : ''}
            ${phase === 'sunrise' ? 'translate-y-0 opacity-80' : ''}
        `}>
          <Sun className={`w-24 h-24 ${phase === 'sunset' ? 'text-orange-500' : 'text-amber-400'} filter blur-sm`} />
        </div>

        {/* Moon - Visible in Night */}
        <div className={`absolute top-10 left-10 transition-all duration-[1500ms] ease-in-out transform
            ${phase === 'night' ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0'}
        `}>
          <Moon className="w-16 h-16 text-slate-200 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
        </div>

        {/* Stars (Night Only) */}
        <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${phase === 'night' ? 'opacity-100' : 'opacity-0'} `}>
          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-1/2 left-1/3 w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.8s' }} />
          <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full" />
          <div className="absolute bottom-1/4 right-1/4 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '1.2s' }} />
        </div>
      </div>

      {/* 1. Header (Fixed) */}
      <header className={`flex-none backdrop-blur-md border-b z-10 shadow-sm px-4 h-14 flex items-center justify-between transition-colors duration-1000 ${headerClass}`}>
        <div>
          <h1 className={`text-lg font-bold tracking-tight leading-tight ${isDay ? 'text-stone-800' : 'text-stone-100'}`}>Catch the Rabbit</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Hole Controls moved to Header for Landscape */}
          <div className={`hidden landscape:flex items-center gap-2 mr-4 rounded-lg p-1 border ${isDay ? 'bg-stone-200 border-stone-300' : 'bg-stone-800 border-stone-700'}`}>
            <button onClick={() => changeHoleCount(-1)} disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode} className={`w-6 h-6 flex items-center justify-center rounded disabled:opacity-30 transition-colors ${isDay ? 'bg-stone-300 text-stone-600 hover:bg-stone-400' : 'bg-stone-700 text-stone-400 hover:bg-stone-600'}`}><Minus className="w-3 h-3" /></button>
            <span className={`font-mono font-bold text-sm w-4 text-center ${isDay ? 'text-stone-700' : 'text-stone-300'}`}>{gameState.holeCount}</span>
            <button onClick={() => changeHoleCount(1)} disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode} className={`w-6 h-6 flex items-center justify-center rounded disabled:opacity-30 transition-colors ${isDay ? 'bg-stone-300 text-stone-600 hover:bg-stone-400' : 'bg-stone-700 text-stone-400 hover:bg-stone-600'}`}><Plus className="w-3 h-3" /></button>
          </div>

          <button
            onClick={() => setIsDebugMode(!isDebugMode)}
            className={`p-2 rounded-full transition-all duration-300 ${isDebugMode ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' : (isDay ? 'text-stone-400 hover:text-stone-600 bg-stone-200 hover:bg-stone-300' : 'text-stone-500 hover:text-stone-300 bg-stone-800 hover:bg-stone-700')} `}
            title={isDebugMode ? "Debug Mode Active" : "Enable Debug Mode"}
          >
            <Bug className="w-5 h-5" />
          </button>

          <button ref={infoButtonRef} onClick={() => setShowRules(true)} className={`p-2 rounded-full transition-colors ${isDay ? 'text-stone-400 hover:text-stone-600 bg-stone-200 hover:bg-stone-300' : 'text-stone-500 hover:text-stone-300 bg-stone-800 hover:bg-stone-700'}`}>
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Main Game Area (Flex-Grow) */}
      <main className="flex-1 flex flex-col relative z-10 w-full max-w-4xl mx-auto overflow-hidden landscape:flex-row">

        {/* Top Controls: Hole Count & Restart (Portrait Only) */}
        <div className="flex-none p-4 pb-0 flex items-center justify-between animate-in slide-in-from-top-2 landscape:hidden">
          <div className={`flex items-center gap-3 rounded-2xl p-2 px-4 shadow-sm border ${isDay ? 'bg-white/60 border-stone-200' : 'bg-stone-900/40 border-stone-800/50'}`}>
            <span className={`text-xs font-bold uppercase tracking-wider ${subTextColor}`}>Holes</span>
            <div className="flex items-center gap-3">
              <button onClick={() => changeHoleCount(-1)} disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode} className={`p-1.5 rounded-lg disabled:opacity-30 transition-colors ${isDay ? 'bg-stone-200 text-stone-600 hover:bg-stone-300' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}><Minus className="w-4 h-4" /></button>
              <span className="font-mono font-bold text-lg w-4 text-center">{gameState.holeCount}</span>
              <button onClick={() => changeHoleCount(1)} disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode} className={`p-1.5 rounded-lg disabled:opacity-30 transition-colors ${isDay ? 'bg-stone-200 text-stone-600 hover:bg-stone-300' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={undoLastMove} disabled={gameState.history.length === 0 || isProcessing || isReplayMode} className={`p-2 rounded-xl shadow-lg border hover:scale-105 active:scale-95 disabled:opacity-30 transition-all ${isDay ? 'bg-white/60 border-stone-200 text-stone-600 hover:bg-stone-50' : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'}`} title="Undo Move"><Undo2 className="w-5 h-5" /></button>
            <button onClick={() => resetGame()} disabled={isProcessing} className={`p-2 rounded-xl shadow-lg border hover:bg-stone-800 active:scale-95 disabled:opacity-50 transition-colors ${isDay ? 'bg-white/60 border-stone-200 text-stone-600 hover:bg-stone-50' : 'bg-stone-900/80 backdrop-blur text-stone-500 border-stone-800 hover:text-stone-300'}`} title="Restart Game"><RefreshCw className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Sidebar Controls (Landscape Only) */}
        <div className="hidden landscape:flex flex-col justify-center gap-4 p-4 pr-0 z-20">
          {/* Replay Controls in Sidebar */}
          {gameState.status === GameStatus.WON && (
            isReplayMode ? (
              <div className={`flex flex-col gap-2 border rounded-xl p-2 shadow-xl ${isDay ? 'bg-white border-stone-200 text-stone-800' : 'bg-stone-900 border-stone-800 text-white'}`}>
                <button onClick={toggleAutoReplay} className={`p-3 rounded-lg text-amber-500 transition-colors flex justify-center ${isDay ? 'hover:bg-stone-100' : 'hover:bg-stone-800'}`}>{isPlayingReplay ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}</button>
                <div className="flex flex-col gap-1">
                  <button onClick={prevReplayDay} disabled={replayIndex === 0} className={`p-3 rounded-lg disabled:opacity-30 transition-colors flex justify-center ${isDay ? 'hover:bg-stone-100' : 'hover:bg-stone-800'}`}><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={nextReplayDay} disabled={replayIndex === gameState.history.length - 1} className={`p-3 rounded-lg disabled:opacity-30 transition-colors flex justify-center ${isDay ? 'hover:bg-stone-100' : 'hover:bg-stone-800'}`}><ChevronRight className="w-5 h-5" /></button>
                </div>
                <button onClick={closeReplay} className="p-3 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors flex justify-center"><X className="w-5 h-5" /></button>
              </div>
            ) : (
              <button onClick={startReplay} className="p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-600/20 active:scale-[0.95] transition-all" title="Watch Replay"><Play className="w-5 h-5 fill-current" /></button>
            )
          )}

          {(!isReplayMode || gameState.status !== GameStatus.WON) && (
            <div className="flex flex-col gap-2">
              <button onClick={undoLastMove} disabled={gameState.history.length === 0 || isProcessing || isReplayMode} className={`p-3 rounded-xl shadow-lg border hover:scale-105 active:scale-95 disabled:opacity-30 transition-all ${isDay ? 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50' : 'bg-stone-900 text-stone-500 border-stone-800 hover:bg-stone-800 hover:text-stone-300'}`} title="Undo Move"><Undo2 className="w-5 h-5" /></button>
              <button onClick={() => resetGame()} disabled={isProcessing} className={`p-3 rounded-xl shadow-lg border hover:scale-105 active:scale-95 disabled:opacity-30 transition-all ${isDay ? 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50' : 'bg-stone-900 text-stone-500 border-stone-800 hover:bg-stone-800 hover:text-stone-300'}`} title="New Game"><RefreshCw className="w-5 h-5" /></button>
            </div>
          )}
        </div>


        {/* THE BOARD (Takes up all remaining space, centering content) */}
        <div className="flex-1 flex flex-col justify-center relative min-h-0">
          {/* Holes Container - Scaled to fill width */}
          <div className="w-full overflow-x-auto scrollbar-hide py-32 landscape:pt-24 landscape:pb-24">
            <div className="flex justify-center min-w-full px-6 landscape:px-12">
              <div className="relative flex gap-2 sm:gap-4 md:gap-6">
                {/* Day Counter - Centered above holes */}
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
                  <span className={`text-xs sm:text-sm font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-sm ${isDay ? 'bg-white/90 border-stone-200 text-stone-600' : 'bg-stone-900 border-stone-800 text-stone-400'}`}>
                    {isReplayMode ? `Replay Day ${displayDayNumber}` : `Day ${displayDayNumber}`}
                  </span>
                </div>
                {/* Connector Line */}
                <div className={`absolute top-1/2 left-2 right-2 h-1 -z-10 -translate-y-1/2 rounded-full ${isDay ? 'bg-stone-300' : 'bg-stone-800'}`} />

                {/* Sliding Fox Cursor */}
                {showFox && (
                  <div className="absolute -top-12 left-0 z-20 w-10 h-10 sm:w-16 sm:h-16 flex justify-center transition-transform duration-300 ease-out pointer-events-none" style={{ transform: `translateX(calc(${foxPosition} * (100% + ${window.innerWidth >= 768 ? '1.5rem' : (window.innerWidth >= 640 ? '1rem' : '0.5rem')})))` }}>
                    <div className="text-4xl drop-shadow-md filter">🦊</div>
                  </div>
                )}

                {Array.from({ length: gameState.holeCount }).map((_, i) => {
                  const isChecked = displayCheckedPos === i;
                  const isRabbit = isReplayMode ? displayRabbitPos === i : (gameState.status === GameStatus.WON && gameState.lastCheckedIndex === i);
                  const isSelected = (!isReplayMode && selectedHole === i) || (isReplayMode && displayCheckedPos === i);

                  // Debug Mode: Identify if this hole is possible
                  const isPossible = isDebugMode && !isReplayMode && gameState.possibleHoles.includes(i);

                  // Arrows only show during NIGHT phase (Rabbit moving)
                  const showArrows = isDebugMode && !isReplayMode && phase === 'night' && isPossible;

                  const canJumpLeft = showArrows && i > 0;
                  const canJumpRight = showArrows && i < gameState.holeCount - 1;

                  return (
                    <div key={i} className="flex-shrink-0 relative group">
                      <Hole index={i} isSelected={isSelected} isChecked={isChecked} isRabbit={isRabbit} isPossible={isPossible} gameStatus={gameState.status} onSelect={handleHoleClick} disabled={gameState.status !== GameStatus.PLAYING || isProcessing || isReplayMode} hideFootprints={phase === 'night'} />

                      {/* Jump Indicators (Arrows) - Center to Center Arc */}
                      {isPossible && (
                        <>
                          {/* Left Jump Arrow */}
                          {canJumpLeft && (
                            <div className="absolute top-1/2 right-1/2 z-0 pointer-events-none w-[calc(100%+0.5rem)] sm:w-[calc(100%+1rem)] md:w-[calc(100%+1.5rem)] h-12 sm:h-16">
                              <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none" className="overflow-visible text-indigo-400 opacity-60">
                                <defs>
                                  <marker id="arrowhead-left" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
                                    <path d="M0,0 L6,3 L0,6" fill="currentColor" />
                                  </marker>
                                </defs>
                                {/* Path from Right (100,0) to Left (0,0) with downward arc */}
                                <path d="M 90 10 Q 50 60 5 10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" markerEnd="url(#arrowhead-left)" />
                              </svg>
                            </div>
                          )}

                          {/* Right Jump Arrow */}
                          {canJumpRight && (
                            <div className="absolute top-1/2 left-1/2 z-0 pointer-events-none w-[calc(100%+0.5rem)] sm:w-[calc(100%+1rem)] md:w-[calc(100%+1.5rem)] h-12 sm:h-16">
                              <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none" className="overflow-visible text-indigo-400 opacity-60">
                                <defs>
                                  <marker id="arrowhead-right" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                                    <path d="M0,0 L6,3 L0,6" fill="currentColor" />
                                  </marker>
                                </defs>
                                {/* Path from Left (0,10) to Right (100,10) with downward arc */}
                                <path d="M 0 20 Q 50 70 95 20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" markerEnd="url(#arrowhead-right)" />
                              </svg>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Feedback Text - Floating below board */}
          <div className="text-center h-10 flex items-center justify-center w-full px-4 mt-2">
            {gameState.status === GameStatus.WON ? (
              isReplayMode ? null : (
                <span className="text-emerald-400 font-bold flex items-center gap-2 bg-emerald-950/40 px-5 py-2 rounded-full border border-emerald-900/50 shadow-sm">
                  <Trophy className="w-4 h-4" /> Caught at Hole #{gameState.lastCheckedIndex! + 1}!
                </span>
              )
            ) : (
              // Phase-based Narrative Feedback
              (() => {
                const commonClasses = "font-bold px-5 py-1.5 rounded-full shadow-sm border bg-stone-100/90 border-stone-200 text-stone-600";

                if (phase === 'sunset') return (
                  <span className={`${commonClasses} animate-in fade-in duration-500`}>
                    No rabbit here...
                  </span>
                );
                if (phase === 'night') return (
                  <span className={`${commonClasses}`}>
                    Rabbit is moving to a nearby hole...
                  </span>
                );
                if (phase === 'sunrise') return (
                  <span className={`${commonClasses} animate-in fade-in duration-500`}>
                    Sun is rising... Good luck!
                  </span>
                );
                // Default: Day / Idle
                if (selectedHole !== null) return (
                  <span className={`${commonClasses} backdrop-blur`}>
                    Checking Hole #{selectedHole + 1}
                  </span>
                );
                return null;
              })()
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
                  <div className={`flex-1 flex items-center justify-between border rounded-2xl px-2 shadow-xl ${isDay ? 'bg-white border-stone-200 text-stone-800' : 'bg-stone-900 border-stone-800 text-white'}`}>
                    <button onClick={toggleAutoReplay} className={`p-3 rounded-xl text-amber-500 transition-colors ${isDay ? 'hover:bg-stone-100' : 'hover:bg-stone-800'}`}>{isPlayingReplay ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}</button>
                    <div className="flex gap-1">
                      <button onClick={prevReplayDay} disabled={replayIndex === 0} className={`p-3 rounded-xl disabled:opacity-30 transition-colors ${isDay ? 'hover:bg-stone-100' : 'hover:bg-stone-800'}`}><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={nextReplayDay} disabled={replayIndex === gameState.history.length - 1} className={`p-3 rounded-xl disabled:opacity-30 transition-colors ${isDay ? 'hover:bg-stone-100' : 'hover:bg-stone-800'}`}><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <button onClick={closeReplay} className="p-3 hover:bg-red-900/40 text-red-400 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                )
              )
              }
              {(!isReplayMode || gameState.status !== GameStatus.WON) && (
                <button onClick={() => resetGame()} className={`flex-1 border py-4 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all ${isDay ? 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50' : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'}`}>New Game</button>
              )}
            </div>
          )}
        </div>
      </main >


      {/* Rules Modal Overlay */}
      {
        (showRules || isClosingRules) && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${isClosingRules ? 'opacity-0' : 'opacity-100'}`}>
            <div
              ref={rulesModalRef}
              style={rulesModalStyle}
              className={`border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transition-all duration-700 ease-in-out ${!isClosingRules ? 'animate-in fade-in zoom-in duration-300' : ''} ${isDay ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'}`}
            >
              <div className={`p-1 text-white relative transition-colors ${isDay ? 'bg-sky-500' : 'bg-orange-700'}`}>
                <button
                  onClick={() => setShowRules(false)}
                  className={`absolute top-1 right-4 p-1 rounded-full transition-colors ${isDay ? 'hover:bg-sky-400' : 'hover:bg-orange-600'}`}
                >
                  <X size={24} />
                </button>
                <div className="flex items-center gap-1 mb-1">
                  <Rabbit size={32} className={isDay ? 'text-sky-100' : 'text-orange-200'} />
                  <h2 className="text-3xl bangers tracking-wide">The Great Chase</h2>
                </div>
                <p className={`font-medium ${isDay ? 'text-sky-100' : 'text-orange-100'}`}>Can you outsmart the cheeky rabbit?</p>
              </div>

              <div className="p-1 space-y-1">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isDay ? 'bg-stone-100 text-sky-600' : 'bg-stone-800 text-orange-500'}`}>
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h3 className={`font-bold ${isDay ? 'text-stone-800' : 'text-stone-200'}`}>The Hideout</h3>
                      <p className={`text-sm ${isDay ? 'text-stone-600' : 'text-stone-400'}`}>The rabbit is hiding in one of the holes below. Pick one to inspect each morning.</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isDay ? 'bg-stone-100 text-sky-600' : 'bg-stone-800 text-orange-500'}`}>
                      <Repeat size={20} />
                    </div>
                    <div>
                      <h3 className={`font-bold ${isDay ? 'text-stone-800' : 'text-stone-200'}`}>The Rabbit's Move</h3>
                      <p className={`text-sm ${isDay ? 'text-stone-600' : 'text-stone-400'}`}>If you miss, the rabbit hops to an <span className={`font-bold underline ${isDay ? 'text-stone-700' : 'text-stone-300'}`}>adjacent</span> hole overnight. It never stays still!</p>
                    </div>
                  </div>

                  <div className={`p-2 rounded-xl border ${isDay ? 'bg-stone-50 border-stone-200' : 'bg-stone-800 border-stone-700'}`}>
                    <p className={`text-xs leading-relaxed italic ${isDay ? 'text-stone-500' : 'text-stone-400'}`}>
                      "Finding me takes logic, Fox! Hint: The holes follow a numerical sequence. If I'm in hole 3 today, I'll be in 2 or 4 tomorrow."
                    </p>
                  </div>
                </div>

                <div className="landscape:w-40 landscape:flex landscape:flex-col landscape:gap-2">
                  <button
                    onClick={() => {
                      if (!rulesModalRef.current || !infoButtonRef.current) {
                        setShowRules(false);
                        return;
                      }

                      const modalRect = rulesModalRef.current.getBoundingClientRect();
                      const buttonRect = infoButtonRef.current.getBoundingClientRect();

                      // Calculate center points
                      const modalCenterX = modalRect.left + modalRect.width / 2;
                      const modalCenterY = modalRect.top + modalRect.height / 2;
                      const buttonCenterX = buttonRect.left + buttonRect.width / 2;
                      const buttonCenterY = buttonRect.top + buttonRect.height / 2;

                      const translateX = buttonCenterX - modalCenterX;
                      const translateY = buttonCenterY - modalCenterY;
                      const scale = 0.1;

                      setRulesModalStyle({
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                        opacity: 0,
                      });
                      setIsClosingRules(true);
                      setShowRules(false);

                      setTimeout(() => {
                        setIsClosingRules(false);
                        setRulesModalStyle({});
                      }, 700);
                    }}
                    className={`w-full text-white font-bold py-2 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 ${isDay ? 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/20' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'}`}
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