
export enum PetType {
  Shooter = 'SHOOTER', // Dog
  Producer = 'PRODUCER', // Cat
  Wall = 'WALL', // Turtle
  Explosive = 'EXPLOSIVE', // Hamster
  Slower = 'SLOWER', // Penguin
  DualShooter = 'DUAL_SHOOTER', // Dragon
}

export enum EnemyType {
  Normal = 'NORMAL', // Slime
  Fast = 'FAST', // Bat
  Tank = 'TANK', // Ogre
}

export interface PetConfig {
  type: PetType;
  name: string;
  cost: number;
  health: number;
  damage: number;
  attackRate: number; // ms between attacks
  description: string;
  icon: string;
  bgGradient: string;
}

export interface Entity {
  id: string;
  row: number;
  col: number; // 0-8 for grid placement, can be float for movement
  health: number;
  maxHealth: number;
  type: PetType | EnemyType;
  isEnemy: boolean;
  lastActionTime: number; // For attack cooldown
  // Enemy specific
  speed?: number; // cells per second
  frozen?: boolean; // Slowed effect
}

export interface Projectile {
  id: string;
  row: number;
  x: number; // Visual X position (relative to grid)
  damage: number;
  variant: 'bone' | 'ice' | 'fire';
  direction: number; // 1 for right, -1 for left
}

export interface SunEntity {
  id: string;
  row: number;
  col: number; // Grid coordinates
  targetRow?: number; // For falling suns (if implemented later)
  targetCol?: number;
  value: number;
  createdAt: number;
}

export interface Explosion {
  id: string;
  row: number;
  col: number;
  createdAt: number;
}

export interface GameState {
  grid: (Entity | null)[][]; // 5 rows x 9 cols, only for pets
  enemies: Entity[];
  projectiles: Projectile[];
  suns: SunEntity[]; // Array of active suns
  explosions: Explosion[]; // Active explosions
  energy: number;
  level: number; // Current Level (1-5)
  timeRemaining: number; // Milliseconds remaining in current level
  score: number;
  status: 'START' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'VICTORY' | 'GAME_OVER';
  message: string;
}

export const ROWS = 5;
export const COLS = 9;
export const CELL_SIZE = 80; // Approximate pixel size for calculations if needed
