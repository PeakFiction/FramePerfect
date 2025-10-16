// public/moves.js
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const table = $('#movesTable');
const thead = table ? table.tHead : null;
const tbody = table ? table.tBodies[0] : null;

// ---- header: character from query ----
const params = new URLSearchParams(location.search);
const charName = params.get('char') || '';
$('#mvChar') && ($('#mvChar').textContent = charName || 'Moves');
const avatarEl = $('#mvAvatar');
if (avatarEl && charName) {
  // try to load an icon if you have one; fallback is hidden
  const tryPaths = [
    `/characters/${charName.toLowerCase()}.png`,
    `/characters/${charName.toLowerCase()}.webp`
  ];
  (async () => {
    for (const p of tryPaths) {
      try {
        const res = await fetch(p, { method: 'HEAD' });
        if (res.ok) { avatarEl.src = p; return; }
      } catch {}
    }
    avatarEl.style.display = 'none';
  })();
}

// ---- column map (works by header text; robust to column order) ----
function headerMap() {
  const map = {};
  if (!thead) return map;
  const cells = Array.from(thead.rows[0].cells).map(th =>
    th.textContent.trim().toLowerCase()
  );
  cells.forEach((text, i) => {
    if (text.includes('command')) map.cmd = i;
    else if (text.includes('startup')) map.startup = i;
    else if (text.includes('on block')) map.block = i;
    else if (text.includes('on hit') && !map.hit) map.hit = i;
    else if (text.includes('on ch')) map.ch = i;
    else if (text.includes('propert')) map.props = i;
    else if (text.includes('note')) map.notes = i;
    else if (text.includes('hit level')) map.level = i;
  });
  return map;
}
const COL = headerMap();

// ---- utilities ----
const parseStartup = s => {
  // accepts i10, i10~12, i13-14 etc.
  const m = String(s).match(/i?(\d+)/i);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
};
const parseFrame = s => {
  // +8, -12, 0, strings with numbers
  const m = String(s).match(/[-+]?(\d+)/);
  return m ? parseInt(m[0], 10) : 0;
};

// ---- filtering state ----
let searchStr = '';
let activeTokens = new Set();
let lastSort = 'az';
let compact = false;

// ---- build filter chips from data present in PROPERTIES + NOTES ----
function collectTokens() {
  if (!tbody) return [];
  const set = new Set();
  for (const tr of tbody.rows) {
    const props = COL.props != null ? tr.cells[COL.props].textContent : '';
    const notes = COL.notes != null ? tr.cells[COL.notes].textContent : '';
    (props + ' ' + notes)
      .split(/[,*()\/\[\]\s]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .forEach(t => set.add(t));
  }
  // prune boring tokens
  return Array.from(set)
    .filter(t => t.length >= 2)
    .slice(0, 80) // keep it sane
    .sort((a, b) => a.localeCompare(b));
}

function buildFilterUI() {
  const chipsHost = $('#mvFilterChips');
  if (!chipsHost) return;
  chipsHost.innerHTML = '';
  for (const t of collectTokens()) {
    const id = 'tok_' + t.replace(/\W+/g, '_');
    const wrap = document.createElement('label');
    wrap.className = 'mv-chip';
    wrap.innerHTML = `<input type="checkbox" id="${id}" value="${t}"><span>${t}</span>`;
    chipsHost.appendChild(wrap);
  }
}

function rowMatches(tr) {
  const text = tr.textContent.toLowerCase();
  if (searchStr && !text.includes(searchStr)) return false;

  if (activeTokens.size) {
    const props = (COL.props != null ? tr.cells[COL.props].textContent : '') + ' ' +
                  (COL.notes != null ? tr.cells[COL.notes].textContent : '');
    const hay = props.toLowerCase();
    for (const tok of activeTokens) {
      if (!hay.includes(tok.toLowerCase())) return false;
    }
  }
  return true;
}

function applyFilter() {
  if (!tbody) return;
  for (const tr of Array.from(tbody.rows)) {
    tr.classList.toggle('mv-hide', !rowMatches(tr));
  }
}

function sortRows(mode) {
  if (!tbody) return;
  const rows = Array.from(tbody.rows).filter(tr => !tr.classList.contains('mv-hide'));
  const get = (tr, idx) => (idx != null ? tr.cells[idx]?.textContent.trim() ?? '' : '');

  rows.sort((a, b) => {
    if (mode === 'startup') {
      return parseStartup(get(a, COL.startup)) - parseStartup(get(b, COL.startup));
    }
    if (mode === 'on-block') {
      return parseFrame(get(b, COL.block)) - parseFrame(get(a, COL.block));
    }
    if (mode === 'on-hit') {
      return parseFrame(get(b, COL.hit)) - parseFrame(get(a, COL.hit));
    }
    // default A-Z by command text
    return get(a, COL.cmd).localeCompare(get(b, COL.cmd), undefined, { sensitivity:'base' });
  });

  // reattach in sorted order
  const frag = document.createDocumentFragment();
  rows.forEach(r => frag.appendChild(r));
  tbody.appendChild(frag);
}

// ---- wire controls ----
const searchInput = $('#mvSearch');
const clearBtn = $('#mvClear');
const sortSelect = $('#mvSort');
const filtersBtn = $('#mvFiltersBtn');
const filtersPop = $('#mvFilters');
const filtersApply = $('#mvFiltersApply');
const filtersClose = $('#mvFiltersClose');
const filtersReset = $('#mvFiltersReset');
const viewBtn = $('#mvView');

function debounce(fn, ms=180){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

if (searchInput) {
  searchInput.addEventListener('input', debounce(() => {
    searchStr = searchInput.value.trim().toLowerCase();
    applyFilter(); sortRows(lastSort);
  }));
}
clearBtn && clearBtn.addEventListener('click', () => {
  searchStr = ''; if (searchInput) searchInput.value = '';
  applyFilter(); sortRows(lastSort);
});

sortSelect && sortSelect.addEventListener('change', () => {
  lastSort = sortSelect.value;
  sortRows(lastSort);
});

// filters popover
filtersBtn && filtersBtn.addEventListener('click', () => {
  if (filtersPop.classList.contains('hidden')) buildFilterUI();
  filtersPop.classList.toggle('hidden');
});
filtersClose && filtersClose.addEventListener('click', () => filtersPop.classList.add('hidden'));
filtersReset && filtersReset.addEventListener('click', () => {
  $$('#mvFilterChips input[type=checkbox]').forEach(cb => cb.checked = false);
});
filtersApply && filtersApply.addEventListener('click', () => {
  activeTokens = new Set($$('#mvFilterChips input[type=checkbox]:checked').map(cb => cb.value));
  filtersPop.classList.add('hidden');
  applyFilter(); sortRows(lastSort);
});

// compact view
viewBtn && viewBtn.addEventListener('click', () => {
  compact = !compact;
  document.body.classList.toggle('mv-compact', compact);
  viewBtn.textContent = compact ? 'Card' : 'Compact';
});

// initial pass
applyFilter(); sortRows(lastSort);
