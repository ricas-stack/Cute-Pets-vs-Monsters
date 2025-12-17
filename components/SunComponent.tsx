import React from 'react';
import { SunEntity } from '../types';
import { Sun } from 'lucide-react';

interface SunComponentProps {
  sun: SunEntity;
  cellSize: number;
  onClick: (id: string) => void;
}

export const SunComponent: React.FC<SunComponentProps> = ({ sun, cellSize, onClick }) => {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation(); // Prevent triggering cell click
        onClick(sun.id);
      }}
      className="absolute cursor-pointer z-30 animate-bounce-gentle hover:scale-110 transition-transform active:scale-95"
      style={{
        width: `${cellSize * 0.6}px`,
        height: `${cellSize * 0.6}px`,
        left: `${sun.col * cellSize + (cellSize * 0.2)}px`,
        top: `${sun.row * cellSize + (cellSize * 0.1)}px`, // Slightly above center
      }}
    >
      <div className="relative w-full h-full">
         <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-50 animate-pulse"></div>
         <div className="relative w-full h-full bg-yellow-300 rounded-full border-2 border-yellow-100 shadow-lg flex items-center justify-center text-yellow-700">
            <Sun className="w-2/3 h-2/3 fill-yellow-500 animate-[spin_10s_linear_infinite]" />
         </div>
      </div>
    </div>
  );
};