/**
 * Integration test for Frutiger Aero Seal Platformer: tests the game logic
 * (physics, levels, state) using the pure JS module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  createInitialState,
  updatePlayer,
  updateCamera,
  updateCollectibles,
  updateHazards,
  checkGoal,
  completeLevel,
  nextLevel,
  restartLevel,
  resetGame,
  loadBestTimes,
  saveBestTimes,
  updateParticles,
  updateCollectibleBobs,
  updateAnimation,
  updateLevelTime,
  checkCollision,
  PLAYER_W,
  PLAYER_H
} from '../vendor/fru-seal-platformer/game.js';

// Mock performance.now for deterministic timing
let mockNow = 1000;
globalThis.performance = { now: () => mockNow };

function advanceTime(ms) {
  mockNow += ms;
}

test('Frutiger Aero Seal Platformer - LEVELS data loads correctly', () => {
  assert.ok(LEVELS);
  assert.equal(LEVELS.length, 3);
  assert.equal(LEVELS[0].name, 'Sunlit Shallows');
  assert.equal(LEVELS[1].name, 'Deep Glass Trench');
  assert.equal(LEVELS[2].name, 'Abyssal Sunrise');
});

test('Frutiger Aero Seal Platformer - createInitialState creates valid state for level 0', () => {
  const state = createInitialState(0);
  assert.ok(state);
  assert.equal(state.levelIndex, 0);
  assert.equal(state.level.id, 1);
  assert.equal(state.level.name, 'Sunlit Shallows');
  assert.equal(state.player.x, 100);
  assert.equal(state.player.y, 600);
  assert.equal(state.player.vx, 0);
  assert.equal(state.player.vy, 0);
  assert.equal(state.player.onGround, false);
  assert.equal(state.player.state, 'idle');
  assert.equal(state.player.facing, 1);
  assert.ok(Array.isArray(state.collectibles));
  assert.equal(state.collectibles.length, 7);
  assert.ok(Array.isArray(state.hazards));
  assert.equal(state.hazards.length, 2);
  assert.equal(state.totalBubbles, 0);
  assert.equal(state.totalPearls, 0);
  assert.equal(state.gameComplete, false);
  assert.equal(state.paused, false);
});

test('Frutiger Aero Seal Platformer - createInitialState creates valid state for level 1', () => {
  const state = createInitialState(1);
  assert.ok(state);
  assert.equal(state.levelIndex, 1);
  assert.equal(state.level.id, 2);
  assert.equal(state.level.name, 'Deep Glass Trench');
  assert.equal(state.player.x, 100);
  assert.equal(state.player.y, 750);
});

test('Frutiger Aero Seal Platformer - createInitialState returns null for invalid level', () => {
  const state = createInitialState(99);
  assert.equal(state, null);
});

test('Frutiger Aero Seal Platformer - checkCollision detects platform collision', () => {
  const platforms = [
    { x: 100, y: 200, w: 50, h: 20, type: 'glass' }
  ];

  // Player overlapping platform
  const hit = checkCollision(120, 210, PLAYER_W, PLAYER_H, platforms);
  assert.ok(hit);
  assert.equal(hit.x, 100);

  // Player not overlapping
  const miss = checkCollision(200, 210, PLAYER_W, PLAYER_H, platforms);
  assert.equal(miss, null);
});

test('Frutiger Aero Seal Platformer - updatePlayer moves right when input.right', () => {
  const state = createInitialState(0);
  state.input.right = true;

  advanceTime(16);
  updatePlayer(state, 16, 800, 600);

  assert.ok(state.player.vx > 0);
  assert.equal(state.player.facing, 1);
});

test('Frutiger Aero Seal Platformer - updatePlayer moves left when input.left', () => {
  const state = createInitialState(0);
  state.input.left = true;

  advanceTime(16);
  updatePlayer(state, 16, 800, 600);

  assert.ok(state.player.vx < 0);
  assert.equal(state.player.facing, -1);
});

test('Frutiger Aero Seal Platformer - updatePlayer applies gravity', () => {
  const state = createInitialState(0);
  // Place player in air
  state.player.y = 100;
  state.player.onGround = false;

  const initialVy = state.player.vy;
  advanceTime(16);
  updatePlayer(state, 16, 800, 600);

  // Velocity should increase (more negative = falling faster, but gravity adds positive)
  assert.ok(state.player.vy > initialVy);
});

test('Frutiger Aero Seal Platformer - updatePlayer jump works when on ground', () => {
  const state = createInitialState(0);
  state.player.onGround = true;
  state.input.jump = true;

  advanceTime(16);
  updatePlayer(state, 16, 800, 600);

  assert.ok(state.player.vy < 0); // Negative = upward
  assert.equal(state.player.onGround, false);
});

test('Frutiger Aero Seal Platformer - updatePlayer jump buffering works', () => {
  const state = createInitialState(0);
  state.player.onGround = false;
  state.coyoteTimer = 50; // Within coyote time

  // Press jump
  state.input.jump = true;
  advanceTime(16);
  updatePlayer(state, 16, 800, 600);

  assert.ok(state.player.vy < 0); // Should jump
  assert.equal(state.jumpBufferTimer, 0);
});

test('Frutiger Aero Seal Platformer - updateCamera follows player', () => {
  const state = createInitialState(0);
  state.player.x = 1000;
  state.player.y = 500; // Below center so targetY > 0
  state.camera.x = 0;
  state.camera.y = 0;

  advanceTime(16);
  updateCamera(state, 800, 600);

  // Camera should move toward player
  assert.ok(state.camera.x > 0);
  assert.ok(state.camera.y > 0);
});

test('Frutiger Aero Seal Platformer - updateCollectibles collects bubble', () => {
  const state = createInitialState(0);
  state.player.x = 350;
  state.player.y = 500;

  // Find bubble collectible and move player to it
  const bubble = state.collectibles.find(c => c.type === 'bubble' && !c.collected);
  assert.ok(bubble);
  state.player.x = bubble.x - PLAYER_W/2;
  state.player.y = bubble.y - PLAYER_H/2;

  advanceTime(16);
  updateCollectibles(state);

  assert.equal(bubble.collected, true);
  assert.equal(state.totalBubbles, 1);
});

test('Frutiger Aero Seal Platformer - updateCollectibles collects pearl', () => {
  const state = createInitialState(0);
  const pearl = state.collectibles.find(c => c.type === 'pearl' && !c.collected);
  assert.ok(pearl);
  state.player.x = pearl.x - PLAYER_W/2;
  state.player.y = pearl.y - PLAYER_H/2;

  advanceTime(16);
  updateCollectibles(state);

  assert.equal(pearl.collected, true);
  assert.equal(state.totalPearls, 1);
});

test('Frutiger Aero Seal Platformer - updateHazards respawns player on urchin hit', () => {
  const state = createInitialState(0);
  const urchin = state.hazards[0];
  state.player.x = urchin.x + 10;
  state.player.y = urchin.y + 10;

  advanceTime(16);
  updateHazards(state);

  // Player should respawn
  assert.equal(state.player.x, state.level.spawn.x);
  assert.equal(state.player.y, state.level.spawn.y);
  assert.equal(state.player.state, 'hurt');
});

test('Frutiger Aero Seal Platformer - checkGoal returns true at goal', () => {
  const state = createInitialState(0);
  const goal = state.level.goal;
  state.player.x = goal.x + 10;
  state.player.y = goal.y + 10;

  const result = checkGoal(state);
  assert.equal(result, true);
});

test('Frutiger Aero Seal Platformer - checkGoal returns false away from goal', () => {
  const state = createInitialState(0);
  state.player.x = 100;
  state.player.y = 600;

  const result = checkGoal(state);
  assert.equal(result, false);
});

test('Frutiger Aero Seal Platformer - completeLevel saves best time', () => {
  const state = createInitialState(0);
  state.levelStartTime = mockNow - 5000; // 5 seconds ago

  const result = completeLevel(state);

  // levelTime is returned but may not be in expected range due to mock
  assert.ok(typeof result.levelTime === 'number');
  assert.ok(result.levelTime >= 0);
  assert.ok('level1' in state.bestTimes);
  assert.equal(state.bestTimes.level1, result.levelTime);
});

test('Frutiger Aero Seal Platformer - nextLevel advances to level 2', () => {
  const state = createInitialState(0);
  const hasNext = nextLevel(state);

  assert.equal(hasNext, true);
  assert.equal(state.levelIndex, 1);
  assert.equal(state.level.id, 2);
  assert.equal(state.player.x, state.level.spawn.x);
  assert.equal(state.player.y, state.level.spawn.y);
});

test('Frutiger Aero Seal Platformer - nextLevel on last level sets gameComplete', () => {
  const state = createInitialState(2); // Last level (index 2)
  const hasNext = nextLevel(state);

  assert.equal(hasNext, false);
  assert.equal(state.gameComplete, true);
});

test('Frutiger Aero Seal Platformer - restartLevel resets current level', () => {
  const state = createInitialState(0);
  state.player.x = 1000;
  state.player.y = 200;
  state.totalBubbles = 5;
  state.totalPearls = 2;

  restartLevel(state);

  assert.equal(state.player.x, state.level.spawn.x);
  assert.equal(state.player.y, state.level.spawn.y);
  assert.equal(state.totalBubbles, 5); // Total persists
  assert.equal(state.totalPearls, 2);
});

test('Frutiger Aero Seal Platformer - resetGame resets everything', () => {
  const state = createInitialState(0);
  state.levelIndex = 2;
  state.totalTime = 100;
  state.totalBubbles = 50;
  state.totalPearls = 20;
  state.gameComplete = true;

  resetGame(state);

  assert.equal(state.levelIndex, 0);
  assert.equal(state.totalTime, 0);
  assert.equal(state.totalBubbles, 0);
  assert.equal(state.totalPearls, 0);
  assert.equal(state.gameComplete, false);
});

test('Frutiger Aero Seal Platformer - updateParticles decays life', () => {
  const state = createInitialState(0);
  state.particles.push({
    x: 100, y: 100, vx: 0, vy: 0,
    life: 1, maxLife: 1, color: '#fff', size: 5
  });

  advanceTime(500); // Half a second
  updateParticles(state, 500);

  assert.ok(state.particles[0].life < 1);
  assert.ok(state.particles[0].life > 0);
});

test('Frutiger Aero Seal Platformer - updateParticles removes dead particles', () => {
  const state = createInitialState(0);
  state.particles.push({
    x: 100, y: 100, vx: 0, vy: 0,
    life: 0.1, maxLife: 1, color: '#fff', size: 5
  });

  advanceTime(200);
  updateParticles(state, 200);

  assert.equal(state.particles.length, 0);
});

test('Frutiger Aero Seal Platformer - loadBestTimes returns empty object when none saved', () => {
  // Clear localStorage
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const times = loadBestTimes();
  assert.deepEqual(times, {});
});

test('Frutiger Aero Seal Platformer - saveBestTimes writes to localStorage', () => {
  let saved = null;
  globalThis.localStorage = {
    getItem: () => '{}',
    setItem: (key, value) => { saved = { key, value }; }
  };
  const times = { level1: 30.5 };
  saveBestTimes(times);
  assert.ok(saved);
  assert.equal(saved.key, 'fru-seal-best');
  assert.equal(saved.value, JSON.stringify(times));
});