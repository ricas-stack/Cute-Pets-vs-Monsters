import React from 'react';
import { Explosion } from '../types';

interface ExplosionProps {
  explosion: Explosion;
  cellSize: number;
}

export const ExplosionComponent: React.FC<ExplosionProps> = ({ explosion, cellSize }) => {
  return (
    <div
      className="absolute z-40 pointer-events-none flex items-center justify-center"
      style={{
        width: cellSize,
        height: cellSize,
        left: explosion.col * cellSize,
        top: explosion.row * cellSize,
        animation: 'popIn 0.5s ease-out forwards'
      }}
    >
      <div className="text-6xl drop-shadow-2xl animate-pulse">💥</div>
      <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping"></div>
    </div>
  );
};