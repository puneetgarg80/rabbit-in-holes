import React from 'react';
import { GameStatus } from '../types';
import { Rabbit } from 'lucide-react';

interface HoleProps {
  index: number;
  isSelected: boolean;
  isChecked: boolean;
  isRabbit: boolean;
  isPossible?: boolean;
  gameStatus: GameStatus;
  onSelect: (index: number) => void;
  disabled: boolean;
  hideFootprints?: boolean;
}

export const Hole: React.FC<HoleProps> = ({
  index,
  isSelected,
  isChecked,
  isRabbit,
  isPossible,
  gameStatus,
  onSelect,
  disabled,
  hideFootprints
}) => {
  // Styles based on state
  // Resized: w-10 h-10 (40px) default, sm:w-16 sm:h-16
  const baseClasses = "relative w-10 h-10 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-4 transition-all duration-300 transform";

  let stateClasses = "bg-stone-800 border-stone-700 shadow-inner"; // Default dark hole
  let icon = null;

  // Logic: 
  // 1. If Game is Won and this hole has the rabbit:
  //    - If also Checked: CAUGHT (Green)
  //    - If NOT Checked: REVEALED (Grey/Ghost) - used in replay
  // 2. If Selected: Highlight for potential check (Playing) or past check (Replay)
  // 3. If Checked (and empty): Footprints

  if (gameStatus === GameStatus.WON && isRabbit) {
    if (isChecked) {
      // Caught!
      stateClasses = "bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-110 z-10";
      icon = <Rabbit className="text-white w-6 h-6 sm:w-10 sm:h-10" />;
    } else {
      // Revealed but not checked (Replay mode or Debug)
      stateClasses = "bg-stone-700 border-stone-600 opacity-90";
      icon = <Rabbit className="text-stone-500 w-6 h-6 sm:w-10 sm:h-10 opacity-75" />;
    }
  } else if (isSelected) {
    // Selected to be checked (Active or Replay History)
    stateClasses = "bg-stone-800 border-amber-500 scale-105 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10";
    // Pulse only if actively playing, not during replay
    // const pulseClass = gameStatus === GameStatus.PLAYING ? 'animate-pulse' : '';
    // icon = <PawPrint className={`text-amber-500 w-5 h-5 sm:w-8 sm:h-8 ${pulseClass}`} />;
  } else if (isChecked) {
    // Checked and empty
    stateClasses = "bg-stone-900 border-stone-800 opacity-60"; // Darker, cleaner empty state
    // if (!hideFootprints) {
    //   icon = <Footprints className="text-stone-600 w-5 h-5 sm:w-8 sm:h-8 rotate-12 opacity-50" />;
    // }
  }
  // isPossible logic moved to separate element outside button loop or absolute positioned overlay


  return (
    <button
      onClick={() => onSelect(index)}
      disabled={disabled}
      className={`${baseClasses} ${stateClasses} ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
      aria-label={`Hole ${index + 1}`}
    >
      {/* Hole Number Label - At bottom */}
      <span className="absolute -bottom-6 text-stone-500 text-xs font-bold font-mono">#{index + 1}</span>

      {icon}

      {/* Dark overlay for depth if just a normal hole */}
      {!isChecked && !isSelected && !(gameStatus === GameStatus.WON && isRabbit) && (
        <div className="absolute inset-2 bg-black opacity-30 rounded-full blur-sm pointer-events-none" />
      )}

      {/* Debug Mode: Faded "Ghost" Rabbit below the hole */}
      {/* {isPossible && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 pointer-events-none animate-pulse opacity-50">
          <Rabbit className="w-8 h-8 text-indigo-400 opacity-60" />
        </div>
      )} */}
    </button>
  );
};