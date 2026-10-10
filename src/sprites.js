// AstroTech — pixel art: hand-drawn icons, procedural rockets, pilot portraits, cursors.
(function (AT) {
  'use strict';
  const SPR = AT.SPR = {};
  const cache = {};

  SPR.rng = function (seed) {
    let a = typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0 : seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  SPR.canvas = canvas;
  SPR.make = function (rows, pal, scale) {
    scale = scale || 1;
    const h = rows.length, w = rows[0].length;
    const c = canvas(w * scale, h * scale), g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || !pal[ch]) continue;
      g.fillStyle = pal[ch]; g.fillRect(x * scale, y * scale, scale, scale);
    }
    return c;
  };

  const P = {
    k: '#0a0f26', w: '#e8ecff', W: '#aab4dc', g: '#ffd866', G: '#c7952e', y: '#fff2b0',
    b: '#5a72c4', B: '#8fa6ff', d: '#2a3a73', r: '#ff6b6b', R: '#a83a3a', e: '#6be08a', E: '#2f8a4a',
    c: '#86c3ee', C: '#3d79a8', p: '#d08aff', P: '#6a3fa8', o: '#ff8f3d', O: '#a8481c',
    s: '#9aa3c9', S: '#555d85', n: '#9c8577', N: '#5a4840', t: '#f2c9a0', T: '#c08a60', v: '#a898ff', V: '#3d3470',
  };
  SPR.PAL = P;

  // ---------- 10x10 icons ----------
  const ICONS = {
    money:   ['..kkkkkk..', '.kyggggGk.', 'kyggGGggGk', 'kggGgggggk', 'kgggGGgggk', 'kgggggGggk', 'kggGGGgggk', 'kGggggggGk', '.kGGGGGGk.', '..kkkkkk..'],
    rp:      ['...kkkk...', '...kwWk...', '...kwWk...', '...kwWk...', '..kwwWWk..', '.kwcccWWk.', 'kwccwcccWk', 'kccccccCck', 'kcCcccccCk', '.kkkkkkkk.'],
    fleet:   ['..........', '...kk.....', '..kBBk....', '.kBwwBkk..', 'kBwwwBBBgg', 'kBwwwBBBgg', '.kBwwBkk..', '..kBBk....', '...kk.....', '..........'],
    rocket:  ['....kk....', '...kwWk...', '...kwWk...', '..kwcWSk..', '..kwWWSk..', '..krrrrk..', '..kwWWSk..', '.kbkWSkbk.', 'kbbkkkkbbk', '...koOk...'],
    market:  ['.........k', '........ke', '.......kek', '..k...kek.', '.kek.kek..', 'kekekek...', 'ek.kek....', 'k...k.....', 'kkkkkkkkkk', 'kSSSSSSSSk'],
    crew:    ['...kkkk...', '..kBBBBk..', '.kBccccBk.', '.kcttttck.', '.kttkttk..', '..ktttk...', '.kkbbbkk..', 'kbbbwbbbk.', 'kbbbwbbbk.', 'kkkkkkkkk.'],
    research:['..kkkkkk..', '.kpppppPk.', 'kppkkkpPPk', 'kpk...kpPk', '.k..kkpPk.', '...kppPk..', '...kpPk...', '....kk....', '...kppk...', '...kkkk...'],
    projects:['..kkkkk...', '.kgGGGgk..', 'kwwwwwwwk.', 'kwkkwkkwk.', 'kwwwwwwwk.', 'kwkkkwkwk.', 'kwwwwwwwk.', 'kwkkwkkwk.', 'kwwwwwwwk.', 'kkkkkkkkk.'],
    company: ['....kk....', '...kggk...', '..kggggk..', '.kkkkkkkk.', '.kwkwkwkk.', '.kwkwkwkk.', '.kwkwkwkk.', '.kwkwkwkk.', 'kkkkkkkkkk', 'kGGGGGGGGk'],
    expansion:['....kk....', '...kwwk...', '...kwck...', '..kwwcck..', '..kwwcck..', '..kwwwwk..', '.kRkwwkRk.', '.kRkkkkRk.', '...kogk...', '....oo....'],
    stats:   ['...kkkk...', '.kkSssSkk.', '.kssssssk.', 'kSsskksssk', 'kssk..kssk', 'kssk..kssk', 'kSsskksssk', '.kssssssk.', '.kkSssSkk.', '...kkkk...'],
    mission: ['kk......kk', 'kgk....kgk', '.kgk..kgk.', '..k....k..', '....kk....', '...kggk...', '....kk....', '..k....k..', '.kgk..kgk.', 'kk......kk'],
    scope:   ['......kk..', '.....kwWk.', '....kwWSk.', '...kwWSk..', '..kwWSk...', '.kcWSk....', '.kkSk.....', '..kNk.....', '.kN.Nk....', 'kN...Nk...'],
    probe:   ['....k.....', '....k.....', '...kek....', 'kkkkekkkk.', 'kccksskcck', 'kcckssk.cc', 'kkkkekkkk.', '...kek....', '....k.....', '....k.....'],
    outpost: ['....kk....', '...kwwk...', '..kwccwk..', '.kwccccwk.', '.kWWWWWWk.', 'kkWkkkkWkk', 'knnnnnnnnk', 'kNnnNnnNnk', '.kNNNNNNk.', '..kkkkkk..'],
    pad:     ['....k.....', '...kWk....', '...kWk.kk.', '...kWk.ks.', '...kWkkks.', '...kWk.ks.', '...kWk.ks.', 'kkkkkkkkkk', 'kSSSSSSSSk', 'kkkkkkkkkk'],
    contract:['.kkkkkk...', '.kwwwwwk..', '.kwkkkwk..', '.kwwwwwk..', '.kwkkkwk..', '.kwwwwwk..', '.kwkkwwkk.', '.kwwwwkgk.', '.kkkkkkgGk', '.......kk.'],
    skull:   ['..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwkkwwkkwk', 'kwkkwwkkwk', 'kwwwkkwwwk', '.kwwwwwwk.', '..kwkwkwk.', '..kkkkkkk.', '..........'],
    cc:      ['....kk....', '..k.kc.k..', '...kcck...', '.kkcwwckk.', 'kcccwwccck', 'kcccwwccck', '.kkcwwckk.', '...kcck...', '..k.kc.k..', '....kk....'],
    cs:      ['.......kk.', '......kwwk', '.....kwwck', '...kkcwck.', '..kccck...', '.kccck....', 'kCcck.....', 'kCck......', 'kCk.......', '.k........'],
    ss:      ['....kk....', '....kok...', '...kook...', 'kkkoyyokkk', 'kooyyyyook', '.kooyyook.', '..kooook..', '.koook.okk', '.kok...kok', '.kk.....kk'],
    dm:      ['...kkkk...', '..kVVVVk..', '.kVvvvvVk.', 'kVvkkkkvVk', 'kVvk..kvVk', 'kVvk..kvVk', 'kVvkkkkvVk', '.kVvvvvVk.', '..kVVVVk..', '...kkkk...'],
    lock:    ['...kkkk...', '..kSSSSk..', '..kS..Sk..', '..kS..Sk..', '.kkkkkkkk.', '.kggggggk.', '.kgggkggk.', '.kggGkggk.', '.kggggggk.', '.kkkkkkkk.'],
    sound:   ['.....k....', '....kk..k.', '.kkkwk.k..', '.kwwwk..k.', '.kwwwk.k.k', '.kwwwk.k.k', '.kwwwk..k.', '.kkkwk.k..', '....kk..k.', '.....k....'],
    mute:    ['.....k....', '....kk....', '.kkkwk....', '.kwwwk.r.r', '.kwwwk..r.', '.kwwwk.r.r', '.kwwwk....', '.kkkwk....', '....kk....', '.....k....'],
    warn:    ['....kk....', '...kggk...', '...kggk...', '..kgkkgk..', '..kgkkgk..', '.kggkkggk.', '.kggggggk.', 'kgggkkgggk', 'kggggggggk', 'kkkkkkkkkk'],
    trophy:  ['kkkkkkkkkk', 'kgggggggGk', 'kgyggggGGk', '.kgggggGk.', '..kgggGk..', '...kgGk...', '....kk....', '...kGGk...', '..kGGGGk..', '..kkkkkk..'],
    pick:    ['..kkkkk...', '.kssssSk..', 'kss..kSSk.', 'k...knk.k.', '....knk...', '...knk....', '..knk.....', '.knk......', 'knk.......', 'kk........'],
    star:    ['....kk....', '....kgk...', '...kggk...', 'kkkgyygkkk', 'kggyyyyggk', '.kggyyggk.', '..kggggk..', '.kggk.kgk.', '.kgk...kk.', '.kk.......'],
    // artifact glyphs
    box:     ['.kkkkkkkk.', 'kSssssssSk', 'kskkkkkksk', 'kskrrrrksk', 'kskrkkrksk', 'kskrrrrksk', 'kskkkkkksk', 'kSssssssSk', 'kSSSSSSSSk', '.kkkkkkkk.'],
    reactor: ['...kkkk...', '..kSssSk..', '.kSkeekSk.', 'kSkeyyekSk', 'kskeyyeksk', 'kSkeyyekSk', '.kSkeekSk.', '..kSssSk..', '...kkkk...', '..........'],
    screen:  ['kkkkkkkkkk', 'kccccccCck', 'kcwcccccCk', 'kcccggccCk', 'kccgyygcCk', 'kcccggccCk', 'kCCCCCCCCk', 'kkkkkkkkkk', '...kSSk...', '..kkkkkk..'],
    anchor:  ['....kk....', '...kssk...', '....kk....', '..kkssk...', '....ks....', '....ks....', 'k...ks...k', 'kk..ks..kk', '.kkssssskk', '..kkkkkk..'],
    scroll:  ['.kkkkkkk..', 'kwwwwwwwk.', '.kwkkkwk..', '.kwwwwwk..', '.kwkkwwk..', '.kwwwwwk..', '.kwkkkwk..', '.kwwwwwk..', 'kwwwwwwwk.', '.kkkkkkk..'],
    core:    ['...kkkk...', '..koOOok..', '.koyyyyOk.', 'koyyggyyOk', 'koyggggyOk', 'koyggggyOk', 'koyyggyyOk', '.koyyyyOk.', '..kOOOOk..', '...kkkk...'],
    map:     ['kkkkkkkkkk', 'kwwkwwwwwk', 'kwkrkwwkwk', 'kwwkwwkwwk', 'kwwwwkwwwk', 'kwkwkwwwwk', 'kwwwwwrrwk', 'kwkwwwrrwk', 'kwwwkwwwwk', 'kkkkkkkkkk'],
    vial:    ['...kkkk...', '....kk....', '....kk....', '...kwck...', '..kwwcck..', '.kpwppppk.', '.kpppppPk.', '.kppppPPk.', '..kPPPPk..', '...kkkk...'],
    twin:    ['..........', '.kkk.kkk..', 'kwWSkkwWSk', 'kwWSkwwWSk', 'kWWSkwWSSk', 'kWSSkkWSSk', '.kkk..kkk.', '..........', '..........', '..........'],
    rock:    ['..........', '...kkkk...', '..knnnNk..', '.knnNnnNk.', '.kntnnNNk.', '.knnnNNNk.', '..kNNNNk..', '...kkkk...', '..........', '..........'],
    tape:    ['kkkkkkkkkk', 'ksssssssk.', 'kskkskkskk', 'ksk.sk.sk.', 'kskkskkskk', 'ksssssssk.', 'ksWWWWWsk.', 'kkkkkkkkk.', '..........', '..........'],
    antenna: ['k...k...k.', '.k..k..k..', '..k.k.k...', '...kkk....', '....k.....', '....k.....', '...kSk....', '..kSssk...', '.kSsssSk..', 'kkkkkkkkk.'],
    lens:    ['...kkkk...', '..kcccck..', '.kcwccCck.', 'kcwccccCck', 'kccccccCck', 'kcccccCCck', 'kccccCCCck', '.kcCCCCck.', '..kcccck..', '...kkkk...'],
    lattice: ['k.k.k.k.k.', '.kek.kek..', 'kek.kek.k.', '.kek.kek..', 'k.kek.kek.', '.kek.kek..', 'kek.kek.k.', '.kek.kek..', 'k.k.k.k.k.', '..........'],
    bell:    ['....kk....', '...kggk...', '..kggggk..', '..kggggk..', '.kggggGGk.', '.kggggGGk.', 'kgggggGGGk', 'kkkkkkkkkk', '....kk....', '..........'],
    book:    ['.kkkkkkkk.', 'kRrrrrrrRk', 'kRrggggrRk', 'kRrrrrrrRk', 'kRrrrrrrRk', 'kRrrrrrrRk', 'kRrrrrrrRk', 'kwwwwwwwwk', '.kkkkkkkk.', '..........'],
    shell:   ['..kkkkkk..', '.kgkgkgkgk', 'kgkgkgkgk.', '.kgkgkgkgk', 'kgkgkgkgk.', '.kgkgkgkgk', 'kgkgkgkgk.', '..kkkkkk..', '..........', '..........'],
    ember:   ['....k.....', '...kok....', '...koOk...', '..koyoOk..', '.koyyyoOk.', '.koyyyyok.', '.kooyyook.', '..kooOOk..', '...kkkk...', '..........'],
    flame:   ['.....k....', '....kok...', '...kook...', '..koyok.k.', '..koyyokok', '.koyyyyook', '.koyyyyyok', '..kooyyok.', '...kkkkk..', '..........'],
    seal:    ['..kkkkkk..', '.kRrrrrRk.', 'kRrgggrrRk', 'kRrgkgrrRk', 'kRrgggrrRk', 'kRrrrrrrRk', '.kRrrrrRk.', '..kRk.kRk.', '..kk...kk.', '..........'],
    gem:     ['..kkkkkk..', '.kcwwccCk.', 'kcwccccCCk', 'kkkkkkkkkk', '.kcccccCk.', '..kcccCk..', '...kcCk...', '....kk....', '..........', '..........'],
    disc:    ['...kkkk...', '..kggggk..', '.kgyggGGk.', 'kgyggggGGk', 'kgggkkgGGk', 'kgggkkgGGk', 'kggggggGGk', '.kgggGGGk.', '..kGGGGk..', '...kkkk...'],
    clock:   ['...kkkk...', '..kwwwwk..', '.kwwkwwwk.', 'kwwwkwwwwk', 'kwwwkkkwwk', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kwwwwwwk.', '..kwwwwk..', '...kkkk...'],
  };
  SPR.icon = function (name, scale) {
    scale = scale || 1;
    const key = 'icon:' + name + ':' + scale;
    if (!cache[key]) cache[key] = SPR.make(ICONS[name] || ICONS.lock, P, scale).toDataURL();
    return cache[key];
  };
  SPR.img = function (name, cls) { return '<img class="ico ' + (cls || '') + '" src="' + SPR.icon(name) + '" alt="" draggable="false">'; };

  // ---------- pilot portraits (16x16, procedural) ----------
  const SKIN = [['#f6d2b4', '#d9a888'], ['#e8b88f', '#c08a60'], ['#c98d5f', '#9c6440'], ['#a5683f', '#7a4a2a'], ['#7a4a2c', '#53301b'], ['#f0c7a0', '#cf9c74']];
  const HAIR = ['#1a1214', '#3b2416', '#6e4424', '#c79b4a', '#e8e0d0', '#a8341f', '#2a2a3a', '#5a2a6a'];
  const TRAIT_COL = { steady: '#3d79a8', daredevil: '#c4471c', eye: '#c7952e', tinker: '#5a72c4', lucky: '#2f8a4a', veteran: '#6a3fa8', greedy: '#a8841f', quiet: '#555d85' };
  SPR.portrait = function (pilot, dead) {
    const key = 'face:' + pilot.face + ':' + pilot.trait + (dead ? 'x' : '');
    if (cache[key]) return cache[key];
    const rand = SPR.rng(pilot.face);
    const c = canvas(16, 16), g = c.getContext('2d');
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const skin = SKIN[Math.floor(rand() * SKIN.length)];
    const hair = HAIR[Math.floor(rand() * HAIR.length)];
    const style = Math.floor(rand() * 5);
    const suit = TRAIT_COL[pilot.trait] || '#555d85';
    rect(0, 0, 16, 16, '#13173a');
    for (let i = 0; i < 16; i += 2) px(i, (i * 7) % 16, '#1d2a63');
    // suit
    rect(2, 12, 12, 4, suit); rect(3, 11, 10, 1, suit);
    rect(7, 12, 2, 4, '#e8ecff'); px(5, 13, '#ffd866');
    // neck + face
    rect(6, 10, 4, 2, skin[1]);
    rect(4, 3, 8, 8, skin[0]); rect(5, 2, 6, 1, skin[0]); rect(5, 11, 6, 0, skin[1]);
    rect(11, 4, 1, 6, skin[1]); rect(5, 10, 6, 1, skin[1]);
    // eyes
    px(6, 6, '#0a0f26'); px(9, 6, '#0a0f26');
    if (dead) { px(5, 5, '#0a0f26'); px(7, 7, '#0a0f26'); px(8, 5, '#0a0f26'); px(10, 7, '#0a0f26'); px(6, 6, skin[1]); px(9, 6, skin[1]); }
    // mouth
    rect(7, 8, 2, 1, skin[1]);
    // hair
    if (style === 0) { rect(4, 1, 8, 2, hair); rect(3, 2, 1, 4, hair); rect(12, 2, 1, 3, hair); }
    else if (style === 1) { rect(4, 1, 8, 2, hair); rect(3, 2, 1, 9, hair); rect(12, 2, 1, 9, hair); rect(2, 5, 1, 6, hair); rect(13, 5, 1, 6, hair); }
    else if (style === 2) { rect(5, 0, 6, 2, hair); rect(4, 2, 8, 1, hair); rect(7, 0, 2, 1, '#0a0f26'); rect(6, -1, 4, 1, hair); }
    else if (style === 3) { rect(4, 2, 8, 1, skin[1]); }
    else { rect(4, 1, 8, 2, hair); rect(4, 3, 2, 1, hair); rect(11, 2, 2, 4, hair); }
    // headset
    rect(3, 6, 1, 3, '#2a3a73'); rect(12, 6, 1, 3, '#2a3a73'); px(11, 9, '#2a3a73'); px(10, 9, '#86c3ee');
    if (dead) { g.globalAlpha = 0.45; rect(0, 0, 16, 16, '#0a0f26'); g.globalAlpha = 1; }
    return (cache[key] = c.toDataURL());
  };

  // ---------- rockets (side view, procedural from a spec) ----------
  const HULL_SPEC = {
    prospector: { bw: 5,  bh: 12, nose: 4, kind: 'cone',  boost: 0, fins: 2, stripes: [0.3],       pal: 0 },
    hauler:     { bw: 8,  bh: 13, nose: 3, kind: 'blunt', boost: 0, fins: 2, stripes: [0.15, 0.7], pal: 1 },
    excavator:  { bw: 9,  bh: 15, nose: 5, kind: 'drill', boost: 0, fins: 3, stripes: [0.4],       pal: 2 },
    leviathan:  { bw: 9,  bh: 20, nose: 5, kind: 'cone',  boost: 3, fins: 2, stripes: [0.2, 0.6],  pal: 1 },
    torch:      { bw: 5,  bh: 24, nose: 7, kind: 'cone',  boost: 0, fins: 4, stripes: [0.5],       pal: 3 },
    icebreaker: { bw: 8,  bh: 18, nose: 4, kind: 'drill', boost: 0, fins: 3, stripes: [0.3],       pal: 4 },
    cryohauler: { bw: 11, bh: 18, nose: 4, kind: 'blunt', boost: 3, fins: 2, stripes: [0.25, 0.65],pal: 4 },
    dreadnought:{ bw: 12, bh: 24, nose: 6, kind: 'cone',  boost: 4, fins: 3, stripes: [0.2, 0.5, 0.8], pal: 5 },
    runner:     { bw: 6,  bh: 22, nose: 7, kind: 'cone',  boost: 2, fins: 4, stripes: [0.4],       pal: 6 },
    harvester:  { bw: 12, bh: 22, nose: 6, kind: 'drill', boost: 3, fins: 3, stripes: [0.3, 0.7],  pal: 6 },
    lifter:     { bw: 10, bh: 26, nose: 5, kind: 'blunt', boost: 4, fins: 3, stripes: [0.2, 0.55], pal: 7 },
    suneater:   { bw: 13, bh: 28, nose: 7, kind: 'cone',  boost: 4, fins: 4, stripes: [0.25, 0.6],pal: 7 },
    ark:        { bw: 9,  bh: 30, nose: 8, kind: 'cone',  boost: 3, fins: 4, stripes: [0.5],       pal: 8 },
    ledger:     { bw: 14, bh: 30, nose: 8, kind: 'cone',  boost: 5, fins: 4, stripes: [0.15, 0.5, 0.85], pal: 9 },
  };
  SPR.ROCKET_PAL = [
    { hi: '#f4f6ff', mid: '#c4cbe6', lo: '#7a83ad', acc: '#ff6b6b', win: '#86c3ee', fin: '#3d4a8a', noz: '#3a3a4a' },
    { hi: '#ffe8b8', mid: '#e0b060', lo: '#9a6a2a', acc: '#3d4a8a', win: '#86c3ee', fin: '#5a3a1a', noz: '#3a3a4a' },
    { hi: '#e8e8e0', mid: '#b4b0a0', lo: '#6a665a', acc: '#ffd866', win: '#6be08a', fin: '#a8481c', noz: '#3a3a4a' },
    { hi: '#ffffff', mid: '#d0d8f0', lo: '#8a94bc', acc: '#ff8f3d', win: '#ffd866', fin: '#2a3a73', noz: '#5a5a6a' },
    { hi: '#eefaff', mid: '#a8d8f0', lo: '#4a7aa0', acc: '#2a5a8a', win: '#e8f8ff', fin: '#1d3c5c', noz: '#3a4a5a' },
    { hi: '#d8dce8', mid: '#8a90a8', lo: '#4a4e66', acc: '#ff6b6b', win: '#ffd866', fin: '#2a2e44', noz: '#2a2a3a' },
    { hi: '#d8fff0', mid: '#6ad6aa', lo: '#2f7a5a', acc: '#e8ecff', win: '#b04fe0', fin: '#1f4a3a', noz: '#2a3a3a' },
    { hi: '#fff0d0', mid: '#ff9a4a', lo: '#a8481c', acc: '#fff2b0', win: '#ffffff', fin: '#5a1a0a', noz: '#3a2a2a' },
    { hi: '#e8e0ff', mid: '#8a7ad6', lo: '#3d3470', acc: '#a898ff', win: '#ffffff', fin: '#1a1430', noz: '#20203a' },
    { hi: '#ffffff', mid: '#c8c8c8', lo: '#3a3a3a', acc: '#ffd866', win: '#0a0a0a', fin: '#101010', noz: '#202020' },
  ];
  SPR.rocket = function (hullId, big) {
    const key = 'rocket:' + hullId + (big ? ':big' : '');
    if (cache[key]) return cache[key];
    const s0 = HULL_SPEC[hullId] || HULL_SPEC.prospector;
    const s = big ? Object.assign({}, s0, { bw: Math.round(s0.bw * 1.6) | 1, bh: Math.round(s0.bh * 1.75), nose: Math.round(s0.nose * 1.6), boost: s0.boost ? Math.round(s0.boost * 1.5) : 0, fins: s0.fins + 2 }) : s0;
    const pal = SPR.ROCKET_PAL[s.pal];
    const bb = s.boost ? s.boost + 1 : 0;
    const W = s.bw + 2 + bb * 2 + s.fins * 2;
    const H = s.nose + s.bh + 4;
    const c = canvas(W, H), g = c.getContext('2d');
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const cx0 = Math.floor((W - s.bw) / 2);
    const shade = (i, w) => (i < w * 0.35 ? pal.hi : i < w * 0.7 ? pal.mid : pal.lo);
    // boosters
    if (s.boost) {
      const bh = Math.floor(s.bh * 0.65), by = s.nose + s.bh - bh;
      for (const side of [-1, 1]) {
        const bx = side < 0 ? cx0 - bb : cx0 + s.bw + 1;
        for (let y = 0; y < bh; y++) for (let i = 0; i < s.boost; i++) px(bx + i, by + y, shade(i, s.boost));
        for (let i = 0; i < s.boost; i++) px(bx + i, by - 1, pal.lo);
        px(bx + Math.floor(s.boost / 2), by - 2, pal.mid);
        for (let i = 0; i < s.boost; i++) px(bx + i, by + bh, pal.noz);
        px(bx - 1 + (side < 0 ? 0 : s.boost + 1), by + bh - 1, '#0a0f26');
      }
    }
    // body
    for (let y = 0; y < s.bh; y++) for (let i = 0; i < s.bw; i++) px(cx0 + i, s.nose + y, shade(i, s.bw));
    for (const f of s.stripes) { const y = s.nose + Math.floor(s.bh * f); for (let i = 0; i < s.bw; i++) px(cx0 + i, y, pal.acc); }
    // window
    const wy = s.nose + 2;
    px(cx0 + Math.floor(s.bw * 0.3), wy, pal.win); px(cx0 + Math.floor(s.bw * 0.3) + 1, wy, pal.win);
    if (s.bw >= 8) { px(cx0 + Math.floor(s.bw * 0.3), wy + 1, pal.win); px(cx0 + Math.floor(s.bw * 0.3) + 1, wy + 1, pal.lo); }
    if (big) {
      for (let y = s.nose + 6; y < s.nose + s.bh - 3; y += 6) for (let i = 1; i < s.bw - 1; i += 3) px(cx0 + i, y, pal.lo);
      px(cx0 + Math.floor(s.bw * 0.3), wy + 4, pal.win); px(cx0 + Math.floor(s.bw * 0.3) + 2, wy + 4, pal.win);
      const lx = cx0 + s.bw - 3; for (let y = s.nose + 4; y < s.nose + s.bh - 4; y += 2) px(lx, y, pal.mid);
    }
    // nose
    for (let y = 0; y < s.nose; y++) {
      let w;
      if (s.kind === 'blunt') w = y === 0 ? Math.max(2, s.bw - 4) : y === 1 ? s.bw - 2 : s.bw;
      else w = Math.max(1, Math.round(s.bw * (y + 1) / (s.nose + 0.5)));
      const x0 = cx0 + Math.floor((s.bw - w) / 2);
      for (let i = 0; i < w; i++) {
        let col = shade(i, w);
        if (s.kind === 'drill') col = ((i + y) % 2) ? '#5a5a6a' : '#b4b8c8';
        px(x0 + i, y, col);
      }
    }
    // fins
    for (let f = 0; f < s.fins; f++) {
      const y = s.nose + s.bh - 1 - f;
      for (let k = 0; k <= f; k++) {
        px(cx0 - 1 - k - (s.boost ? bb : 0), y + k, pal.fin);
        px(cx0 + s.bw + k + (s.boost ? bb : 0), y + k, pal.fin);
      }
    }
    // nozzle
    const ny = s.nose + s.bh;
    const nw = Math.max(2, Math.floor(s.bw * 0.6));
    for (let y = 0; y < 2; y++) for (let i = 0; i < nw + y * 2; i++) px(cx0 + Math.floor((s.bw - nw) / 2) - y + i, ny + y, pal.noz);
    // outline pass
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const out = g.createImageData(W, H), o = out.data;
    const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (filled(x, y)) { o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = 255; }
      else if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) { o[i] = 10; o[i + 1] = 15; o[i + 2] = 38; o[i + 3] = 255; }
    }
    const c2 = canvas(W + 2, H + 2);
    const g2 = c2.getContext('2d');
    const tmp = canvas(W, H); tmp.getContext('2d').putImageData(out, 0, 0);
    g2.drawImage(tmp, 1, 1);
    cache[key] = c2;
    c2.nozzleY = H; c2.nozzleW = nw;
    return c2;
  };
  SPR.rocketDim = function (hullId, big) {
    const key = 'rocketdim:' + hullId + (big ? ':big' : '');
    if (cache[key]) return cache[key];
    const src = SPR.rocket(hullId, big);
    const c = canvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(8,12,40,0.5)'; g.fillRect(0, 0, c.width, c.height);
    c.nozzleW = src.nozzleW;
    return (cache[key] = c);
  };
  SPR.rocketURL = function (hullId) {
    const key = 'rocketurl:' + hullId;
    if (!cache[key]) cache[key] = SPR.rocket(hullId).toDataURL();
    return cache[key];
  };
  SPR.hullPal = function (hullId) { return SPR.ROCKET_PAL[(HULL_SPEC[hullId] || HULL_SPEC.prospector).pal]; };

  // ---------- small top-down ship for maps ----------
  SPR.mapShip = function (hullId, dir) {
    const key = 'mship:' + hullId + dir;
    if (cache[key]) return cache[key];
    const pal = SPR.hullPal(hullId);
    const rows = dir > 0 ? ['.kk..', 'kwmmk', 'kwmma', 'kwmmk', '.kk..'] : ['..kk.', 'kmmwk', 'ammwk', 'kmmwk', '..kk.'];
    return (cache[key] = SPR.make(rows, { k: '#0a0f26', w: pal.hi, m: pal.mid, a: '#ff8f3d' }));
  };

  // ---------- ore chips for the UI (tiny asteroid) ----------
  SPR.oreIcon = function (id) {
    const key = 'ore:' + id;
    if (cache[key]) return cache[key];
    const o = AT.ORES[id];
    const c = canvas(12, 12), g = c.getContext('2d');
    AT.R.drawBody(g, 6, 6, 4.6, o.pal, { tex: AT.R.rockTexture(id.length * 977 + id.charCodeAt(0)), rot: 0.6 });
    return (cache[key] = c.toDataURL());
  };
  SPR.oreImg = function (id) { return '<img class="ico" src="' + SPR.oreIcon(id) + '" alt="" draggable="false">'; };
  SPR.bodyIcon = function (t) {
    const key = 'tgt:' + t.id;
    if (cache[key]) return cache[key];
    const cls = AT.CLASSES[t.cls];
    const c = canvas(20, 20), g = c.getContext('2d');
    const pal = Object.keys(t.comp).length ? AT.ORES[Object.entries(t.comp).sort((a, b) => b[1] - a[1])[0][0]].pal : ['#222', '#555', '#999', '#ddd'];
    if (cls.kind === 'star' || cls.kind === 'pulsar') AT.R.drawStar(g, 10, 10, 6, cls.tint, 0, { corona: 0.4 });
    else if (cls.kind === 'galaxy' || cls.kind === 'elliptical' || cls.kind === 'quasar') AT.R.drawGalaxy(g, 10, 10, 9, cls.tint, 0, t.seed, cls.kind);
    else AT.R.drawBody(g, 10, 10, 7.5, ['#0e1120', pal[0], pal[1], pal[2], pal[3]], { tex: AT.R.rockTexture(t.seed % 5000, { icy: cls.kind !== 'rock' }), rot: 0.5, ore: [pal[3], '#ffd866'] });
    return (cache[key] = c.toDataURL());
  };

  // ---------- cursors (2x) ----------
  SPR.cursor = function (name) {
    const key = 'cursor:' + name;
    if (cache[key]) return cache[key];
    const rows = name === 'pick' ? ['...kkkkk.......', '..kwwwwWkk.....', '.kww..kkWWk....', 'kw...knk.kWk...', 'k...knnk..kk...', '...knnk........', '..knnk.........', '.knnk..........', 'knnk...........', 'kkk............']
      : name === 'target' ? ['kkk...kkk', 'kg.....gk', 'k.......k', '....k....', '...kgk...', '....k....', 'k.......k', 'kg.....gk', 'kkk...kkk']
      : ['k..........', 'kk.........', 'kgk........', 'kggk.......', 'kgggk......', 'kggggk.....', 'kgggggk....', 'kggggggk...', 'kgggggggk..', 'kgggkkkkkk.', 'kggk.......', 'kgk........', 'kk.........'];
    const pal = Object.assign({}, P, { n: '#9c6b3a', g: '#ffd866' });
    return (cache[key] = SPR.make(rows, pal, 2).toDataURL());
  };
})(window.AT = window.AT || {});
