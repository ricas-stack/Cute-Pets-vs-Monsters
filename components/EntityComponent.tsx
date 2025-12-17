import React from 'react';
import { Entity, PetType, EnemyType } from '../types';
import { PET_DATA, ENEMY_CONFIG } from '../constants';

interface EntityProps {
  entity: Entity;
  cellSize: number;
}

export const EntityComponent: React.FC<EntityProps> = ({ entity, cellSize }) => {
  let icon = '';
  let bgColor = '';
  let additionalClasses = '';
  
  // Calculate if the entity recently acted (attacked) for animation
  const now = performance.now();
  const isActing = (now - entity.lastActionTime) < 300;

  if (!entity.isEnemy) {
    // It's a Pet
    const config = PET_DATA[entity.type as PetType];
    icon = config.icon;
    bgColor = `bg-gradient-to-br ${config.bgGradient}`;
    additionalClasses = "border-2 border-white/50 shadow-md";
    
    // Attack animation for pets
    if (isActing) {
       if (entity.type === PetType.Wall) {
           // Turtle specific: Rotate and scale (shell defense/attack mode)
           additionalClasses += " rotate-12 scale-110 duration-200 ease-in-out border-green-600";
       } else {
           // Default recoil
           additionalClasses += " scale-110 -translate-y-1 brightness-110 duration-100";
       }
    }
  } else {
    // It's an Enemy
    const config = ENEMY_CONFIG[entity.type as EnemyType];
    icon = config.icon;
    bgColor = "bg-purple-900/40 backdrop-blur-sm";
    additionalClasses = "border-2 border-purple-500 shadow-xl z-20";
    
    // Attack animation for enemies (lunging forward)
    if (isActing) {
      additionalClasses += " -translate-x-2";
    }

    if (entity.frozen) {
      additionalClasses += " saturate-50 brightness-125 sepia-0 hue-rotate-180"; // Ice effect
    }
  }

  // Calculate Health Bar color
  const healthPercent = (entity.health / entity.maxHealth) * 100;
  let healthColor = "bg-green-500";
  if (healthPercent < 60) healthColor = "bg-yellow-400";
  if (healthPercent < 30) healthColor = "bg-red-500";

  return (
    <div
      className={`absolute transition-transform flex flex-col items-center justify-center rounded-xl ${bgColor} ${additionalClasses}`}
      style={{
        width: `${cellSize * 0.85}px`,
        height: `${cellSize * 0.85}px`,
        // If enemy, use absolute X. If pet, use column index.
        left: entity.isEnemy ? `${entity.col * cellSize + (cellSize * 0.075)}px` : `${entity.col * cellSize + (cellSize * 0.075)}px`,
        top: `${entity.row * cellSize + (cellSize * 0.075)}px`,
      }}
    >
      {/* Icon */}
      <span className={`text-4xl select-none ${entity.isEnemy ? 'scale-x-[-1]' : ''} drop-shadow-md`}>
        {icon}
      </span>
      
      {/* Health Bar */}
      <div className="absolute -bottom-2 w-full px-2">
        <div className="w-full h-2 bg-gray-700 rounded-full border border-white/20 overflow-hidden">
          <div 
            className={`h-full ${healthColor} transition-all duration-300`} 
            style={{ width: `${healthPercent}%` }} 
          />
        </div>
      </div>
      
      {/* Frozen Indicator */}
      {entity.frozen && (
        <div className="absolute inset-0 bg-blue-300/30 rounded-xl animate-pulse pointer-events-none" />
      )}
    </div>
  );
};