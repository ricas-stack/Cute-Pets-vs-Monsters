import React from 'react';
import { PetType } from '../types';
import { PET_DATA } from '../constants';

interface PetSelectorProps {
  energy: number;
  selectedPet: PetType | null;
  onSelect: (type: PetType) => void;
}

export const PetSelector: React.FC<PetSelectorProps> = ({ energy, selectedPet, onSelect }) => {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-xl border-2 border-blue-100 flex flex-row lg:flex-col gap-3 justify-center items-center h-auto lg:h-full lg:w-32 overflow-x-auto lg:overflow-visible">
      
      <div className="hidden lg:block text-center mb-2">
        <h3 className="font-bold text-gray-700 text-sm">伙伴</h3>
        <p className="text-xs text-gray-500">点击选择</p>
      </div>

      {Object.values(PET_DATA).map((pet) => {
        const canAfford = energy >= pet.cost;
        const isSelected = selectedPet === pet.type;
        
        return (
          <button
            key={pet.type}
            onClick={() => canAfford && onSelect(pet.type)}
            disabled={!canAfford}
            className={`
              relative flex-shrink-0 w-16 h-20 lg:w-24 lg:h-24 rounded-xl flex flex-col items-center justify-center transition-all duration-200
              ${isSelected ? 'ring-4 ring-yellow-400 scale-110 z-10' : 'hover:scale-105'}
              ${canAfford ? 'bg-white cursor-pointer shadow-md' : 'bg-gray-200 opacity-60 cursor-not-allowed grayscale'}
              border-2 ${isSelected ? 'border-yellow-400' : 'border-gray-200'}
            `}
          >
            <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center bg-gradient-to-br ${pet.bgGradient} text-2xl lg:text-3xl mb-1`}>
              {pet.icon}
            </div>
            <span className="text-xs font-bold text-gray-700">{pet.cost}⚡</span>
            
            {/* Tooltip on hover (desktop only) */}
            <div className="hidden lg:group-hover:block absolute left-full ml-2 w-40 bg-gray-800 text-white text-xs p-2 rounded z-50 pointer-events-none">
              <p className="font-bold text-yellow-300">{pet.name}</p>
              <p>{pet.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};