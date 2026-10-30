/**
 * Frutiger Aero Seal Platformer (8-bit Edition): game logic
 * Pure functions and classes with no DOM dependencies.
 */

export const GRAVITY = 1800;
export const JUMP_VELOCITY = -650;
export const MOVE_SPEED = 320;
export const COYOTE_TIME = 120;
export const JUMP_BUFFER = 100;
export const PLAYER_W = 48;
export const PLAYER_H = 48;

// Idle animation sprite sheet (14 frames, 4x4 grid, 48x48 each - last 2 slots empty)
export const IDLE_FRAMES = 14;
export const IDLE_FRAME_W = 48;
export const IDLE_FRAME_H = 48;
export const IDLE_SHEET_COLS = 4;
export const IDLE_SHEET_ROWS = 4;
export const IDLE_FRAME_DURATION = 90; // ms per frame (from GIF)

// 8-bit color palette (Aero-themed)
export const PALETTE = {
  // Background
  SKY_1: '#0066CC',
  SKY_2: '#0088FF',
  SKY_3: '#44AAFF',
  SKY_4: '#88CCFF',
  // Ground
  GROUND_1: '#004488',
  GROUND_2: '#0066AA',
  GROUND_3: '#0088CC',
  // Platforms
  GLASS_1: '#FFFFFF',
  GLASS_2: '#CCEEFF',
  GLASS_3: '#88CCEE',
  BUBBLE_1: '#44AAFF',
  BUBBLE_2: '#88CCFF',
  BUBBLE_3: '#CCEEFF',
  GOAL_1: '#FFCC00',
  GOAL_2: '#FFEE44',
  GOAL_3: '#FFFF88',
  // Seal (from Frutiger Angler - the Messenger blob)
  SEAL_1: '#002244',  // Deep body
  SEAL_2: '#004466',  // Mid body
  SEAL_3: '#006688',  // Light body
  SEAL_4: '#0088AA',  // Highlight
  SEAL_5: '#FFFFFF',  // Eye/white
  SEAL_BELLY: '#FFCC00', // Yellow belly like angler seal
  // Collectibles
  PEARL_1: '#FFFFCC',
  PEARL_2: '#FFFF88',
  PEARL_3: '#FFFFAA',
  BUBBLE_COL_1: '#88CCFF',
  BUBBLE_COL_2: '#CCEEFF',
  // Hazards
  URCHIN_1: '#440044',
  URCHIN_2: '#660066',
  URCHIN_3: '#880088',
  URCHIN_4: '#AA00AA',
  // Sun
  SUN_1: '#FFCC00',
  SUN_2: '#FFEE44',
  SUN_3: '#FFFF88',
};

