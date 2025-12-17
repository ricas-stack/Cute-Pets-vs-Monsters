import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ROWS, COLS, GameState, Entity, PetType, EnemyType, Projectile, SunEntity, Explosion } from './types';
import { PET_DATA, ENEMY_CONFIG, INITIAL_ENERGY as INIT_ENERGY_CONST, GAME_TICK_MS, ENERGY_DROP_VALUE, SUN_LIFETIME_MS, SUN_SCORE_VALUE, SUN_SPAWN_MIN_MS, SUN_SPAWN_MAX_MS, LEVEL_DURATION_MS, MAX_LEVELS, SPEED_INCREMENT } from './constants';
import { Button } from './components/Button';
import { EntityComponent } from './components/EntityComponent';
import { ProjectileComponent } from './components/ProjectileComponent';
import { SunComponent } from './components/SunComponent';
import { ExplosionComponent } from './components/ExplosionComponent';
import { PetSelector } from './components/PetSelector';
import { Star, Clock, Trophy, Target, Pause, Play } from 'lucide-react';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    grid: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)),
    enemies: [],
    projectiles: [],
    suns: [],
    explosions: [],
    energy: INIT_ENERGY_CONST,
    level: 1,
    timeRemaining: LEVEL_DURATION_MS,
    score: 0,
    status: 'START',
    message: '准备好了吗？'
  });

  const [selectedPet, setSelectedPet] = useState<PetType | null>(null);
  
  // Refs for mutable state in the game loop to avoid stale closures
  const stateRef = useRef(gameState);
  const lastSpawnTime = useRef(0);
  const lastGlobalSunSpawnTime = useRef(0);
  const nextGlobalSunInterval = useRef(2904); // Initial 2.904s wait
  const lastTickTime = useRef(0);
  const pauseStartTime = useRef(0); // Track when pause started
  const animationFrameId = useRef<number>(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(80);

  // Sync ref with state
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Handle Resize for Cell Size
  useEffect(() => {
    const handleResize = () => {
      if (boardRef.current) {
        // Calculate cell size based on container width, max 90px
        const width = boardRef.current.clientWidth;
        const calculated = Math.min(90, width / COLS);
        setCellSize(calculated);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Game Loop
  const gameLoop = useCallback((timestamp: number) => {
    if (stateRef.current.status !== 'PLAYING') {
       animationFrameId.current = requestAnimationFrame(gameLoop);
       return;
    }

    const deltaTime = timestamp - lastTickTime.current;
    
    if (deltaTime >= GAME_TICK_MS) {
      lastTickTime.current = timestamp;
      updateGameLogic(timestamp, deltaTime);
    }
    
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, []);

  // Start/Stop Loop
  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameLoop]);

  const updateGameLogic = (now: number, deltaTime: number) => {
    const currentState = stateRef.current;
    let { grid, enemies, projectiles, suns, explosions, energy, score, status, level, timeRemaining } = currentState;
    let nextGrid = grid.map(row => [...row]);
    let nextEnemies = [...enemies];
    let nextProjectiles = [...projectiles];
    let nextSuns = [...suns];
    let nextExplosions = [...explosions];
    let nextEnergy = energy;
    let nextScore = score;
    let nextStatus = status;
    let nextTimeRemaining = timeRemaining - deltaTime;

    // --- 0. Level/Timer Logic ---
    if (nextTimeRemaining <= 0) {
        nextTimeRemaining = 0;
        if (level >= MAX_LEVELS) {
            nextStatus = 'VICTORY';
        } else {
            nextStatus = 'LEVEL_COMPLETE';
        }
    }

    // --- 1. Spawn Enemies ---
    // Only spawn if level is running
    if (nextStatus === 'PLAYING') {
        const spawnRate = Math.max(1000, 5000 - ((level - 1) * 800)); 
        if (now - lastSpawnTime.current > spawnRate) {
            const randomRow = Math.floor(Math.random() * ROWS);
            const types = [EnemyType.Normal];
            if (level > 1) types.push(EnemyType.Fast);
            if (level > 2) types.push(EnemyType.Tank);
            const randomType = types[Math.floor(Math.random() * types.length)];
            
            const config = ENEMY_CONFIG[randomType];
            
            const newEnemy: Entity = {
                id: `enemy-${now}`,
                row: randomRow,
                col: COLS - 1,
                health: config.health,
                maxHealth: config.health,
                type: randomType,
                isEnemy: true,
                lastActionTime: 0,
                speed: config.speed,
            };
            nextEnemies.push(newEnemy);
            lastSpawnTime.current = now;
        }
    }

    // --- 2. Update Enemies (Movement & Attack) ---
    const levelSpeedMultiplier = 1 + ((level - 1) * SPEED_INCREMENT); // Increase 5% per level

    nextEnemies = nextEnemies.map(enemy => {
      let movedEnemy = { ...enemy };
      
      const currentGridCol = Math.floor(movedEnemy.col);
      const petInCell = nextGrid[movedEnemy.row][currentGridCol];
      
      if (petInCell && Math.abs(movedEnemy.col - currentGridCol) < 0.5) {
        if (now - movedEnemy.lastActionTime > 1000) { 
            const pet = { ...petInCell }; // Clone pet data
            pet.health -= ENEMY_CONFIG[movedEnemy.type as EnemyType].damage;
            movedEnemy.lastActionTime = now;
            
            if (pet.health <= 0) {
                if (pet.type === PetType.Explosive) {
                    // BOOM! Damage enemy using the updated damage value
                    movedEnemy.health -= PET_DATA[PetType.Explosive].damage;
                    
                    // Trigger Explosion Visual
                    nextExplosions.push({
                        id: `exp-${now}-${movedEnemy.row}-${currentGridCol}`,
                        row: movedEnemy.row,
                        col: currentGridCol,
                        createdAt: now
                    });
                }
                nextGrid[movedEnemy.row][currentGridCol] = null;
            } else {
                nextGrid[movedEnemy.row][currentGridCol] = pet;
            }
        }
      } else {
        const freezeMultiplier = movedEnemy.frozen ? 0.5 : 1;
        // Apply level multiplier here
        const moveAmount = (movedEnemy.speed! * levelSpeedMultiplier * freezeMultiplier * (GAME_TICK_MS / 1000));
        movedEnemy.col -= moveAmount;
      }
      return movedEnemy;
    }).filter(e => e.health > 0);

    if (nextEnemies.some(e => e.col < 0)) {
        nextStatus = 'GAME_OVER';
    }

    // --- 3. Global Sun Spawning (Randomly on pets) ---
    const allPets = nextGrid.flat().filter(p => p !== null) as Entity[];
    
    // Check if we have pets. If not, reset the timer to NOW, so the interval countdown 
    // only effectively starts ticking once a pet is placed.
    if (allPets.length === 0) {
        lastGlobalSunSpawnTime.current = now;
    } else {
        // Pets exist, check if it's time to spawn
        if (now - lastGlobalSunSpawnTime.current > nextGlobalSunInterval.current) {
            const randomPet = allPets[Math.floor(Math.random() * allPets.length)];
            nextSuns.push({
                id: `sun-${now}-${randomPet.row}-${randomPet.col}`,
                row: randomPet.row,
                col: randomPet.col,
                value: ENERGY_DROP_VALUE,
                createdAt: now
            });
            // Reset timer
            lastGlobalSunSpawnTime.current = now;
            // Set next interval to random
            nextGlobalSunInterval.current = Math.floor(Math.random() * (SUN_SPAWN_MAX_MS - SUN_SPAWN_MIN_MS + 1)) + SUN_SPAWN_MIN_MS;
        }
    }

    // --- 4. Update Pets (Shooting Logic) ---
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let pet = nextGrid[r][c]; // Get reference
        if (!pet) continue;
        
        const petConfig = PET_DATA[pet.type as PetType];

        // Check if pet can shoot (has damage > 0 and not explosive type which is passive)
        if (petConfig.damage > 0 && pet.type !== PetType.Explosive) {
             if (now - pet.lastActionTime > petConfig.attackRate) {
                 let didShoot = false;

                 // Logic for normal pets (shoot right)
                 const enemiesRight = nextEnemies.some(e => e.row === r && e.col > c);
                 
                 // Logic for DualShooter
                 const isDual = pet.type === PetType.DualShooter;
                 const enemiesLeft = nextEnemies.some(e => e.row === r && e.col < c);

                 if (enemiesRight || (isDual && enemiesLeft)) {
                     // Determine projectile variant
                     let variant: 'bone' | 'ice' | 'fire' = 'bone';
                     if (pet.type === PetType.Slower) variant = 'ice';
                     if (pet.type === PetType.DualShooter) variant = 'fire';
                     if (pet.type === PetType.Wall) variant = 'bone'; // Wall shoots stones/bones

                     // Shoot Right
                     if (enemiesRight || (isDual && !enemiesLeft)) { // Shoot right if enemy there, or dual default
                        nextProjectiles.push({
                            id: `proj-${now}-${r}-${c}-R`,
                            row: r,
                            x: c + 0.5,
                            damage: petConfig.damage,
                            variant: variant,
                            direction: 1
                        });
                        didShoot = true;
                     }

                     // Shoot Left (only DualShooter)
                     if (isDual && enemiesLeft) {
                        nextProjectiles.push({
                            id: `proj-${now}-${r}-${c}-L`,
                            row: r,
                            x: c - 0.5,
                            damage: petConfig.damage,
                            variant: variant,
                            direction: -1
                        });
                        didShoot = true;
                     }

                     if (didShoot) {
                        pet = { ...pet, lastActionTime: now };
                        nextGrid[r][c] = pet;
                     }
                 }
             }
        }
      }
    }

    // --- 5. Update Projectiles ---
    const projectileSpeed = 6; 
    const moveProjBase = projectileSpeed * (GAME_TICK_MS / 1000);
    let activeProjectiles: Projectile[] = [];
    
    nextProjectiles.forEach(p => {
        let currentP = { ...p };
        currentP.x += moveProjBase * currentP.direction;
        
        let hit = false;
        for (let i = 0; i < nextEnemies.length; i++) {
            const enemy = nextEnemies[i];
            // Check collision. Since projectile can move left, we just check overlap distance
            if (enemy.row === currentP.row && Math.abs(enemy.col - currentP.x) < 0.5) {
                enemy.health -= currentP.damage;
                if (currentP.variant === 'ice') enemy.frozen = true;
                hit = true;
                break; 
            }
        }
        
        // Keep projectile if it hasn't hit and is inside bounds
        if (!hit && currentP.x >= 0 && currentP.x < COLS) {
            activeProjectiles.push(currentP);
        }
    });
    
    nextProjectiles = activeProjectiles;

    // --- 6. Cleanup Suns & Explosions ---
    nextSuns = nextSuns.filter(s => now - s.createdAt < SUN_LIFETIME_MS);
    nextExplosions = nextExplosions.filter(e => now - e.createdAt < 500); // Explosion lasts 500ms

    setGameState({
        ...currentState,
        grid: nextGrid,
        enemies: nextEnemies,
        projectiles: nextProjectiles,
        suns: nextSuns,
        explosions: nextExplosions,
        energy: nextEnergy,
        score: nextScore,
        status: nextStatus,
        timeRemaining: nextTimeRemaining
    });
  };

  const handleCellClick = (r: number, c: number) => {
      if (gameState.status !== 'PLAYING') return;
      if (!selectedPet) return;
      
      const currentState = stateRef.current;
      if (currentState.grid[r][c]) return; // Occupied

      const petConfig = PET_DATA[selectedPet];
      if (currentState.energy >= petConfig.cost) {
          const newGrid = currentState.grid.map(row => [...row]);
          newGrid[r][c] = {
              id: `pet-${Date.now()}`,
              row: r,
              col: c,
              health: petConfig.health,
              maxHealth: petConfig.health,
              type: selectedPet,
              isEnemy: false,
              lastActionTime: performance.now()
          };
          
          setGameState(prev => ({
              ...prev,
              grid: newGrid,
              energy: prev.energy - petConfig.cost
          }));
          setSelectedPet(null);
      }
  };

  const handleCollectSun = (id: string) => {
    setGameState(prev => {
      const sun = prev.suns.find(s => s.id === id);
      if (!sun) return prev;
      
      return {
        ...prev,
        energy: prev.energy + sun.value,
        score: prev.score + SUN_SCORE_VALUE, // Collecting sun now gives 50 score
        suns: prev.suns.filter(s => s.id !== id)
      };
    });
  };

  const startGame = () => {
      setGameState({
        grid: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)),
        enemies: [],
        projectiles: [],
        suns: [],
        explosions: [],
        energy: INIT_ENERGY_CONST,
        level: 1,
        timeRemaining: LEVEL_DURATION_MS,
        score: 0,
        status: 'PLAYING',
        message: '怪物来了！保护家园！'
      });
      lastSpawnTime.current = performance.now();
      lastTickTime.current = performance.now();
      lastGlobalSunSpawnTime.current = performance.now();
  };

  const nextLevel = () => {
      setGameState(prev => ({
          ...prev,
          grid: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)), // Reset grid
          enemies: [], // Clear enemies
          projectiles: [], // Clear projectiles
          suns: [], // Clear suns
          explosions: [], // Clear explosions
          energy: INIT_ENERGY_CONST, // Reset energy
          level: prev.level + 1,
          timeRemaining: LEVEL_DURATION_MS,
          status: 'PLAYING',
          message: `第 ${prev.level + 1} 关`
      }));
      // Reset timers for smooth start
      lastSpawnTime.current = performance.now();
      lastGlobalSunSpawnTime.current = performance.now();
      lastTickTime.current = performance.now();
  };

  const togglePause = () => {
      if (gameState.status === 'PLAYING') {
          // Pause
          setGameState(prev => ({ ...prev, status: 'PAUSED' }));
          pauseStartTime.current = performance.now();
      } else if (gameState.status === 'PAUSED') {
          // Resume
          const now = performance.now();
          const pausedDuration = now - pauseStartTime.current;
          
          // Shift all time-based references forward
          lastTickTime.current = now; // Reset tick time to now to avoid huge delta
          lastSpawnTime.current += pausedDuration;
          lastGlobalSunSpawnTime.current += pausedDuration;
          
          // Shift action times for all entities to prevent instant attacks if they were cooling down
          setGameState(prev => {
              const adjustedGrid = prev.grid.map(row => row.map(cell => {
                  if (cell) {
                      return { ...cell, lastActionTime: cell.lastActionTime + pausedDuration };
                  }
                  return cell;
              }));
              const adjustedEnemies = prev.enemies.map(e => ({
                  ...e,
                  lastActionTime: e.lastActionTime + pausedDuration
              }));
              
              return {
                  ...prev,
                  grid: adjustedGrid,
                  enemies: adjustedEnemies,
                  status: 'PLAYING'
              };
          });
      }
  };

  const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-screen bg-sky-100 flex flex-col overflow-hidden relative select-none">
        {/* Header */}
        <header className="flex-none h-16 bg-white/50 backdrop-blur-md border-b border-white/60 flex items-center justify-between px-6 z-30">
            <h1 className="text-xl md:text-2xl font-black text-sky-600 tracking-tight flex items-center gap-2">
                🐶 萌宠大战怪物 👾
            </h1>
            
            {/* Game Info Bar */}
            <div className="flex items-center gap-3 md:gap-6">
                 {/* Pause Button */}
                 {(gameState.status === 'PLAYING' || gameState.status === 'PAUSED') && (
                     <Button 
                        onClick={togglePause} 
                        className="!p-2 !rounded-full !h-10 !w-10 flex items-center justify-center" 
                        variant="secondary"
                     >
                        {gameState.status === 'PAUSED' ? <Play className="fill-current w-5 h-5"/> : <Pause className="fill-current w-5 h-5"/>}
                     </Button>
                 )}

                 <div className="flex items-center gap-2 text-gray-700 font-bold bg-white/60 px-3 py-1 rounded-lg">
                    <Trophy className="w-5 h-5 text-purple-500" />
                    <span className="whitespace-nowrap">第 {gameState.level}/{MAX_LEVELS} 关</span>
                 </div>

                 <div className="flex items-center gap-2 text-gray-700 font-bold bg-white/60 px-3 py-1 rounded-lg w-24 justify-center">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <span className="font-mono">{formatTime(gameState.timeRemaining)}</span>
                 </div>

                 <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold shadow-sm animate-pulse-short">
                    <Star className="w-4 h-4 fill-current" />
                    <span>{Math.floor(gameState.energy)}</span>
                 </div>
                 
                 {/* Hide score on very small screens if needed */}
                 {(gameState.status === 'PLAYING' || gameState.status === 'PAUSED') && (
                     <div className="hidden lg:block font-mono text-gray-600">分数: {gameState.score}</div>
                 )}
            </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            
            {/* Sidebar */}
            <div className="order-2 lg:order-1 flex-none p-2 z-20 w-full lg:w-auto flex justify-center lg:block bg-white/30">
                <PetSelector 
                    energy={gameState.energy} 
                    selectedPet={selectedPet} 
                    onSelect={setSelectedPet} 
                />
            </div>

            {/* Game Board */}
            <div className="order-1 lg:order-2 flex-1 relative overflow-auto flex items-center justify-center p-4 bg-pattern">
                 <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                     backgroundImage: 'radial-gradient(#444 1px, transparent 1px)',
                     backgroundSize: '20px 20px'
                 }}></div>

                 <div 
                    ref={boardRef}
                    className="relative bg-green-500/10 rounded-3xl border-4 border-green-500/30 shadow-2xl overflow-hidden"
                    style={{
                        width: `${COLS * cellSize}px`,
                        height: `${ROWS * cellSize}px`,
                        minWidth: `${COLS * cellSize}px`
                    }}
                 >
                     {/* Grid Lines */}
                     {Array.from({ length: ROWS }).map((_, r) => (
                         <div key={`row-${r}`} className="absolute w-full border-b border-green-700/10" style={{ top: `${(r + 1) * cellSize}px` }} />
                     ))}
                     {Array.from({ length: COLS }).map((_, c) => (
                         <div key={`col-${c}`} className="absolute h-full border-r border-green-700/10" style={{ left: `${(c + 1) * cellSize}px` }} />
                     ))}

                     {/* Grid Cells */}
                     {gameState.grid.map((row, r) => (
                         row.map((cell, c) => (
                             <div
                                key={`${r}-${c}`}
                                onClick={() => handleCellClick(r, c)}
                                className={`absolute transition-colors duration-200 cursor-pointer 
                                    ${!cell && selectedPet && gameState.energy >= PET_DATA[selectedPet].cost ? 'hover:bg-green-400/30' : ''}
                                `}
                                style={{
                                    width: cellSize,
                                    height: cellSize,
                                    top: r * cellSize,
                                    left: c * cellSize
                                }}
                             />
                         ))
                     ))}

                     {/* Entities */}
                     {gameState.grid.flat().map((entity) => (
                         entity && <EntityComponent key={entity.id} entity={entity} cellSize={cellSize} />
                     ))}
                     {gameState.enemies.map(enemy => (
                         <EntityComponent key={enemy.id} entity={enemy} cellSize={cellSize} />
                     ))}

                     {/* Suns */}
                     {gameState.suns.map(sun => (
                         <SunComponent 
                            key={sun.id} 
                            sun={sun} 
                            cellSize={cellSize} 
                            onClick={handleCollectSun}
                         />
                     ))}

                     {/* Explosions */}
                     {gameState.explosions.map(exp => (
                         <ExplosionComponent key={exp.id} explosion={exp} cellSize={cellSize} />
                     ))}

                     {/* Projectiles */}
                     {gameState.projectiles.map(proj => (
                         <ProjectileComponent key={proj.id} projectile={proj} cellSize={cellSize} />
                     ))}

                 </div>
            </div>
        </div>

        {/* Overlay Screens */}
        {gameState.status === 'START' && (
            <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 animate-bounce-in">
                    <div className="text-6xl mb-4">🏠⚔️👾</div>
                    <h2 className="text-3xl font-black text-gray-800 mb-2">萌宠保卫战</h2>
                    <p className="text-gray-600 mb-6">有些怪物想偷走我们的零食！<br/>放置萌宠来阻止它们！</p>
                    <div className="bg-blue-50 p-4 rounded-xl mb-6 text-sm text-left">
                        <p>🎯 规则：</p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
                           <li>共有 {MAX_LEVELS} 个关卡，每关坚持 {LEVEL_DURATION_MS / 60000} 分钟</li>
                           <li>每过一关，怪物的速度增加 5%</li>
                           <li>收集阳光召唤萌宠</li>
                        </ul>
                    </div>
                    <Button onClick={startGame} className="w-full text-xl py-4" variant="success">开始游戏</Button>
                </div>
            </div>
        )}

        {/* Pause Overlay */}
        {gameState.status === 'PAUSED' && (
            <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-6 rounded-3xl shadow-2xl text-center animate-bounce-in">
                    <div className="text-5xl mb-4">⏸️</div>
                    <h2 className="text-2xl font-black text-gray-800 mb-4">游戏暂停</h2>
                    <Button onClick={togglePause} className="w-48 text-lg" variant="success">继续游戏</Button>
                </div>
            </div>
        )}

        {gameState.status === 'GAME_OVER' && (
            <div className="absolute inset-0 z-50 bg-red-900/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-red-200">
                    <div className="text-6xl mb-4">😭</div>
                    <h2 className="text-3xl font-black text-red-600 mb-2">哎呀！失败了</h2>
                    <p className="text-gray-600 mb-6">怪物冲进了家里...<br/>你坚持到了第 {gameState.level} 关</p>
                    <Button onClick={startGame} className="w-full text-xl py-4" variant="primary">重新开始</Button>
                </div>
            </div>
        )}

        {gameState.status === 'LEVEL_COMPLETE' && (
            <div className="absolute inset-0 z-50 bg-blue-900/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-blue-200 animate-bounce-in">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-black text-blue-600 mb-2">关卡完成！</h2>
                    <p className="text-gray-600 mb-6">太棒了！你成功守住了第 {gameState.level} 关！<br/>下一关怪物速度将提升 5%！<br/>萌宠和阳光将重置。</p>
                    <Button onClick={nextLevel} className="w-full text-xl py-4" variant="success">进入下一关</Button>
                </div>
            </div>
        )}

        {gameState.status === 'VICTORY' && (
            <div className="absolute inset-0 z-50 bg-yellow-500/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-yellow-200 animate-bounce-in">
                    <div className="text-6xl mb-4">🏆</div>
                    <h2 className="text-3xl font-black text-yellow-600 mb-2">大获全胜！</h2>
                    <p className="text-gray-600 mb-6">你是真正的萌宠守护神！<br/>所有的怪物都被赶跑了！</p>
                    <p className="text-2xl font-bold text-gray-800 mb-8">最终得分: {gameState.score}</p>
                    <Button onClick={startGame} className="w-full text-xl py-4" variant="primary">再玩一次</Button>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;