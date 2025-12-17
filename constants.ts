import { PetType, PetConfig, EnemyType } from './types';

export const PET_DATA: Record<PetType, PetConfig> = {
  [PetType.Shooter]: {
    type: PetType.Shooter,
    name: "旺财 (Wong)",
    cost: 100,
    health: 100,
    damage: 25, // Cost 100 -> Higher damage than 50 cost pets
    attackRate: 1500,
    description: "发射骨头攻击敌人",
    icon: "🐶",
    bgGradient: "from-orange-300 to-yellow-200"
  },
  [PetType.Producer]: {
    type: PetType.Producer,
    name: "咪咪 (Mimi)",
    cost: 50,
    health: 80,
    damage: 10, // Cost 50 -> Baseline damage
    attackRate: 2000, 
    description: "收集阳光并进行远程攻击",
    icon: "🐱",
    bgGradient: "from-pink-300 to-rose-200"
  },
  [PetType.Wall]: {
    type: PetType.Wall,
    name: "铁壳 (Shelly)",
    cost: 50,
    health: 400,
    damage: 10, // Cost 50 -> Baseline damage
    attackRate: 3000,
    description: "坚硬的外壳，能发射小石子",
    icon: "🐢",
    bgGradient: "from-green-400 to-emerald-200"
  },
  [PetType.DualShooter]: {
    type: PetType.DualShooter,
    name: "龙龙 (Drago)",
    cost: 200,
    health: 120,
    damage: 25, 
    attackRate: 1500,
    description: "向左右两边喷射火焰",
    icon: "🐲",
    bgGradient: "from-indigo-400 to-purple-300"
  },
  [PetType.Slower]: {
    type: PetType.Slower,
    name: "冰冰 (Icy)",
    cost: 175,
    health: 100,
    damage: 30, // Cost 175 -> Highest sustained damage + slow
    attackRate: 1500,
    description: "发射冰球减速敌人",
    icon: "🐧",
    bgGradient: "from-cyan-300 to-blue-200"
  },
  [PetType.Explosive]: {
    type: PetType.Explosive,
    name: "爆爆 (Boom)",
    cost: 150,
    health: 50,
    damage: 300, // Cost 150 -> Massive burst damage
    attackRate: 0, // Explodes on contact (passive)
    description: "接触敌人时发生爆炸",
    icon: "🐹",
    bgGradient: "from-red-400 to-orange-300"
  },
};

export const ENEMY_CONFIG: Record<EnemyType, { health: number; speed: number; damage: number; icon: string }> = {
  [EnemyType.Normal]: { health: 100, speed: 0.5, damage: 14, icon: "👾" }, // Reduced from 16
  [EnemyType.Fast]: { health: 60, speed: 1.2, damage: 7, icon: "🦇" }, // Reduced from 8
  [EnemyType.Tank]: { health: 300, speed: 0.2, damage: 29, icon: "👹" }, // Reduced from 32
};

export const INITIAL_ENERGY = 150;
export const ENERGY_DROP_VALUE = 50;
export const GAME_TICK_MS = 50;
export const SUN_LIFETIME_MS = 8000;
export const SUN_SCORE_VALUE = 50; 
export const SUN_SPAWN_MIN_MS = 2904; // Increased by 10% (was 2640)
export const SUN_SPAWN_MAX_MS = 4840; // Increased by 10% (was 4400)

// Level Settings
export const LEVEL_DURATION_MS = 3 * 60 * 1000; // 3 minutes
export const MAX_LEVELS = 5;
export const SPEED_INCREMENT = 0.05; // 5% increase per level