export const LEVELS = [
  {
    id: 1,
    name: 'Sunlit Shallows',
    width: 3200,
    height: 800,
    spawn: { x: 100, y: 600 },
    goal: { x: 3000, y: 200 },
    platforms: [
      { x: 0, y: 700, w: 3200, h: 100, type: 'ground' },
      { x: 300, y: 550, w: 200, h: 24, type: 'glass' },
      { x: 600, y: 450, w: 180, h: 24, type: 'glass' },
      { x: 900, y: 350, w: 220, h: 24, type: 'bubble' },
      { x: 1300, y: 500, w: 200, h: 24, type: 'glass' },
      { x: 1700, y: 400, w: 160, h: 24, type: 'glass' },
      { x: 2100, y: 300, w: 200, h: 24, type: 'bubble' },
      { x: 2500, y: 250, w: 180, h: 24, type: 'glass' },
      { x: 2800, y: 200, w: 400, h: 24, type: 'goal' }
    ],
    collectibles: [
      { x: 350, y: 500, type: 'bubble' },
      { x: 650, y: 400, type: 'pearl' },
      { x: 950, y: 300, type: 'bubble' },
      { x: 1350, y: 450, type: 'pearl' },
      { x: 1750, y: 350, type: 'bubble' },
      { x: 2150, y: 250, type: 'pearl' },
      { x: 2550, y: 200, type: 'bubble' }
    ],
    hazards: [
      { x: 1000, y: 650, w: 100, h: 50, type: 'urchin' },
      { x: 2000, y: 650, w: 100, h: 50, type: 'urchin' }
    ]
  },
  {
    id: 2,
    name: 'Deep Glass Trench',
    width: 3600,
    height: 900,
    spawn: { x: 100, y: 750 },
    goal: { x: 3400, y: 150 },
    platforms: [
      { x: 0, y: 800, w: 3600, h: 100, type: 'ground' },
      { x: 200, y: 680, w: 180, h: 24, type: 'glass' },
      { x: 500, y: 600, w: 200, h: 24, type: 'glass' },
      { x: 850, y: 520, w: 160, h: 24, type: 'bubble' },
      { x: 1150, y: 440, w: 220, h: 24, type: 'glass' },
      { x: 1500, y: 380, w: 180, h: 24, type: 'bubble' },
      { x: 1850, y: 480, w: 200, h: 24, type: 'glass' },
      { x: 2200, y: 400, w: 180, h: 24, type: 'glass' },
      { x: 2550, y: 320, w: 220, h: 24, type: 'bubble' },
      { x: 2900, y: 260, w: 200, h: 24, type: 'glass' },
      { x: 3200, y: 180, w: 160, h: 24, type: 'bubble' },
      { x: 3350, y: 150, w: 250, h: 24, type: 'goal' }
    ],
    collectibles: [
      { x: 250, y: 630, type: 'bubble' },
      { x: 550, y: 550, type: 'pearl' },
      { x: 900, y: 470, type: 'bubble' },
      { x: 1250, y: 390, type: 'pearl' },
      { x: 1550, y: 330, type: 'bubble' },
      { x: 1950, y: 430, type: 'pearl' },
      { x: 2300, y: 350, type: 'bubble' },
      { x: 2650, y: 270, type: 'pearl' },
      { x: 3000, y: 210, type: 'bubble' },
      { x: 3300, y: 130, type: 'pearl' }
    ],
    hazards: [
      { x: 700, y: 720, w: 100, h: 50, type: 'urchin' },
      { x: 1400, y: 720, w: 100, h: 50, type: 'urchin' },
      { x: 2400, y: 720, w: 100, h: 50, type: 'urchin' },
      { x: 3000, y: 720, w: 100, h: 50, type: 'urchin' }
    ]
  },
  {
    id: 3,
    name: 'Abyssal Sunrise',
    width: 4000,
    height: 1000,
    spawn: { x: 100, y: 850 },
    goal: { x: 3800, y: 100 },
    platforms: [
      { x: 0, y: 900, w: 4000, h: 100, type: 'ground' },
      { x: 150, y: 780, w: 200, h: 24, type: 'glass' },
      { x: 450, y: 700, w: 180, h: 24, type: 'bubble' },
      { x: 750, y: 620, w: 220, h: 24, type: 'glass' },
      { x: 1100, y: 560, w: 200, h: 24, type: 'bubble' },
      { x: 1450, y: 480, w: 180, h: 24, type: 'glass' },
      { x: 1800, y: 420, w: 220, h: 24, type: 'bubble' },
      { x: 2150, y: 500, w: 200, h: 24, type: 'glass' },
      { x: 2500, y: 420, w: 180, h: 24, type: 'bubble' },
      { x: 2850, y: 340, w: 220, h: 24, type: 'glass' },
      { x: 3200, y: 260, w: 200, h: 24, type: 'bubble' },
      { x: 3550, y: 180, w: 180, h: 24, type: 'glass' },
      { x: 3750, y: 100, w: 250, h: 24, type: 'goal' }
    ],
    collectibles: [
      { x: 200, y: 730, type: 'bubble' },
      { x: 500, y: 650, type: 'pearl' },
      { x: 800, y: 570, type: 'bubble' },
      { x: 1150, y: 510, type: 'pearl' },
      { x: 1500, y: 430, type: 'bubble' },
      { x: 1850, y: 370, type: 'pearl' },
      { x: 2200, y: 450, type: 'bubble' },
      { x: 2550, y: 370, type: 'pearl' },
      { x: 2900, y: 290, type: 'bubble' },
      { x: 3250, y: 210, type: 'pearl' },
      { x: 3600, y: 130, type: 'bubble' },
      { x: 3800, y: 60, type: 'pearl' }
    ],
    hazards: [
      { x: 600, y: 820, w: 100, h: 50, type: 'urchin' },
      { x: 1300, y: 820, w: 100, h: 50, type: 'urchin' },
      { x: 2000, y: 820, w: 100, h: 50, type: 'urchin' },
      { x: 2700, y: 820, w: 100, h: 50, type: 'urchin' },
      { x: 3400, y: 820, w: 100, h: 50, type: 'urchin' }
    ]
  }
];

// --- AABB Collision ---
export function checkCollision(px, py, pw, ph, platforms) {
  for (const p of platforms) {
    if (px < p.x + p.w && px + pw > p.x &&
        py < p.y + p.h && py + ph > p.y) {
      return p;
    }
  }
  return null;
}

