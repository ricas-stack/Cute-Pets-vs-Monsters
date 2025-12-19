
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ROWS, COLS, GameState, Entity, PetType, EnemyType, Projectile, SunEntity, Explosion } from './types';
import { PET_DATA, ENEMY_CONFIG, INITIAL_ENERGY as INIT_ENERGY_CONST, GAME_TICK_MS, ENERGY_DROP_VALUE, SUN_LIFETIME_MS, SUN_SCORE_VALUE, SUN_SPAWN_MIN_MS, SUN_SPAWN_MAX_MS, LEVEL_DURATION_MS, MAX_LEVELS, SPEED_INCREMENT } from './constants';
import { Button } from './components/Button';
import { EntityComponent } from './components/EntityComponent';
import { ProjectileComponent } from './components/ProjectileComponent';
import { SunComponent } from './components/SunComponent';
import { ExplosionComponent } from './components/ExplosionComponent';
import { PetSelector } from './components/PetSelector';
import { Star, Trophy, Pause, Play, Volume2, VolumeX, Clock } from 'lucide-react';

// 联网备用背景音乐列表 - 风格贴近用户提供的 Soundstripe 链接 (欢快、趣味的游戏循环)
const FALLBACK_PLAYLIST = [
  'https://assets.mixkit.co/music/preview/mixkit-funny-game-loop-357.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-happy-puzzler-loop-452.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-game-level-music-689.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-fun-and-games-6.mp3'
];

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
  const [isMuted, setIsMuted] = useState(false);
  
  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlocked = useRef(false);
  
  // Refs for logic consistency
  const stateRef = useRef(gameState);
  const lastSpawnTime = useRef(0);
  const lastGlobalSunSpawnTime = useRef(0);
  const nextGlobalSunInterval = useRef(3000);
  const lastTickTime = useRef(0);
  const pauseStartTime = useRef(0);
  const animationFrameId = useRef<number>(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(80);

  // Sync ref with state
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Unified Audio Management with Random Fallback
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.4;
    
    // 优先尝试加载本地上传的音乐
    audio.src = './bgm.mp3';
    
    const handleAudioError = () => {
      // 如果本地 bgm.mp3 加载失败，从播放列表中随机选取一个链接
      if (audio.src && audio.src.includes('bgm.mp3')) {
        console.warn("本地音频 './bgm.mp3' 加载失败，正在随机选择一个联网备用音乐...");
        const randomUrl = FALLBACK_PLAYLIST[Math.floor(Math.random() * FALLBACK_PLAYLIST.length)];
        audio.src = randomUrl;
        audio.load();
        
        // 如果用户已经点击过开始，尝试自动恢复播放
        if (audioUnlocked.current && !isMuted) {
          audio.play().catch(e => console.log("备用音乐播放失败:", e));
        }
      }
    };

    audio.addEventListener('error', handleAudioError);
    audioRef.current = audio;

    return () => {
      audio.removeEventListener('error', handleAudioError);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Sync Mute state with Audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = isMuted;
      if (!isMuted && gameState.status === 'PLAYING' && audioUnlocked.current) {
        audio.play().catch(() => {});
      }
    }
  }, [isMuted, gameState.status]);

  // Handle Resize for Responsive Board
  useEffect(() => {
    const handleResize = () => {
      if (boardRef.current) {
        const parent = boardRef.current.parentElement;
        if (parent) {
          const parentWidth = parent.clientWidth - 32;
          const calculated = Math.max(65, Math.min(90, parentWidth / COLS));
          setCellSize(calculated);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    const timer = setTimeout(handleResize, 300);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Game Loop
  const gameLoop = useCallback((timestamp: number) => {
    if (stateRef.current.status !== 'PLAYING') {
       animationFrameId.current = requestAnimationFrame(gameLoop);
       return;
    }

    if (lastTickTime.current === 0) {
      lastTickTime.current = timestamp;
    }

    let deltaTime = timestamp - lastTickTime.current;
    if (deltaTime > 100) deltaTime = 100; // Protection against background tab jumps

    if (deltaTime >= GAME_TICK_MS) {
      lastTickTime.current = timestamp;
      updateGameLogic(timestamp, deltaTime);
    }
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, []);

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

    if (nextTimeRemaining <= 0) {
        nextTimeRemaining = 0;
        if (level >= MAX_LEVELS) nextStatus = 'VICTORY';
        else nextStatus = 'LEVEL_COMPLETE';
    }

    // Spawn Enemy
    if (nextStatus === 'PLAYING') {
        const spawnRate = Math.max(1200, 5000 - ((level - 1) * 900)); 
        if (now - lastSpawnTime.current > spawnRate) {
            const randomRow = Math.floor(Math.random() * ROWS);
            const types = [EnemyType.Normal];
            if (level > 1) types.push(EnemyType.Fast);
            if (level > 2) types.push(EnemyType.Tank);
            const randomType = types[Math.floor(Math.random() * types.length)];
            const config = ENEMY_CONFIG[randomType];
            nextEnemies.push({
                id: `enemy-${now}`,
                row: randomRow,
                col: COLS - 1,
                health: config.health,
                maxHealth: config.health,
                type: randomType,
                isEnemy: true,
                lastActionTime: 0,
                speed: config.speed,
            });
            lastSpawnTime.current = now;
        }
    }

    // Movement & Collision
    const levelSpeedMultiplier = 1 + ((level - 1) * SPEED_INCREMENT);
    nextEnemies = nextEnemies.map(enemy => {
      let movedEnemy = { ...enemy };
      const currentGridCol = Math.floor(movedEnemy.col);
      const petInCell = nextGrid[movedEnemy.row][currentGridCol];
      
      if (petInCell && Math.abs(movedEnemy.col - currentGridCol) < 0.5) {
        if (now - movedEnemy.lastActionTime > 1000) { 
            const pet = { ...petInCell };
            pet.health -= ENEMY_CONFIG[movedEnemy.type as EnemyType].damage;
            movedEnemy.lastActionTime = now;
            if (pet.health <= 0) {
                if (pet.type === PetType.Explosive) {
                    movedEnemy.health -= PET_DATA[PetType.Explosive].damage;
                    nextExplosions.push({ id: `exp-${now}-${movedEnemy.row}-${currentGridCol}`, row: movedEnemy.row, col: currentGridCol, createdAt: now });
                }
                nextGrid[movedEnemy.row][currentGridCol] = null;
            } else nextGrid[movedEnemy.row][currentGridCol] = pet;
        }
      } else {
        const moveAmount = (movedEnemy.speed! * levelSpeedMultiplier * (movedEnemy.frozen ? 0.5 : 1) * (deltaTime / 1000));
        movedEnemy.col -= moveAmount;
      }
      return movedEnemy;
    }).filter(e => e.health > 0);

    if (nextEnemies.some(e => e.col < 0)) nextStatus = 'GAME_OVER';

    // Global Sun Drop
    const allPets = nextGrid.flat().filter(p => p !== null) as Entity[];
    if (allPets.length > 0 && now - lastGlobalSunSpawnTime.current > nextGlobalSunInterval.current) {
        const randomPet = allPets[Math.floor(Math.random() * allPets.length)];
        nextSuns.push({ id: `sun-${now}-${randomPet.row}-${randomPet.col}`, row: randomPet.row, col: randomPet.col, value: ENERGY_DROP_VALUE, createdAt: now });
        lastGlobalSunSpawnTime.current = now;
        nextGlobalSunInterval.current = Math.floor(Math.random() * (SUN_SPAWN_MAX_MS - SUN_SPAWN_MIN_MS + 1)) + SUN_SPAWN_MIN_MS;
    }

    // Combat Logic
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let pet = nextGrid[r][c];
        if (!pet) continue;
        const petConfig = PET_DATA[pet.type as PetType];
        if (petConfig.damage > 0 && pet.type !== PetType.Explosive && now - pet.lastActionTime > petConfig.attackRate) {
            const enemiesRight = nextEnemies.some(e => e.row === r && e.col > c);
            const isDual = pet.type === PetType.DualShooter;
            const enemiesLeft = nextEnemies.some(e => e.row === r && e.col < c);

            if (enemiesRight || (isDual && enemiesLeft)) {
                let variant: 'bone' | 'ice' | 'fire' = 'bone';
                if (pet.type === PetType.Slower) variant = 'ice';
                else if (pet.type === PetType.DualShooter) variant = 'fire';

                if (enemiesRight || (isDual && !enemiesLeft)) {
                    nextProjectiles.push({ id: `proj-${now}-${r}-${c}-R`, row: r, x: c + 0.5, damage: petConfig.damage, variant, direction: 1 });
                }
                if (isDual && enemiesLeft) {
                    nextProjectiles.push({ id: `proj-${now}-${r}-${c}-L`, row: r, x: c - 0.5, damage: petConfig.damage, variant, direction: -1 });
                }
                pet = { ...pet, lastActionTime: now };
                nextGrid[r][c] = pet;
            }
        }
      }
    }

    const moveProjBase = 6 * (deltaTime / 1000);
    let activeProjectiles: Projectile[] = [];
    nextProjectiles.forEach(p => {
        let currentP = { ...p };
        currentP.x += moveProjBase * currentP.direction;
        let hit = false;
        for (let enemy of nextEnemies) {
            if (enemy.row === currentP.row && Math.abs(enemy.col - currentP.x) < 0.5) {
                enemy.health -= currentP.damage;
                if (currentP.variant === 'ice') enemy.frozen = true;
                hit = true;
                break; 
            }
        }
        if (!hit && currentP.x >= -1 && currentP.x < COLS + 1) activeProjectiles.push(currentP);
    });
    nextProjectiles = activeProjectiles;
    nextSuns = nextSuns.filter(s => now - s.createdAt < SUN_LIFETIME_MS);
    nextExplosions = nextExplosions.filter(e => now - e.createdAt < 500);

    setGameState({ ...currentState, grid: nextGrid, enemies: nextEnemies, projectiles: nextProjectiles, suns: nextSuns, explosions: nextExplosions, energy: nextEnergy, score: nextScore, status: nextStatus, timeRemaining: nextTimeRemaining });
  };

  const handleCellClick = (r: number, c: number) => {
      if (gameState.status !== 'PLAYING' || !selectedPet) return;
      const currentState = stateRef.current;
      if (currentState.grid[r][c]) return;
      const petConfig = PET_DATA[selectedPet];
      if (currentState.energy >= petConfig.cost) {
          const newGrid = currentState.grid.map(row => [...row]);
          newGrid[r][c] = { id: `pet-${Date.now()}`, row: r, col: c, health: petConfig.health, maxHealth: petConfig.health, type: selectedPet, isEnemy: false, lastActionTime: performance.now() };
          setGameState(prev => ({ ...prev, grid: newGrid, energy: prev.energy - petConfig.cost }));
          setSelectedPet(null);
      }
  };

  const handleCollectSun = (id: string) => {
    setGameState(prev => {
      const sun = prev.suns.find(s => s.id === id);
      if (!sun) return prev;
      return { ...prev, energy: prev.energy + sun.value, score: prev.score + SUN_SCORE_VALUE, suns: prev.suns.filter(s => s.id !== id) };
    });
  };

  const startGame = () => {
      const audio = audioRef.current;
      if (audio && !isMuted) {
          if (audio.error || audio.readyState === 0) {
              audio.load();
          }
          audio.currentTime = 0;
          audio.play()
            .then(() => { audioUnlocked.current = true; })
            .catch(err => {
               console.warn("音频激活失败，正在回退:", err);
               // 如果当前是本地文件，且播放失败，手动触发切换
               if (audio.src && audio.src.includes('bgm.mp3')) {
                  const randomUrl = FALLBACK_PLAYLIST[Math.floor(Math.random() * FALLBACK_PLAYLIST.length)];
                  audio.src = randomUrl;
                  audio.load();
                  audio.play().then(() => { audioUnlocked.current = true; }).catch(() => {});
               }
            });
      }

      setGameState({
        grid: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)),
        enemies: [], projectiles: [], suns: [], explosions: [], energy: INIT_ENERGY_CONST, level: 1, timeRemaining: LEVEL_DURATION_MS, score: 0, status: 'PLAYING', message: '怪物来了！'
      });
      lastTickTime.current = performance.now();
      lastSpawnTime.current = performance.now();
      lastGlobalSunSpawnTime.current = performance.now();
  };

  const nextLevel = () => {
      setGameState(prev => ({
          ...prev, grid: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)), enemies: [], projectiles: [], suns: [], explosions: [], energy: INIT_ENERGY_CONST, level: prev.level + 1, timeRemaining: LEVEL_DURATION_MS, status: 'PLAYING', message: `第 ${prev.level + 1} 关`
      }));
      lastTickTime.current = performance.now();
      lastSpawnTime.current = performance.now();
      lastGlobalSunSpawnTime.current = performance.now();
  };

  const togglePause = () => {
      if (gameState.status === 'PLAYING') {
          setGameState(prev => ({ ...prev, status: 'PAUSED' }));
          pauseStartTime.current = performance.now();
          if (audioRef.current) audioRef.current.pause();
      } else if (gameState.status === 'PAUSED') {
          const now = performance.now();
          const pausedDuration = now - pauseStartTime.current;
          lastTickTime.current = now;
          lastSpawnTime.current += pausedDuration;
          lastGlobalSunSpawnTime.current += pausedDuration;
          if (audioRef.current && !isMuted) {
            audioRef.current.play().catch(() => {});
          }
          setGameState(prev => {
              const adjustedGrid = prev.grid.map(row => row.map(cell => cell ? { ...cell, lastActionTime: cell.lastActionTime + pausedDuration } : cell));
              const adjustedEnemies = prev.enemies.map(e => ({ ...e, lastActionTime: e.lastActionTime + pausedDuration }));
              return { ...prev, grid: adjustedGrid, enemies: adjustedEnemies, status: 'PLAYING' };
          });
      }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-screen bg-sky-100 flex flex-col overflow-hidden relative select-none">
        <header className="flex-none h-16 bg-white/50 backdrop-blur-md border-b border-white/60 flex items-center justify-between px-3 sm:px-6 z-30 gap-2">
            <h1 className="text-base sm:text-xl md:text-2xl font-black text-sky-600 tracking-tight flex items-center gap-1 sm:gap-2 flex-shrink-0 whitespace-nowrap overflow-hidden">
                <span className="hidden sm:inline">🐶</span> 萌宠大战怪物 <span className="hidden sm:inline">👾</span>
            </h1>
            
            <div className="flex items-center gap-1.5 sm:gap-3 md:gap-6 flex-shrink-0">
                 <Button onClick={() => {
                     setIsMuted(!isMuted);
                     if (isMuted && audioRef.current && !audioUnlocked.current) {
                        audioRef.current.play().then(() => audioUnlocked.current = true).catch(() => {});
                     }
                 }} className="!p-1.5 sm:!p-2 !rounded-full !h-8 !w-8 sm:!h-10 sm:!w-10 flex items-center justify-center !bg-sky-100/50">
                    {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400"/> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500 animate-pulse-short"/>}
                 </Button>

                 {(gameState.status === 'PLAYING' || gameState.status === 'PAUSED') && (
                     <Button onClick={togglePause} className="!p-1.5 sm:!p-2 !rounded-full !h-8 !w-8 sm:!h-10 sm:!w-10 flex items-center justify-center" variant="secondary">
                        {gameState.status === 'PAUSED' ? <Play className="fill-current w-4 h-4 sm:w-5 sm:h-5"/> : <Pause className="fill-current w-4 h-4 sm:w-5 sm:h-5"/>}
                     </Button>
                 )}

                 <div className="flex items-center gap-1 sm:gap-2 text-gray-700 font-bold bg-white/60 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm md:text-base">
                    <Trophy className="w-3.5 h-3.5 sm:w-5 h-5 text-purple-500" />
                    <span className="whitespace-nowrap">第 {gameState.level} 关</span>
                 </div>

                 {gameState.status === 'PLAYING' && (
                    <div className="flex items-center gap-1 sm:gap-2 text-gray-700 font-bold bg-white/60 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm md:text-base border border-sky-200">
                        <Clock className={`w-3.5 h-3.5 sm:w-5 h-5 ${gameState.timeRemaining < 30000 ? 'text-red-500 animate-pulse' : 'text-sky-500'}`} />
                        <span className={`whitespace-nowrap tabular-nums ${gameState.timeRemaining < 30000 ? 'text-red-600' : ''}`}>
                            {formatTime(gameState.timeRemaining)}
                        </span>
                    </div>
                 )}

                 <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-2 sm:px-3 py-1 rounded-full font-bold shadow-sm text-xs sm:text-sm md:text-base">
                    <Star className="w-3 h-3 sm:w-4 h-4 fill-current" />
                    <span>{Math.floor(gameState.energy)}</span>
                 </div>
            </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            <div className="order-2 lg:order-1 flex-none p-2 z-20 w-full lg:w-auto flex justify-center lg:block bg-white/30">
                <PetSelector energy={gameState.energy} selectedPet={selectedPet} onSelect={setSelectedPet} />
            </div>

            <div className="order-1 lg:order-2 flex-1 relative overflow-auto p-4 bg-pattern flex items-start lg:items-center">
                 <div 
                    ref={boardRef} 
                    className="relative m-auto bg-green-500/10 rounded-3xl border-4 border-green-500/30 shadow-2xl overflow-hidden flex-shrink-0" 
                    style={{ 
                        width: `${COLS * cellSize}px`, 
                        height: `${ROWS * cellSize}px`,
                        minWidth: `${COLS * cellSize}px` 
                    }}
                 >
                     <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                     {Array.from({ length: ROWS }).map((_, r) => ( <div key={`row-${r}`} className="absolute w-full border-b border-green-700/10" style={{ top: `${(r + 1) * cellSize}px` }} /> ))}
                     {Array.from({ length: COLS }).map((_, c) => ( <div key={`col-${c}`} className="absolute h-full border-r border-green-700/10" style={{ left: `${(c + 1) * cellSize}px` }} /> ))}
                     
                     {gameState.grid.map((row, r) => ( row.map((cell, c) => ( 
                         <div key={`${r}-${c}`} onClick={() => handleCellClick(r, c)} className={`absolute transition-colors duration-200 cursor-pointer ${!cell && selectedPet && gameState.energy >= PET_DATA[selectedPet].cost ? 'hover:bg-green-400/30' : ''}`} style={{ width: cellSize, height: cellSize, top: r * cellSize, left: c * cellSize }} /> 
                     )) ))}
                     
                     {gameState.grid.flat().map((entity) => ( entity && <EntityComponent key={entity.id} entity={entity} cellSize={cellSize} /> ))}
                     {gameState.enemies.map(enemy => ( <EntityComponent key={enemy.id} entity={enemy} cellSize={cellSize} /> ))}
                     {gameState.suns.map(sun => ( <SunComponent key={sun.id} sun={sun} cellSize={cellSize} onClick={handleCollectSun} /> ))}
                     {gameState.explosions.map(exp => ( <ExplosionComponent key={exp.id} explosion={exp} cellSize={cellSize} /> ))}
                     {gameState.projectiles.map(proj => ( <ProjectileComponent key={proj.id} projectile={proj} cellSize={cellSize} /> ))}
                 </div>
            </div>
        </div>

        {gameState.status === 'START' && (
            <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 animate-bounce-in">
                    <div className="text-6xl mb-4">🏠⚔️👾</div>
                    <h2 className="text-3xl font-black text-gray-800 mb-2">萌宠保卫战</h2>
                    <p className="text-gray-600 mb-6 font-medium">守护家园免受调皮怪物的侵扰！</p>
                    <div className="bg-blue-50 p-4 rounded-xl mb-6 text-sm text-left">
                        <p className="font-bold text-blue-800">🎯 玩法：</p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
                           <li>抵挡所有波次的怪物进攻</li>
                           <li>收集掉落的“阳光”来部署萌宠</li>
                           <li>点击棋盘格子放置宠物</li>
                           <li>坚持完 3 分钟即获胜！</li>
                        </ul>
                    </div>
                    <Button onClick={startGame} className="w-full text-xl py-4" variant="success">开始保卫家园</Button>
                </div>
            </div>
        )}

        {gameState.status === 'PAUSED' && (
            <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-6 rounded-3xl shadow-2xl text-center animate-bounce-in">
                    <div className="text-5xl mb-4">⏸️</div>
                    <h2 className="text-2xl font-black text-gray-800 mb-4">游戏暂停中</h2>
                    <Button onClick={togglePause} className="w-48 text-lg" variant="success">继续战斗</Button>
                </div>
            </div>
        )}

        {gameState.status === 'GAME_OVER' && (
            <div className="absolute inset-0 z-50 bg-red-900/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-red-200">
                    <div className="text-6xl mb-4">😭</div>
                    <h2 className="text-3xl font-black text-red-600 mb-2">游戏结束</h2>
                    <p className="text-gray-600 mb-6">萌宠们战败了，再来一局试试吧！</p>
                    <Button onClick={startGame} className="w-full text-xl py-4" variant="primary">再次尝试</Button>
                </div>
            </div>
        )}

        {gameState.status === 'LEVEL_COMPLETE' && (
            <div className="absolute inset-0 z-50 bg-blue-900/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-blue-200 animate-bounce-in">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-black text-blue-600 mb-2">关卡大捷！</h2>
                    <p className="text-gray-600 mb-6">你守住了第 {gameState.level} 关！<br/>下一关怪物速度将提升 {SPEED_INCREMENT * 100}%</p>
                    <Button onClick={nextLevel} className="w-full text-xl py-4" variant="success">进入下一关</Button>
                </div>
            </div>
        )}

        {gameState.status === 'VICTORY' && (
            <div className="absolute inset-0 z-50 bg-yellow-500/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-yellow-200 animate-bounce-in">
                    <div className="text-6xl mb-4">🏆</div>
                    <h2 className="text-3xl font-black text-yellow-600 mb-2">恭喜通关！</h2>
                    <p className="text-gray-600 mb-6">你是最棒的萌宠守护者！</p>
                    <p className="text-2xl font-bold text-gray-800 mb-8">最终积分: {gameState.score}</p>
                    <Button onClick={startGame} className="w-full text-xl py-4" variant="primary">重头再战</Button>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;
