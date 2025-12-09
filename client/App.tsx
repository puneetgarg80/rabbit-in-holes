import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Hole } from './components/Hole';
import { Log } from './components/Log';

import { GameState, GameStatus, HistoryEntry } from './types';
import { RefreshCw, Trophy, Info, Minus, Plus, X, Play, SkipBack, SkipForward, ChevronLeft, ChevronRight, Pause, ClipboardList } from 'lucide-react';

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
  const handleCheckHole = useCallback(async () => {
    if (selectedHole === null || gameState.status !== GameStatus.PLAYING || isProcessing) return;

    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const { possibleHoles, day, history, candidatesHistory, holeCount } = gameState;
    const isWin = possibleHoles.length === 1 && possibleHoles[0] === selectedHole;

    if (isWin) {
      const path = backtrackPath(candidatesHistory, history, selectedHole);
      const winEntry: HistoryEntry = { day, checkedHoleIndex: selectedHole, found: true, remainingPossibilitiesCount: 0 };

      setGameState(prev => ({
        ...prev, status: GameStatus.WON, history: [...prev.history, winEntry], lastCheckedIndex: selectedHole, rabbitPath: path
      }));
      setIsProcessing(false);
      setSelectedHole(null);
      return;
    }

    const afterCheckCandidates = possibleHoles.filter(h => h !== selectedHole);
    const nextDayCandidatesSet = new Set<number>();
    afterCheckCandidates.forEach(pos => {
      if (pos - 1 >= 0) nextDayCandidatesSet.add(pos - 1);
      if (pos + 1 < holeCount) nextDayCandidatesSet.add(pos + 1);
    });
    const nextPossibleHoles = Array.from(nextDayCandidatesSet).sort((a, b) => a - b);

    const newEntry: HistoryEntry = { day, checkedHoleIndex: selectedHole, found: false, remainingPossibilitiesCount: afterCheckCandidates.length };

    setGameState(prev => ({
      ...prev, day: prev.day + 1, history: [...prev.history, newEntry], possibleHoles: nextPossibleHoles, candidatesHistory: [...prev.candidatesHistory, nextPossibleHoles], lastCheckedIndex: selectedHole
    }));

    setIsProcessing(false);
    setSelectedHole(null);
  }, [selectedHole, gameState, isProcessing]);


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
  const foxPosition = isReplayMode ? displayCheckedPos : selectedHole;
  const showFox = (gameState.status === GameStatus.PLAYING && selectedHole !== null) || (isReplayMode && foxPosition !== null);

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
        <button onClick={() => setShowRules(true)} className="p-2 text-stone-400 hover:text-stone-600 bg-stone-50 rounded-full">
          <Info className="w-5 h-5" />
        </button>
      </header>

      {/* 2. Main Game Area (Flex-Grow) */}
      <main className="flex-1 flex flex-col relative w-full max-w-lg mx-auto overflow-hidden">

        {/* Top Controls: Hole Count & Restart */}
        <div className="flex-none p-4 pb-0 flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow-sm border border-stone-200">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Holes</span>
            <button onClick={() => changeHoleCount(-1)} disabled={gameState.holeCount <= 3 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded text-stone-600 disabled:opacity-30 hover:bg-stone-200 transition-colors"><Minus className="w-3 h-3" /></button>
            <span className="font-mono font-bold text-lg text-stone-800 w-4 text-center">{gameState.holeCount}</span>
            <button onClick={() => changeHoleCount(1)} disabled={gameState.holeCount >= 10 || isProcessing || isReplayMode} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded text-stone-600 disabled:opacity-30 hover:bg-stone-200 transition-colors"><Plus className="w-3 h-3" /></button>
          </div>
          <button onClick={() => resetGame()} disabled={isProcessing} className="p-2 bg-white/80 backdrop-blur text-stone-500 rounded-xl shadow-sm border border-stone-200 hover:bg-white active:scale-95 disabled:opacity-50 hover:text-stone-800 transition-colors"><RefreshCw className="w-5 h-5" /></button>
        </div>

        {/* THE BOARD (Takes up all remaining space, centering content) */}
        <div className="flex-1 flex flex-col justify-center relative min-h-0">
          {/* Holes Container - Scaled to fill width */}
          <div className="w-full overflow-x-auto scrollbar-hide py-20">
            <div className="flex justify-center min-w-full px-6">
              <div className="relative flex gap-2 sm:gap-4">
                {/* Connector Line */}
                <div className="absolute top-1/2 left-2 right-2 h-1 bg-stone-300 -z-10 -translate-y-1/2 rounded-full" />

                {/* Sliding Fox Cursor */}
                {showFox && foxPosition !== null && (
                  <div className="absolute -top-12 left-0 z-20 w-10 h-10 sm:w-16 sm:h-16 flex justify-center transition-transform duration-300 ease-out pointer-events-none" style={{ transform: `translateX(calc(${foxPosition} * (100% + ${window.innerWidth >= 640 ? '1rem' : '0.5rem'})))` }}>
                    <div className="text-4xl animate-bounce drop-shadow-md filter">🦊</div>
                  </div>
                )}

                {Array.from({ length: gameState.holeCount }).map((_, i) => {
                  const isChecked = displayCheckedPos === i;
                  const isRabbit = isReplayMode ? displayRabbitPos === i : (gameState.status === GameStatus.WON && gameState.lastCheckedIndex === i);
                  const isSelected = (!isReplayMode && selectedHole === i) || (isReplayMode && displayCheckedPos === i);
                  return (
                    <div key={i} className="flex-shrink-0 relative">
                      <Hole index={i} isSelected={isSelected} isChecked={isChecked} isRabbit={isRabbit} gameStatus={gameState.status} onSelect={setSelectedHole} disabled={gameState.status !== GameStatus.PLAYING || isProcessing || isReplayMode} />
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
                Inspect Hole #{selectedHole + 1}?
              </span>
            ) : (
              <span className="text-stone-500 text-sm font-medium bg-stone-200/50 px-4 py-1.5 rounded-full">
                {currentPossibilities} possibilities remaining
              </span>
            )}
          </div>
        </div>

        {/* Bottom Action Area (Fixed within Main) */}
        <div className="flex-none p-4 pt-0">
          {gameState.status === GameStatus.PLAYING ? (
            <button onClick={handleCheckHole} disabled={selectedHole === null || isProcessing} className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all transform active:scale-[0.98] ${selectedHole !== null && !isProcessing ? 'bg-stone-900 text-white shadow-stone-900/20 hover:bg-stone-800' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}>
              {isProcessing ? 'Checking...' : 'Inspect Hole'}
            </button>
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
              )}
              {(!isReplayMode || gameState.status !== GameStatus.WON) && (
                <button onClick={() => resetGame()} className="flex-1 bg-white border border-stone-200 text-stone-800 py-4 rounded-2xl font-bold shadow-sm hover:bg-stone-50 active:scale-[0.98] transition-all">New Game</button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 3. Bottom Navigation Bar */}
      <div className="flex-none bg-white border-t border-stone-200 px-6 py-2 pb-4 safe-area-bottom z-20 flex justify-center shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => setActiveTab(activeTab === 'log' ? null : 'log')}
          className={`flex flex-col items-center justify-center gap-1.5 py-2 rounded-2xl transition-all duration-300 px-6 ${activeTab === 'log' ? 'bg-stone-100 text-stone-900 -translate-y-1' : 'text-stone-400 hover:text-stone-600'}`}
        >
          <ClipboardList className={`w-6 h-6 ${activeTab === 'log' ? 'stroke-2' : 'stroke-1.5'}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Log</span>
        </button>
      </div>

      {/* 4. Bottom Sheet Overlay (Drawer) */}
      {activeTab && (
        <>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-[2px] z-30 animate-in fade-in duration-300" onClick={() => setActiveTab(null)} />

          {/* Sheet Content */}
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-[2rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300 flex flex-col h-[55vh] max-h-[600px]">
            {/* Handle Bar */}
            <div className="w-full flex justify-center pt-3 pb-1" onClick={() => setActiveTab(null)}>
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
      )}

      {/* Rules Modal Overlay */}
      {showRules && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-5 border border-white/50">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-stone-800 tracking-tight">Fox & Rabbit Rules</h3>
              <button onClick={() => setShowRules(false)} className="text-stone-400 hover:text-stone-600 p-1"><X className="w-6 h-6" /></button>
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
            <button onClick={() => setShowRules(false)} className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-transform active:scale-[0.98] shadow-xl shadow-stone-900/20">Let's Hunt</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;