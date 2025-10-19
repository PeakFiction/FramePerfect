// overlay-electron/preload-gamepad.js
const { contextBridge, ipcRenderer } = require('electron');

// Canonical keys used by main:
// J(1), K(2), M(3), COMMA(4), W/A/S/D (D-pad), B(Options), V(Select)

// Mapping for common XInput/DirectInput pads.
// Buttons index reference (typical Xbox):
// 0:A(3)->M, 1:B(4)->COMMA, 2:X(1)->J, 3:Y(2)->K,
// 8:Back->V, 9:Start->B, 12:Up->W, 13:Down->S, 14:Left->A, 15:Right->D
const BTN_MAP = {
  0: 'M',
  1: 'COMMA',
  2: 'J',
  3: 'K',
  8: 'V',
  9: 'B',
  12: 'W',
  13: 'S',
  14: 'A',
  15: 'D',
};

const AXIS_DEAD = 0.45; // fallback if D-pad not present; left stick as D-pad
let lastButtons = {};
let lastAxesDirs = {}; // per gamepad id: {W,A,S,D} booleans

function send(type, key) {
  ipcRenderer.send('gp:event', { type, key });
}

function poll() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const gid = gp.index;

    // Buttons
    for (let i = 0; i < gp.buttons.length; i++) {
      const mapKey = BTN_MAP[i];
      if (!mapKey) continue;
      const pressed = !!gp.buttons[i]?.pressed;
      const last = lastButtons[gid]?.[i] || false;
      if (pressed !== last) {
        if (!lastButtons[gid]) lastButtons[gid] = {};
        lastButtons[gid][i] = pressed;
        send(pressed ? 'down' : 'up', mapKey);
      }
    }

    // D-pad fallback via left stick if D-pad indices not present/unused
    const hasDpad = gp.buttons && gp.buttons.length >= 16;
    const useAxis = !hasDpad || (
      // if all four dpad buttons absent or never pressed, enable axis fallback
      !(gp.buttons[12]?.pressed || gp.buttons[13]?.pressed || gp.buttons[14]?.pressed || gp.buttons[15]?.pressed)
    );

    if (useAxis && gp.axes && gp.axes.length >= 2) {
      const x = gp.axes[0] || 0;
      const y = gp.axes[1] || 0;

      const dir = {
        W: (y < -AXIS_DEAD),
        S: (y >  AXIS_DEAD),
        A: (x < -AXIS_DEAD),
        D: (x >  AXIS_DEAD),
      };

      if (!lastAxesDirs[gid]) lastAxesDirs[gid] = { W:false,S:false,A:false,D:false };
      for (const k of ['W','S','A','D']) {
        if (dir[k] !== lastAxesDirs[gid][k]) {
          lastAxesDirs[gid][k] = dir[k];
          send(dir[k] ? 'down' : 'up', k);
        }
      }
    }
  }

  // 120 Hz
  setTimeout(poll, 8);
}

window.addEventListener('gamepadconnected', () => { /* no-op; always polling */ });
window.addEventListener('DOMContentLoaded', () => { setTimeout(poll, 50); });
