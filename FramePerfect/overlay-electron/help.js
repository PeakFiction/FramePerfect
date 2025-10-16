document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.api.closeHelp();
});
const btn = document.getElementById('helpClose');
if (btn) btn.addEventListener('click', () => window.api.closeHelp());
