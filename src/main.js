import { Game } from './core/Game.js';

/**
 * Entry point: mount the game into #game-root and boot it.
 * Exposed on window.game for poking around in the console.
 */
const game = new Game(document.getElementById('game-root'));
window.game = game;
game.init().catch((err) => {
  console.error(err);
  document.getElementById('loading-text').textContent = `failed to start: ${err.message}`;
});
