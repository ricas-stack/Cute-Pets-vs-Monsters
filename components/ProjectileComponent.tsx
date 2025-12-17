import React from 'react';
import { Projectile } from '../types';

interface ProjectileProps {
  projectile: Projectile;
  cellSize: number;
}

export const ProjectileComponent: React.FC<ProjectileProps> = ({ projectile, cellSize }) => {
  let icon = '🦴';
  let className = 'text-2xl animate-spin';
  
  if (projectile.variant === 'ice') {
      icon = '❄️';
      className += ' brightness-150';
  } else if (projectile.variant === 'fire') {
      icon = '🔥';
      className = 'text-3xl animate-pulse drop-shadow-lg text-orange-500'; // Fire doesn't spin, it pulses
  }

  // Handle flipping for left direction
  const transformStyle = projectile.direction === -1 ? 'scaleX(-1)' : '';

  return (
    <div
      className="absolute z-10 flex items-center justify-center transition-all duration-100"
      style={{
        width: `${cellSize * 0.4}px`,
        height: `${cellSize * 0.4}px`,
        left: `${projectile.x * cellSize + (cellSize * 0.3)}px`,
        top: `${projectile.row * cellSize + (cellSize * 0.3)}px`,
        transform: transformStyle
      }}
    >
      <div className={className}>
        {icon}
      </div>
    </div>
  );
};