// --- Game State ---
export function createInitialState(levelIndex = 0) {
  const level = LEVELS[levelIndex];
  if (!level) return null;

  return {
    levelIndex,
    level,
    player: {
      x: level.spawn.x,
      y: level.spawn.y,
      vx: 0,
      vy: 0,
      onGround: false,
      state: 'idle',
      facing: 1
    },
    camera: { x: 0, y: 0 },
    input: { left: false, right: false, jump: false },
    collectibles: level.collectibles.map(c => ({
      x: c.x, y: c.y, type: c.type, collected: false,
      bob: Math.random() * Math.PI * 2,
      sparkle: 0
    })),
    hazards: level.hazards.map(h => ({ ...h })),
    particles: [],
    levelStartTime: 0,
    levelTime: 0,
    totalTime: 0,
    totalBubbles: 0,
    totalPearls: 0,
    bestTimes: {},
    gameComplete: false,
    paused: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    animFrame: 0,
    frameTimer: 0,
    idleFrame: 0,
    idleFrameTimer: 0
  };
}

// --- Update Functions ---
export function updatePlayer(state, dt, canvasW, canvasH) {
  const { player, input, level, coyoteTimer, jumpBufferTimer } = state;

  // Horizontal movement
  let targetVx = 0;
  if (input.left) { targetVx = -MOVE_SPEED; player.facing = -1; }
  if (input.right) { targetVx = MOVE_SPEED; player.facing = 1; }
  player.vx = targetVx;

  // Jump buffering
  if (input.jump) state.jumpBufferTimer = JUMP_BUFFER;
  else state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);

  // Jump
  if (state.jumpBufferTimer > 0 && (player.onGround || state.coyoteTimer > 0)) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
  }

  // Gravity
  player.vy += GRAVITY * (dt / 1000);

  // Horizontal collision
  const nextX = player.x + player.vx * (dt / 1000);
  const hitX = checkCollision(nextX, player.y, PLAYER_W, PLAYER_H, level.platforms);
  if (hitX) {
    if (player.vx > 0) player.x = hitX.x - PLAYER_W;
    else if (player.vx < 0) player.x = hitX.x + hitX.w;
    player.vx = 0;
  } else {
    player.x = nextX;
  }

  // Vertical collision
  const nextY = player.y + player.vy * (dt / 1000);
  const hitY = checkCollision(player.x, nextY, PLAYER_W, PLAYER_H, level.platforms);
  player.onGround = false;
  if (hitY) {
    if (player.vy > 0) {
      player.y = hitY.y - PLAYER_H;
      player.vy = 0;
      player.onGround = true;
      state.coyoteTimer = COYOTE_TIME;
    } else if (player.vy < 0) {
      player.y = hitY.y + hitY.h;
      player.vy = 0;
    }
  } else {
    player.y = nextY;
    if (state.coyoteTimer > 0) state.coyoteTimer -= dt;
  }

  // Clamp to level bounds
  player.x = Math.max(0, Math.min(level.width - PLAYER_W, player.x));
  player.y = Math.max(0, Math.min(level.height + 200, player.y));
  if (player.y > level.height + 100) {
    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.state = 'hurt';
    state.frameTimer = 0;
  }

  // Determine player state
  if (player.state === 'hurt') {
    if (state.frameTimer > 500) player.state = 'idle';
  } else if (!player.onGround) {
    player.state = 'jump';
  } else if (Math.abs(player.vx) > 10) {
    player.state = 'run';
  } else {
    player.state = 'idle';
  }
}

export function updateCamera(state, canvasW, canvasH) {
  const { player, camera, level } = state;
  const targetX = player.x - canvasW / 2;
  const targetY = player.y - canvasH / 2;
  camera.x += (targetX - camera.x) * 0.1;
  camera.y += (targetY - camera.y) * 0.1;
  camera.x = Math.max(0, Math.min(level.width - canvasW, camera.x));
  camera.y = Math.max(0, Math.min(level.height - canvasH, camera.y));
}

export function updateCollectibles(state) {
  const { player, collectibles } = state;
  for (const c of collectibles) {
    if (c.collected) continue;
    const dx = (player.x + PLAYER_W/2) - c.x;
    const dy = (player.y + PLAYER_H/2) - c.y;
    if (dx*dx + dy*dy < 32*32) {
      c.collected = true;
      if (c.type === 'bubble') state.totalBubbles++;
      else if (c.type === 'pearl') state.totalPearls++;
    }
  }
}

export function updateHazards(state) {
  const { player, hazards, level } = state;
  for (const h of hazards) {
    if (player.x < h.x + h.w && player.x + PLAYER_W > h.x &&
        player.y < h.y + h.h && player.y + PLAYER_H > h.y) {
      player.x = level.spawn.x;
      player.y = level.spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.state = 'hurt';
      state.frameTimer = 0;
      break;
    }
  }
}

