(() => {
    const $ = (id) => document.getElementById(id);
  
    function bind() {
      const record = $('record');
      const save   = $('save');
      const imp    = $('import');
      const stop   = $('stop');
      const inject = $('inject');
      const switchEl = $('injectSwitch');
      const status = $('status');
  
      // Button wiring
      record?.addEventListener('click', () => window.api?.recordStart?.());
      save  ?.addEventListener('click', () => window.api?.recordStopAndSave?.());
      imp   ?.addEventListener('click', () => window.api?.importChooseAndPlay?.());
      stop  ?.addEventListener('click', () => window.api?.playbackStop?.());
  
      inject?.addEventListener('change', (e) => {
        const on = !!e.target.checked;
        switchEl?.classList.toggle('on', on);
        switchEl?.setAttribute('aria-checked', on ? 'true' : 'false');
        window.api?.injectSet?.(on);
      });
  
      const setStatus = (msg) => { if (status) status.textContent = msg; };
  
      // Platform hint from main (Windows-only injection)
      if (window.api?.onLauncherInit) {
        window.api.onLauncherInit(({ canInject }) => {
          if (!canInject) {
            if (inject) { inject.checked = false; inject.disabled = true; }
            switchEl?.classList.remove('on');
            setStatus('Inject is Windows-only (ViGEm). Recording/Playback available.');
          } else {
            setStatus('Ready — Inject available.');
          }
        });
      } else {
        // Fallback check
        const isWin = navigator.userAgent.includes('Windows');
        if (!isWin) {
          if (inject) { inject.checked = false; inject.disabled = true; }
          switchEl?.classList.remove('on');
          setStatus('Inject is Windows-only (ViGEm).');
        }
      }
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bind);
    } else {
      bind();
    }
  })();
  