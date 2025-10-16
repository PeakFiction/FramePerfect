// keySource.js
let providerName = 'none';
let add, stop;

function tryNodeGlobalKeyListener() {
  try {
    const { GlobalKeyboardListener } = require('node-global-key-listener');
    const gkl = new GlobalKeyboardListener();
    providerName = 'node-global-key-listener';
    add = (fn) => {
      gkl.addListener((e) => {
        if (e.state !== 'DOWN') return;
        const mods = [];
        if (e.ctrlKey)  mods.push('Ctrl');
        if (e.shiftKey) mods.push('Shift');
        if (e.altKey)   mods.push(process.platform === 'darwin' ? 'Option' : 'Alt');
        if (e.metaKey)  mods.push('Cmd');
        const name = e.name || (e.rawKey && e.rawKey.code) || 'Key';
        fn({ label: [...mods, name].join('+') });
      });
    };
    stop = () => gkl.removeAllListeners();
    return true;
  } catch (_) { return false; }
}

function tryIoHook() {
  try {
    const iohook = require('iohook');
    providerName = 'iohook';
    add = (fn) => {
      iohook.on('keydown', (e) => {
        const mods = [];
        if (e.ctrlKey)  mods.push('Ctrl');
        if (e.shiftKey) mods.push('Shift');
        if (e.altKey)   mods.push(process.platform === 'darwin' ? 'Option' : 'Alt');
        if (e.metaKey)  mods.push('Cmd');
        const label = [...mods, `Keycode:${e.keycode}`].join('+');
        fn({ label });
      });
      iohook.start();
    };
    stop = () => { try { iohook.stop(); } catch {} };
    return true;
  } catch (_) { return false; }
}

if (!tryNodeGlobalKeyListener() && !tryIoHook()) {
  throw new Error('No global key provider available. Install node-global-key-listener or iohook.');
}

module.exports = {
  name: providerName,
  on: (fn) => add(fn),
  stop: () => stop && stop(),
};
