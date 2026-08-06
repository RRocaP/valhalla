// OATHWOOD boot. Lead-owned wiring; workers implement the imported factories.
import { LOCKS } from './kernel/registry.gen.js';
import TREASURE from './kernel/treasure.gen.js';
import { PORTRAITS } from './kernel/portraits.gen.js';
import { createArt } from './art/index.js';
import { createAudio } from './audio/index.js';
import { createShell } from './shell/index.js';

function boot() {
  const locks = LOCKS.slice().sort((a, b) => a.ordinal - b.ordinal);
  const shell = createShell({
    locks,
    art: createArt(),
    audio: createAudio(),
    treasureDataUri: TREASURE,
    portraits: PORTRAITS,
  });
  shell.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