export function checkGoal(state) {
  const { player, level } = state;
  const goal = level.goal;
  if (player.x < goal.x + 40 && player.x + PLAYER_W > goal.x &&
      player.y < goal.y + 40 && player.y + PLAYER_H > goal.y) {
    return true;
  }
  return false;
}

export function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    p.vy += 200 * (dt / 1000);
    p.life -= dt / 1000;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

export function updateCollectibleBobs(state, dt) {
  for (const c of state.collectibles) {
    if (!c.collected) {
      c.bob += dt / 300;
      c.sparkle = Math.max(0, c.sparkle - dt / 1000);
    }
  }
}

export function updateAnimation(state, dt) {
  state.frameTimer += dt;
  if (state.frameTimer > 120) {
    state.animFrame = (state.animFrame + 1) % 4;
    state.frameTimer = 0;
  }

  // Update idle frame for sprite sheet animation
  state.idleFrameTimer += dt;
  if (state.idleFrameTimer >= IDLE_FRAME_DURATION) {
    state.idleFrame = (state.idleFrame + 1) % IDLE_FRAMES;
    state.idleFrameTimer = 0;
  }
}

export function updateLevelTime(state, now) {
  if (state.levelStartTime > 0) {
    state.levelTime = (now - state.levelStartTime) / 1000;
  }
}

export function completeLevel(state) {
  state.totalTime += state.levelTime;
  const levelKey = 'level' + state.level.id;
  if (!state.bestTimes[levelKey] || state.levelTime < state.bestTimes[levelKey]) {
    state.bestTimes[levelKey] = state.levelTime;
  }
  return { levelTime: state.levelTime, bestTime: state.bestTimes[levelKey] };
}

export function nextLevel(state) {
  state.levelIndex++;
  if (state.levelIndex >= LEVELS.length) {
    state.gameComplete = true;
    return false;
  }
  const newLevel = LEVELS[state.levelIndex];
  state.level = newLevel;
  state.player.x = newLevel.spawn.x;
  state.player.y = newLevel.spawn.y;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;
  state.player.state = 'idle';
  state.player.facing = 1;
  state.collectibles = newLevel.collectibles.map(c => ({
    x: c.x, y: c.y, type: c.type, collected: false,
    bob: Math.random() * Math.PI * 2,
    sparkle: 0
  }));
  state.hazards = newLevel.hazards.map(h => ({ ...h }));
  state.particles = [];
  state.levelStartTime = 0;
  state.levelTime = 0;
  state.coyoteTimer = 0;
  state.jumpBufferTimer = 0;
  state.animFrame = 0;
  state.frameTimer = 0;
  return true;
}

export function restartLevel(state) {
  const level = LEVELS[state.levelIndex];
  state.level = level;
  state.player.x = level.spawn.x;
  state.player.y = level.spawn.y;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;
  state.player.state = 'idle';
  state.player.facing = 1;
  state.collectibles = level.collectibles.map(c => ({
    x: c.x, y: c.y, type: c.type, collected: false,
    bob: Math.random() * Math.PI * 2,
    sparkle: 0
  }));
  state.hazards = level.hazards.map(h => ({ ...h }));
  state.particles = [];
  state.levelStartTime = 0;
  state.levelTime = 0;
  state.coyoteTimer = 0;
  state.jumpBufferTimer = 0;
  state.animFrame = 0;
  state.frameTimer = 0;
  state.idleFrame = 0;
  state.idleFrameTimer = 0;
}

export function resetGame(state) {
  state.levelIndex = 0;
  state.totalTime = 0;
  state.totalBubbles = 0;
  state.totalPearls = 0;
  state.gameComplete = false;
  const level = LEVELS[0];
  state.level = level;
  state.player.x = level.spawn.x;
  state.player.y = level.spawn.y;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;
  state.player.state = 'idle';
  state.player.facing = 1;
  state.collectibles = level.collectibles.map(c => ({
    x: c.x, y: c.y, type: c.type, collected: false,
    bob: Math.random() * Math.PI * 2,
    sparkle: 0
  }));
  state.hazards = level.hazards.map(h => ({ ...h }));
  state.particles = [];
  state.levelStartTime = 0;
  state.levelTime = 0;
  state.coyoteTimer = 0;
  state.jumpBufferTimer = 0;
  state.animFrame = 0;
  state.frameTimer = 0;
}

export function loadBestTimes() {
  try {
    return JSON.parse(localStorage.getItem('fru-seal-best') || '{}');
  } catch {
    return {};
  }
}

export function saveBestTimes(bestTimes) {
  localStorage.setItem('fru-seal-best', JSON.stringify(bestTimes));
}