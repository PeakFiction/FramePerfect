// src/lib/notation.js
// Peta token -> nama file icon di /public/icons
export const ICONS = {
  // tombol
  '1': 'button-1.png', '2': 'button-2.png', '3': 'button-3.png', '4': 'button-4.png',
  '12': 'button-12.png', '13': 'button-13.png', '14': 'button-14.png',
  '23': 'button-23.png', '24': 'button-24.png', '34': 'button-34.png',
  '123': 'button-123.png', '124': 'button-124.png', '134': 'button-134.png', '234': 'button-234.png',
  '1234': 'button-1234.png',

  // arah (lowercase = tap, uppercase = hold)
  'n': 'motion-neutral.png',
  'f': 'motion-f.png',   'F': 'motion-FHold.png',
  'b': 'motion-b.png',   'B': 'motion-bHold.png',
  'd': 'motion-d.png',   'D': 'motion-dHold.png',
  'u': 'motion-u.png',   'U': 'motion-uHold.png',

  'df': 'motion-df.png', 'DF': 'motion-dfHold.png',
  'db': 'motion-db.png', 'DB': 'motion-dbHold.png',
  'uf': 'motion-uf.png', 'UF': 'motion-ufHold.png',
  'ub': 'motion-ub.png', 'UB': 'motion-ubHold.png',

  // state / aksi
  'ws': 'action-whileStanding.png',
  'wr': 'action-whileRunning.png',
  'fc': 'action-fullCrouch.png',
  'ss': 'action-sideStepRight.png',
  'ssl': 'action-sideStepLeft.png',
  'ssr': 'action-sideStepRight.png',
  'swl': 'action-sideWalkLeft.png',
  'swr': 'action-sideWalkRight.png',
  'dash': 'action-dash.png',
  'md': 'action-microdash.png',
  'deepdash': 'action-deepdash.png',

  // heat / spesial
  'inheat': 'action-inHeat.png',
  'heatburst': 'action-heatBurst.png',
  'heatdash': 'action-heatDash.png',
  'RA': 'action-rageArt.png',
  'ch': 'action-counterHit.png',

  // stage events
  'wb': 'stage-wallBreak.png',
  'w!': 'stage-wallSplat.png',
  'wb!': 'stage-wallBlast.png',
  'fb': 'stage-floorBreak.png',
  'f!': 'stage-floorBlast.png',
  'bb': 'stage-balconyBreak.png',

  // pemisah/simbol
  ',': 'other-comma.png',
  ';': 'other-colon.png',
  '~': 'other-tilde.png',
  '>': 'other-next.png',   // "then"
  '(': 'other-bracketLeft.png',
  ')': 'other-bracketRight.png',
};

// urutan token multi-karakter supaya nge-match duluan
const ORDERED = [
  '1234','123','124','134','234','12','13','14','23','24','34',
  'ssl','ssr','swl','swr','ws','wr','fc',
  'DF','DB','UF','UB','df','db','uf','ub',
  'RA','heatburst','heatdash','inheat','deepdash','dash','md',
  'bb','wb!','w!','wb','fb','f!',
  'ch',
  'F','B','D','U','f','b','d','u','n',
  'ss',
  '(',')',',',';','~','>','+'
];

// parser super-santai untuk “international notation” Tekken
export function parseNotation(input = '') {
  let s = String(input).trim();

  // normalisasi ringan
  s = s.replace(/\s+/g, '');     // buang spasi
  s = s.replace(/，/g, ',');      // koma CN -> ,
  s = s.replace(/；/g, ';');      // ;
  s = s.replace(/～/g, '~');      // ~
  s = s.replace(/–|—/g, '-');

  const out = [];
  let i = 0;

  while (i < s.length) {
    // match token panjang dulu
    let matched = false;
    for (const tok of ORDERED) {
      if (s.startsWith(tok, i)) {
        if (tok === '+') {           // treat plus sebagai "then/next"
          out.push('>');
        } else {
          out.push(tok);
        }
        i += tok.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // angka: prioritaskan multi-digit grup tombol (12, 23, dst.)
    if (/[0-9]/.test(s[i])) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      const num = s.slice(i, j);
      // pecah ke bentuk yang punya ikon
      if (ICONS[num]) out.push(num);
      else out.push(...num.split('')); // fallback: 123 -> 1,2,3
      i = j;
      continue;
    }

    // karakter asing: kirim raw biar keliatan (pakai text nanti)
    out.push(s[i]);
    i += 1;
  }

  // saring yang ada icon-nya; sisanya biar renderer handle (teks)
  return out;
}