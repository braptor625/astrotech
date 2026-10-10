// AstroTech v2 — game content. Every tunable number lives here.
(function (AT) {
  'use strict';

  // =====================================================================
  // REGIONS
  // =====================================================================
  AT.REGIONS = [
    { id: 'inner',  name: 'Inner System',       short: 'INNER',  origin: 'Earth' },
    { id: 'kuiper', name: 'Kuiper Belt',        short: 'KUIPER', origin: 'Earth' },
    { id: 'oort',   name: 'Oort Cloud',         short: 'OORT',   origin: 'Earth' },
    { id: 'stars',  name: 'Interstellar Reach', short: 'STARS',  origin: 'Sol' },
    { id: 'galaxy', name: 'Intergalactic Void', short: 'VOID',   origin: 'Milky Way' },
  ];
  // distance units: 1 unit = 1 second of travel at speed 1
  AT.DIST_UNIT = ['Mkm', 'AU', 'kAU', 'ly', 'Mly'];
  AT.DIST_SCALE = [0.5, 0.05, 0.0025, 0.00005, 0.0000002];

  // =====================================================================
  // ORES ($ per tonne). pal = [shadow, base, light, glint]
  // =====================================================================
  AT.ORES = {
    iron:      { name: 'Iron',            region: 0, price: 20,    pal: ['#3b2f2f', '#6e5a50', '#9c8577', '#c9b3a3'] },
    nickel:    { name: 'Nickel',          region: 0, price: 45,    pal: ['#2f3b3a', '#4f6e69', '#7fa39b', '#bfe3d6'] },
    water:     { name: 'Water Ice',       region: 0, price: 70,    pal: ['#1d3c5c', '#3d79a8', '#86c3ee', '#e8f8ff'] },
    cobalt:    { name: 'Cobalt',          region: 0, price: 140,   pal: ['#1a2a5a', '#2f4fa8', '#5f86e6', '#c0d4ff'] },
    platinum:  { name: 'Platinum',        region: 0, price: 1600,  pal: ['#4a4a5a', '#8a8aa6', '#c8c8e0', '#ffffff'] },
    iridium:   { name: 'Iridium',         region: 0, price: 4200,  pal: ['#3a2a4a', '#7a5a9a', '#c8a0e8', '#f4e8ff'] },
    methane:   { name: 'Methane Ice',     region: 1, price: 8e3,   pal: ['#1f3a3a', '#3a7a6e', '#7ac8b0', '#e0fff4'] },
    nitrogen:  { name: 'Nitrogen Ice',    region: 1, price: 1.8e4,   pal: ['#2a2f4a', '#5a6496', '#9ca6e0', '#eef0ff'] },
    ammonia:   { name: 'Ammonia Ice',     region: 1, price: 4e4,   pal: ['#3a3360', '#6a5fa8', '#a79be6', '#efeaff'] },
    tholin:    { name: 'Tholins',         region: 1, price: 2e5,   pal: ['#4a1f12', '#8f3b1f', '#d9733f', '#ffc08a'] },
    crystal:   { name: 'Cryo Crystals',   region: 1, price: 1e6,   pal: ['#123a4a', '#1f7aa8', '#5fd6ff', '#e8ffff'] },
    cometdust: { name: 'Comet Dust',      region: 2, price: 2e6,   pal: ['#22252e', '#4a5163', '#8a93ab', '#d8deef'] },
    deuterium: { name: 'Deuterium',       region: 2, price: 6e6, pal: ['#0f3a3a', '#1f7a6e', '#4fd1b0', '#c8fff0'] },
    helium3:   { name: 'Helium-3',        region: 2, price: 2e7,   pal: ['#4a3a0a', '#a8841f', '#f0cf4f', '#fff6c8'] },
    exotic:    { name: 'Exotic Ice',      region: 2, price: 1e8,  pal: ['#2a0a3a', '#6a1f8a', '#b04fe0', '#f0c8ff'] },
    alloy:     { name: 'Xeno-Alloy',      region: 2, price: 8e8,pal: ['#0a2a2a', '#1f6a5a', '#4fe0c0', '#ffffff'] },
    plasma:    { name: 'Stellar Plasma',  region: 3, price: 2e8,  pal: ['#5a1a0a', '#c4471c', '#ff8f3d', '#ffe0a8'] },
    degen:     { name: 'Degenerate Matter',region: 3, price: 8e8, pal: ['#2a2a3a', '#5a5a7a', '#a0a0c8', '#f0f0ff'] },
    neutron:   { name: 'Neutronium',      region: 3, price: 4e9,  pal: ['#1a1a2e', '#3d3d6b', '#7a7ac8', '#e0e0ff'] },
    strange:   { name: 'Strange Matter',  region: 3, price: 3e10,  pal: ['#3a0a3a', '#8a1f8a', '#e04fe0', '#ffd0ff'] },
    darkflux:  { name: 'Dark Flux',       region: 4, price: 2e10,  pal: ['#0a0a12', '#25203a', '#4f4380', '#a898ff'] },
    quint:     { name: 'Quintessence',    region: 4, price: 1e11,  pal: ['#0a2a1a', '#1f6a3f', '#4fe08a', '#d0ffe0'] },
    vacuum:    { name: 'False Vacuum',    region: 4, price: 1e12,  pal: ['#000000', '#2a2a2a', '#e0e0e0', '#ffffff'] },
  };

  // =====================================================================
  // TARGET CLASSES — what the observatory can find
  // comp = typical ore mix (weights). dist/haz/size = [min, max]. w = discovery weight
  // =====================================================================
  AT.CLASSES = {
    S:  { name: 'S-type', long: 'Stony asteroid', region: 0, w: 40, comp: { iron: 45, nickel: 30, cobalt: 14, water: 8, platinum: 3 }, dist: [6, 14], haz: [0.06, 0.28], size: [1e5, 5e6], tint: '#b08a6a', kind: 'rock' },
    C:  { name: 'C-type', long: 'Carbonaceous asteroid', region: 0, w: 34, comp: { water: 55, iron: 24, nickel: 12, cobalt: 9 }, dist: [8, 18], haz: [0.04, 0.22], size: [5e5, 2e7], tint: '#5a6a7a', kind: 'rock' },
    M:  { name: 'M-type', long: 'Metallic asteroid', region: 0, w: 18, comp: { iron: 40, nickel: 33, cobalt: 12, platinum: 11, iridium: 4 }, dist: [16, 30], haz: [0.3, 0.58], size: [5e4, 2e6], tint: '#a8a8c0', kind: 'rock' },
    V:  { name: 'V-type', long: 'Vestoid fragment', region: 0, w: 8, comp: { iron: 30, nickel: 18, cobalt: 22, platinum: 18, iridium: 12 }, dist: [24, 40], haz: [0.45, 0.78], size: [1e4, 5e5], tint: '#c8806a', kind: 'rock' },
    KC: { name: 'Cubewano', long: 'Classical Kuiper object', region: 1, w: 40, comp: { methane: 42, nitrogen: 33, ammonia: 20, tholin: 5 }, dist: [120, 190], haz: [0.1, 0.35], size: [1e8, 5e9], tint: '#9ca6e0', kind: 'ice' },
    KP: { name: 'Plutino', long: 'Resonant Kuiper object', region: 1, w: 30, comp: { methane: 30, nitrogen: 28, ammonia: 25, tholin: 13, crystal: 4 }, dist: [140, 210], haz: [0.2, 0.45], size: [5e7, 3e9], tint: '#d9733f', kind: 'ice' },
    KS: { name: 'Scattered Disc', long: 'Scattered disc object', region: 1, w: 20, comp: { ammonia: 30, tholin: 40, crystal: 10, methane: 20 }, dist: [200, 300], haz: [0.4, 0.7], size: [2e7, 1e9], tint: '#a79be6', kind: 'ice' },
    KB: { name: 'Contact Binary', long: 'Contact binary', region: 1, w: 10, comp: { nitrogen: 35, tholin: 30, crystal: 20, ammonia: 15 }, dist: [180, 280], haz: [0.5, 0.8], size: [1e7, 5e8], tint: '#5fd6ff', kind: 'binary' },
    OC: { name: 'Long-Period Comet', long: 'Long-period comet', region: 2, w: 45, comp: { cometdust: 55, deuterium: 30, helium3: 15 }, dist: [2500, 4500], haz: [0.15, 0.4], size: [1e10, 5e11], tint: '#8a93ab', kind: 'comet' },
    OD: { name: 'Dormant Comet', long: 'Dormant comet nucleus', region: 2, w: 35, comp: { cometdust: 40, deuterium: 30, helium3: 20, exotic: 10 }, dist: [3500, 6000], haz: [0.3, 0.55], size: [5e9, 2e11], tint: '#4fd1b0', kind: 'comet' },
    OH: { name: 'Hypervolatile', long: 'Hypervolatile body', region: 2, w: 15, comp: { deuterium: 20, helium3: 40, exotic: 40 }, dist: [5000, 8000], haz: [0.5, 0.8], size: [1e9, 5e10], tint: '#b04fe0', kind: 'comet' },
    OB: { name: 'Beacon', long: 'Unidentified structure', region: 2, w: 5, comp: { alloy: 70, exotic: 30 }, dist: [6000, 9000], haz: [0.6, 0.85], size: [1e8, 1e9], tint: '#4fe0c0', kind: 'beacon', needs: 'r_xeno' },
    SR: { name: 'Red Dwarf', long: 'M-class red dwarf', region: 3, w: 40, comp: { plasma: 80, degen: 20 }, dist: [9e4, 1.6e5], haz: [0.15, 0.4], size: [1e26, 5e26], tint: '#ff6b4a', kind: 'star' },
    SY: { name: 'Yellow Dwarf', long: 'G-class star', region: 3, w: 25, comp: { plasma: 70, degen: 25, neutron: 5 }, dist: [1.2e5, 2.2e5], haz: [0.25, 0.5], size: [1e27, 3e27], tint: '#ffd866', kind: 'star' },
    SW: { name: 'White Dwarf', long: 'Stellar remnant', region: 3, w: 20, comp: { degen: 70, plasma: 20, neutron: 10 }, dist: [1.5e5, 2.6e5], haz: [0.35, 0.6], size: [5e26, 1e27], tint: '#e8ecff', kind: 'star' },
    SN: { name: 'Neutron Star', long: 'Neutron star', region: 3, w: 12, comp: { neutron: 70, degen: 20, strange: 10 }, dist: [2e5, 3.5e5], haz: [0.55, 0.8], size: [2e26, 4e26], tint: '#9ca6ff', kind: 'pulsar' },
    SM: { name: 'Magnetar', long: 'Magnetar', region: 3, w: 4, comp: { neutron: 50, strange: 50 }, dist: [2.5e5, 4e5], haz: [0.7, 0.9], size: [2e26, 3e26], tint: '#e04fe0', kind: 'pulsar' },
    GD: { name: 'Dwarf Galaxy', long: 'Dwarf galaxy', region: 4, w: 45, comp: { darkflux: 80, quint: 20 }, dist: [2e7, 4e7], haz: [0.15, 0.4], size: [1e38, 1e39], tint: '#a898ff', kind: 'galaxy' },
    GS: { name: 'Spiral Galaxy', long: 'Spiral galaxy', region: 4, w: 30, comp: { darkflux: 60, quint: 35, vacuum: 5 }, dist: [3e7, 7e7], haz: [0.3, 0.55], size: [1e40, 1e41], tint: '#86c3ee', kind: 'galaxy' },
    GE: { name: 'Elliptical', long: 'Elliptical galaxy', region: 4, w: 20, comp: { darkflux: 40, quint: 40, vacuum: 20 }, dist: [5e7, 1e8], haz: [0.45, 0.7], size: [1e40, 1e41], tint: '#ffb070', kind: 'elliptical' },
    GQ: { name: 'Quasar', long: 'Quasar host', region: 4, w: 5, comp: { quint: 30, vacuum: 70 }, dist: [8e7, 1.4e8], haz: [0.65, 0.9], size: [1e41, 5e41], tint: '#ffffff', kind: 'quasar' },
  };

  AT.TARGET_NAMES = [
    ['Margarethe', 'Okonkwo', 'Hildegard', 'Tamsin', 'Valdivia', 'Odalys', 'Brannock', 'Isolde', 'Pemberton', 'Aurelio', 'Sibyl', 'Thessaly', 'Corvina', 'Ludmila', 'Ashgrove', 'Marisol', 'Ondine', 'Fenwick', 'Galatea', 'Hollis', 'Imogen', 'Jessamy', 'Kiriko', 'Lysander', 'Maribel', 'Nerissa', 'Orsolya', 'Pallister', 'Quenby', 'Rosalind', 'Saoirse', 'Tiberia', 'Ulrika', 'Vespera', 'Winnow', 'Yevgenia', 'Zephyrine', 'Calloway', 'Delphine', 'Anselm'],
    ['Nunam', 'Tiamaq', 'Sedra', 'Kaltu', 'Oruna', 'Vaskar', 'Ilmar', 'Pelagos', 'Thrym', 'Ekhi', 'Aukahi', 'Morva', 'Nerrivik', 'Qalupa', 'Sila', 'Tornaq', 'Ummag', 'Varuun', 'Wekwek', 'Yahol'],
    null, // comets are named after their discoverer (one of your analysts)
    ['Cinder', 'Halcyon', 'Vigil', 'Ember', 'Lantern', 'Ashfall', 'Meridian', 'Solace', 'Tallow', 'Wick', 'Brand', 'Kindle', 'Pyre', 'Flint', 'Votive', 'Hearth', 'Sconce', 'Gleam'],
    ['Lethe', 'Mnemosyne', 'Vastness', 'Hollow', 'Tapestry', 'Spindle', 'Whorl', 'Murmur', 'Cradle', 'Drift', 'Expanse', 'Silt', 'Undertow', 'Requiem'],
  ];

  // =====================================================================
  // HULLS — ship designs. cost grows x costGrowth per ship of that hull owned
  // rel = base reliability (1 - base risk). speed in distance units / s. drill = t/s
  // =====================================================================
  AT.HULLS = [
    { id: 'prospector', name: 'Prospector', region: 0, cost: 600,    cargo: 8,     speed: 1,    rel: 0.86, drill: 0.5,   unlock: null,           desc: 'One pilot, one drill, one bad idea.' },
    { id: 'hauler',     name: 'Hauler',     region: 0, cost: 1.5e4,   cargo: 60,    speed: 0.85, rel: 0.85, drill: 2.5,   unlock: null,           desc: 'Slow, roomy, mostly airtight.' },
    { id: 'excavator',  name: 'Excavator',  region: 0, cost: 6e5,    cargo: 500,   speed: 1,    rel: 0.86, drill: 20,    unlock: 'r_heavy',      desc: 'Bores straight through small rocks.' },
    { id: 'leviathan',  name: 'Leviathan',  region: 0, cost: 3e7,    cargo: 5000,  speed: 0.9,  rel: 0.84, drill: 200,   unlock: 'r_leviathan',  desc: 'A refinery that happens to fly.' },
    { id: 'torch',      name: 'Torchship',  region: 0, cost: 2e9,  cargo: 4e4,   speed: 2.5,  rel: 0.9,  drill: 1200,  unlock: 'r_torch',      desc: 'Fusion drive. Gets there before the paperwork.' },
    { id: 'icebreaker', name: 'Icebreaker', region: 1, cost: 3e11,    cargo: 1e4,   speed: 6,    rel: 0.9,  drill: 150,   unlock: null, desc: 'Built for the cold and the long way out.' },
    { id: 'cryohauler', name: 'Cryo Hauler',region: 1, cost: 1.5e13,   cargo: 8e4,   speed: 5,    rel: 0.88, drill: 1200,  unlock: 'r_cryohauler', desc: 'Keeps a Kuiper object frozen all the way home.' },
    { id: 'dreadnought',name: 'Dreadnought',region: 1, cost: 6e14,   cargo: 6e5,   speed: 7,    rel: 0.9,  drill: 8000,   unlock: 'r_dread',      desc: 'The size of a town. Staffed like a cemetery.' },
    { id: 'runner',     name: 'Comet Runner',region: 2, cost: 5e16,  cargo: 1e5,   speed: 90,   rel: 0.9,  drill: 1500,   unlock: null,     desc: 'Matches orbit with things that do not want company.' },
    { id: 'harvester',  name: 'Deep Harvester',region: 2, cost: 2e18, cargo: 1e6,  speed: 80,   rel: 0.9,  drill: 12000,   unlock: 'r_harvester',  desc: 'Swallows comets whole.' },
    { id: 'lifter',     name: 'Star Lifter',region: 3, cost: 5e20,   cargo: 1e6,  speed: 2500, rel: 0.9,  drill: 12000,  unlock: null,     desc: 'Siphons a star one magnetic funnel at a time.' },
    { id: 'suneater',   name: 'Sun Eater',  region: 3, cost: 2e22,   cargo: 1e7,  speed: 3000, rel: 0.92, drill: 1e5,  unlock: 'r_suneater',   desc: 'Named by marketing. Accurate anyway.' },
    { id: 'ark',        name: 'Void Ark',   region: 4, cost: 5e24,   cargo: 1e7,  speed: 1.2e5,rel: 0.92, drill: 1e5,  unlock: null,        desc: 'Crosses the gap between galaxies with no one aboard.' },
    { id: 'ledger',     name: 'Ledger',     region: 4, cost: 2e26,   cargo: 1e8,  speed: 1.5e5,rel: 0.95, drill: 1e6,  unlock: 'r_ledgership', desc: 'The final ship. It records what it takes.' },
  ];
  AT.HULL_COST_GROWTH = 1.8;

  // fleet-wide upgrades per hull type. cost = hull.cost * base * growth^level
  AT.MODULES = [
    { id: 'engine',  name: 'Engines',      base: 0.7,  growth: 2.2, max: 12, per: 1.15, desc: 'Travel speed' },
    { id: 'cargo',   name: 'Cargo Bays',   base: 0.9,  growth: 2.3, max: 12, per: 1.22, desc: 'Cargo per trip' },
    { id: 'drill',   name: 'Drills',       base: 0.6,  growth: 2.2, max: 12, per: 1.25, desc: 'Mining speed' },
    { id: 'plating', name: 'Hull Plating', base: 0.8,  growth: 2.2, max: 12, per: 0.89, desc: 'Failure risk' },
    { id: 'nav',     name: 'Nav Computer', base: 0.8,  growth: 2.2, max: 12, per: 0.9,  desc: 'Hazard exposure' },
  ];

  // =====================================================================
  // LAUNCH PADS, OBSERVATORY, PROBES
  // =====================================================================
  AT.PADS = { cost: 3000, growth: 4 };
  AT.OBS = { cost: 1500, growth: 2.6, max: 25, interval: 40, cap: 6, capPer: 1 };
  AT.PROBE = { cost: 4000, growth: 6, max: 6, surveyBase: 12, surveyCost: 60 };

  // =====================================================================
  // STAFF (counted roles) & PILOTS (individuals)
  // =====================================================================
  AT.STAFF = [
    { id: 'engineer',  name: 'Engineer',  cost: 300, growth: 1.48, desc: 'Repairs 15% faster each. Fleet upgrades 2% cheaper each (to 50%).' },
    { id: 'trader',    name: 'Trader',    cost: 400, growth: 1.5,  desc: 'Market depth +12% and price recovery +6% each. Contract rewards +3% each.' },
    { id: 'scientist', name: 'Scientist', cost: 150, growth: 1.45, desc: 'Produces research. Output grows with revenue.' },
    { id: 'analyst',   name: 'Analyst',   cost: 250, growth: 1.48, desc: 'Discovery 12% faster and surveys 5% faster each.' },
  ];
  AT.SALARY_RATE = 0.002;

  AT.PILOT = { cost: 400, growth: 1.55, salary: 0.4, maxLevel: 20, xpBase: 3, xpGrowth: 1.45 };
  AT.TRAITS = [
    { id: 'steady',   name: 'Steady',          desc: 'Risk -12%.' },
    { id: 'daredevil',name: 'Daredevil',       desc: 'Speed +20%, risk +10%.' },
    { id: 'eye',      name: "Prospector's Eye", desc: 'Cargo value +12%.' },
    { id: 'tinker',   name: 'Tinkerer',        desc: 'Ship wear halved.' },
    { id: 'lucky',    name: 'Lucky',           desc: 'Artifact finds x3. Lost ships become failures.' },
    { id: 'veteran',  name: 'Veteran',         desc: 'Gains XP 60% faster.' },
    { id: 'greedy',   name: 'Greedy',          desc: 'Cargo +18%. Salary x2.' },
    { id: 'quiet',    name: 'Quiet',           desc: 'No effect. Never complains.' },
  ];
  AT.FIRST_NAMES = ['Ada', 'Amara', 'Anika', 'Bruno', 'Chen', 'Dara', 'Diego', 'Elif', 'Emeka', 'Farah', 'Gustavo', 'Hana', 'Ibrahim', 'Ines', 'Jun', 'Kaito', 'Kofi', 'Lars', 'Leila', 'Mateo', 'Mei', 'Nadia', 'Nikolai', 'Oksana', 'Omar', 'Priya', 'Quinn', 'Rafael', 'Rania', 'Sana', 'Soren', 'Tariq', 'Thandi', 'Uma', 'Vera', 'Wen', 'Yara', 'Yusuf', 'Zofia', 'Ravi', 'Ingrid', 'Tomas', 'Aiyana', 'Bao', 'Cosmin', 'Dilnoza'];
  AT.LAST_NAMES = ['Abara', 'Bianchi', 'Castillo', 'Dlamini', 'Eriksen', 'Fontaine', 'Gupta', 'Haddad', 'Ishikawa', 'Jovanovic', 'Kowalski', 'Lindqvist', 'Mensah', 'Nakamura', 'Okafor', 'Petrova', 'Quispe', 'Rahman', 'Santos', 'Tanaka', 'Umarov', 'Varga', 'Wojcik', 'Xu', 'Yilmaz', 'Zhang', 'Reyes', 'Morales', 'Novak', 'Baptiste', 'Achebe', 'Holm', 'Kaur', 'Sato', 'Duarte', 'Moreau', 'Sokolov', 'Mwangi', 'Nilsen', 'Ortega'];
  AT.SHIP_NAMES = ['Due Diligence', 'Fiduciary Duty', 'Acceptable Risk', 'Shareholder Value', 'Synergy', 'Margin Call', 'Quarterly Target', 'Golden Parachute', 'Market Correction', 'Sunk Cost', 'Opportunity Cost', 'Leveraged Buyout', 'Externality', 'Force Majeure', 'Limited Liability', 'Bottom Line', 'Growth Mindset', 'Core Competency', 'Value Proposition', 'Burn Rate', 'Exit Strategy', 'Blue Sky', 'Low-Hanging Fruit', 'Deliverable', 'Headcount', 'Rightsizing', 'Paradigm Shift', 'Disruptor', 'Bull Run', 'Dividend', 'Compound Interest', 'Asset Stripper', 'Going Concern', 'Net Positive', 'Kestrel', 'Persistence', 'Long Shot', 'Patience', 'Second Wind', 'Lodestar', 'Harbinger', 'Small Mercy', 'Fine Print', 'Collateral', 'Write-Off', 'Hard Target', 'Terms Apply', 'Overtime'];

  // =====================================================================
  // OUTPOSTS — permanent mining bases built on a surveyed target
  // =====================================================================
  AT.OUTPOST = {
    names: ['Outpost', 'Ice Station', 'Comet Rig', 'Dyson Swarm', 'Galactic Siphon'],
    cost: [2e6, 3e10, 5e14, 5e18, 5e22],    // first outpost per region
    costGrowth: 5,                          // each further outpost in the same region
    rate: [8, 100, 1e3, 1e4, 1e5],          // tonnes/s at level 1
    lvlCost: 0.22, lvlGrowth: 1.25, maxLevel: 100, perRegion: 10, buildTime: [60, 90, 120, 150, 180],
  };

  // =====================================================================
  // CONTRACTS
  // =====================================================================
  AT.CLIENTS = [
    ['Lunar Foundry Consortium', 'Mars Water Authority', 'Ceres Free Port', 'L5 Shipwrights', 'Terran Defense Directorate', 'Helios Solar Arrays'],
    ['Triton Cryo Combine', 'Neptune Relay Authority', 'Saturn Ring Collective', 'Titan Petrochemical'],
    ['Oort Survey Trust', 'Heliopause Holdings', 'The Long Dark Society'],
    ['Proxima Development Corp', 'Stellar Remediation Board', 'Barnard Holdings'],
    ['The Remaining Shareholders', 'Andromeda Receivership'],
  ];
  AT.REP_LEVELS = [0, 8, 25, 60, 130, 280, 600, 1300, 2800, 6000, 13000];
  AT.REP_VALUE = 1.05; // ore price bonus per reputation level

  // =====================================================================
  // RESEARCH — per-region pages; col/row place nodes on that page's grid
  // =====================================================================
  AT.RESEARCH = [
    // ---- Inner System
    { id: 'r_orbits',    region: 0, col: 0, row: 0, cost: 24,     req: [],                        fx: { speed: 1.3 },             name: 'Orbital Mechanics',   desc: 'Ships travel 30% faster.' },
    { id: 'r_drill1',    region: 0, col: 0, row: 1, cost: 32,     req: [],                        fx: { drill: 1.5 },             name: 'Tungsten Bits',       desc: 'Drills work 50% faster.' },
    { id: 'r_repair',    region: 0, col: 0, row: 2, cost: 48,    req: [],                        fx: { repair: 2, autorepair: 1 }, name: 'Field Repair Kits', desc: 'Repairs twice as fast. Unlocks auto-repair.' },
    { id: 'r_autosell',  region: 0, col: 0, row: 3, cost: 60,    req: [],                        fx: { autosell: 1 },            name: 'Sales Daemon',        desc: 'Unlocks automatic ore sales.' },
    { id: 'r_flight',    region: 0, col: 1, row: 0, cost: 120,    req: ['r_orbits'],              fx: { flight: 1 },              name: 'Flight Director',     desc: 'Ships can repeat their last mission automatically.' },
    { id: 'r_spectro',   region: 0, col: 1, row: 1, cost: 140,    req: ['r_drill1'],              fx: { surveyTime: 0.5, surveyRisk: 1 }, name: 'Spectrometry', desc: 'Surveys take half as long. Unsurveyed risk penalty reduced.' },
    { id: 'r_pods',      region: 0, col: 1, row: 2, cost: 360,    req: ['r_repair'],              fx: { pods: 1 },                name: 'Escape Pods',         desc: 'Pilots survive when their ship is lost.' },
    { id: 'r_incorp',    region: 0, col: 1, row: 3, cost: 200,    req: ['r_autosell'],            fx: { incorp: 1 },              name: 'Incorporation',       desc: 'Go public. Unlocks shares; valuation x1.5.' },
    { id: 'r_autopilot', region: 0, col: 2, row: 0, cost: 560,   req: ['r_flight'],              fx: { autopilot: 1 },           name: 'Autopilot',           desc: 'Ships without a pilot can fly, at 60% more risk.' },
    { id: 'r_heavy',     region: 0, col: 2, row: 1, cost: 440,   req: ['r_spectro'],             fx: {},                         name: 'Heavy Hulls',         desc: 'Unlocks the Excavator.' },
    { id: 'r_shield',    region: 0, col: 2, row: 2, cost: 1200,   req: ['r_pods'],                fx: { risk: 0.8 },              name: 'Whipple Shielding',   desc: 'Mission risk -20%.' },
    { id: 'r_analytics', region: 0, col: 2, row: 3, cost: 480,   req: ['r_incorp'],              fx: { depth: 1.5, analytics: 1 }, name: 'Market Analytics', desc: 'Price trend readouts. Market depth +50%.' },
    { id: 'r_drill2',    region: 0, col: 3, row: 0, cost: 1800,   req: ['r_autopilot'],           fx: { drill: 2 },               name: 'Laser Drills',        desc: 'Drills work twice as fast.' },
    { id: 'r_leviathan', region: 0, col: 3, row: 1, cost: 3600,   req: ['r_heavy'],               fx: {},                         name: 'Leviathan Program',   desc: 'Unlocks the Leviathan.' },
    { id: 'r_outposts',  region: 0, col: 3, row: 2, cost: 2800,   req: ['r_shield'],              fx: { outposts: 1 },            name: 'Orbital Habitats',    desc: 'Build permanent outposts on surveyed asteroids.' },
    { id: 'r_relations', region: 0, col: 3, row: 3, cost: 1600,   req: ['r_analytics'],           fx: { contract: 1.5, contractSlots: 1 }, name: 'Client Relations', desc: 'Contract rewards +50%. One more contract on the board.' },
    { id: 'r_fleetai',   region: 0, col: 4, row: 0, cost: 10000,  req: ['r_drill2'],              fx: { fleetai: 1 },             name: 'Fleet Coordination AI', desc: 'Idle ships pick their own targets and surveys run themselves.' },
    { id: 'r_smelt',     region: 0, col: 4, row: 1, cost: 7200,  req: ['r_leviathan'],           fx: { value: 1.5 },             name: 'Orbital Smelting',    desc: 'All ore sells for 50% more.' },
    { id: 'r_massdriver',region: 0, col: 4, row: 2, cost: 14000,  req: ['r_outposts'],            fx: { outpost: 2 },             name: 'Mass Drivers',        desc: 'Outposts ship twice as much ore.' },
    { id: 'r_guidance',  region: 0, col: 4, row: 3, cost: 8000,  req: ['r_relations'],           fx: { guidance: 1 },            name: 'Guidance Management', desc: 'Quarterly targets demand 10% growth instead of 20%.' },
    { id: 'r_torch',     region: 0, col: 5, row: 0, cost: 36000,  req: ['r_fleetai', 'r_smelt'],  fx: {},                         name: 'Torch Drives',        desc: 'Unlocks the Torchship.' },
    { id: 'r_deep',      region: 0, col: 5, row: 2, cost: 48000, req: ['r_massdriver'],          fx: { deep: 1 },                name: 'Deep Core Drilling',  desc: 'Asteroid reserves count 100x larger.' },
    { id: 'r_mind',      region: 0, col: 5, row: 1, cost: 80000, req: ['r_torch'],               fx: { all: 2 },                 name: 'Fleet Mind',          desc: 'Everything sells for 2x.' },
    { id: 'r_buyback',   region: 0, col: 5, row: 3, cost: 24000,  req: ['r_guidance'],            fx: { confFloor: 1 },           name: 'Board Automation',    desc: 'Investor confidence never drops below 1.0.' },
    // ---- Kuiper Belt
    { id: 'r_icebreaker',region: 1, col: 0, row: 0, cost: 900000,   req: [],                        fx: { risk: 0.85 },             name: 'Cold-Rated Hulls',    desc: 'Mission risk -15%.' },
    { id: 'r_cryo',      region: 1, col: 0, row: 1, cost: 1.5e+06,   req: [],                        fx: { value: 2 },               name: 'Cryo-Refining',       desc: 'All ore sells for 2x.' },
    { id: 'r_deepfield', region: 1, col: 0, row: 2, cost: 1.2e+06,   req: [],                        fx: { discovery: 2, targetCap: 4 }, name: 'Deep Field Telescope', desc: 'Discovery 2x faster. Track 4 more targets.' },
    { id: 'r_futures',   region: 1, col: 0, row: 3, cost: 1.8e+06,   req: [],                        fx: { depth: 2, recovery: 1.5 }, name: 'Futures Desk',       desc: 'Market depth x2, price recovery +50%.' },
    { id: 'r_staging',   region: 1, col: 1, row: 0, cost: 4.5e+06, req: ['r_icebreaker'],          fx: { staging: 1 },             name: 'Belt Staging Bases',  desc: 'With any Inner System outpost, Kuiper trips are 40% shorter.' },
    { id: 'r_cryohauler',region: 1, col: 1, row: 1, cost: 1.2e+06,   req: ['r_icebreaker'],          fx: {},                         name: 'Cryo Hauler Program', desc: 'Unlocks the Cryo Hauler.' },
    { id: 'r_notebooks', region: 1, col: 1, row: 2, cost: 7.5e+06, req: ['r_deepfield'],           fx: { rp: 2 },                  name: 'Quantum Notebooks',   desc: 'Research x2.' },
    { id: 'r_aipilots',  region: 1, col: 1, row: 3, cost: 2.4e+06,   req: ['r_futures'],             fx: { aipilots: 1 },            name: 'AI Pilots',           desc: 'Pilotless ships fly at 20% less risk than base. Pilots become optional.' },
    { id: 'r_kuiperhab', region: 1, col: 2, row: 0, cost: 6e+06,   req: ['r_staging'],             fx: { outpost: 2 },             name: 'Ice Stations',        desc: 'Outposts output x2.' },
    { id: 'r_dread',     region: 1, col: 2, row: 1, cost: 1.8e+07,   req: ['r_cryohauler'],          fx: {},                         name: 'Dreadnought Program', desc: 'Unlocks the Dreadnought.' },
    { id: 'r_triage',    region: 1, col: 2, row: 2, cost: 9e+06,   req: ['r_notebooks'],           fx: { risk: 0.75 },             name: 'Automated Triage',    desc: 'Mission risk -25%.' },
    { id: 'r_hedge',     region: 1, col: 2, row: 3, cost: 1.2e+07,   req: ['r_aipilots'],            fx: { all: 2 },                 name: 'Hedged Positions',    desc: 'Everything sells for 2x.' },
    // ---- Oort Cloud
    { id: 'r_runner',    region: 2, col: 0, row: 0, cost: 5e+08,   req: [],                        fx: { speed: 1.5 },             name: 'Comet Matching',      desc: 'Ships travel 50% faster.' },
    { id: 'r_hooks',     region: 2, col: 0, row: 1, cost: 8e+08,   req: [],                        fx: { drill: 4 },               name: 'Comet Hooks',         desc: 'Drills x4.' },
    { id: 'r_xeno',      region: 2, col: 0, row: 2, cost: 2e+09,   req: [],                        fx: {},                         name: 'Xeno-Linguistics',    desc: 'The observatory can find Beacons.' },
    { id: 'r_longlabs',  region: 2, col: 0, row: 3, cost: 1.5e+09, req: [],                        fx: { rp: 5 },                  name: 'Long-Period Labs',    desc: 'Research x5.' },
    { id: 'r_harvester', region: 2, col: 1, row: 0, cost: 2e+10,   req: ['r_runner'],              fx: {},                         name: 'Harvester Program',   desc: 'Unlocks the Deep Harvester.' },
    { id: 'r_rigs',      region: 2, col: 1, row: 1, cost: 3e+10,   req: ['r_hooks'],               fx: { outpost: 3 },             name: 'Comet Rigs',          desc: 'Outposts output x3.' },
    { id: 'r_fold',      region: 2, col: 1, row: 2, cost: 6e+10,   req: ['r_xeno'],                fx: { speed: 2.5 },             name: 'Fold Geometry',       desc: 'Ships travel 2.5x faster. The equations came from a Beacon.' },
    { id: 'r_fleetmind2',region: 2, col: 1, row: 3, cost: 1e+11,  req: ['r_longlabs'],            fx: { all: 3 },                 name: 'Distributed Board',   desc: 'Everything sells for 3x.' },
    // ---- Stars
    { id: 'r_lifter',    region: 3, col: 0, row: 0, cost: 1e+13,  req: [],                        fx: { cargo: 2 },               name: 'Star Lifting Theory', desc: 'Cargo x2.' },
    { id: 'r_dyson',     region: 3, col: 0, row: 1, cost: 3e+13,  req: [],                        fx: { outpost: 4 },             name: 'Dyson Swarms',        desc: 'Outposts output x4.' },
    { id: 'r_recursive', region: 3, col: 0, row: 2, cost: 5e+13,  req: [],                        fx: { rp: 10, all: 2 },         name: 'Recursive Minds',     desc: 'Research x10. Everything x2.' },
    { id: 'r_suneater',  region: 3, col: 1, row: 0, cost: 8e+14,  req: ['r_lifter'],              fx: {},                         name: 'Sun Eater Program',   desc: 'Unlocks the Sun Eater.' },
    { id: 'r_stellarmkt',region: 3, col: 1, row: 1, cost: 2e+15,  req: ['r_dyson'],               fx: { depth: 10, value: 3 },    name: 'Stellar Exchange',    desc: 'Market depth x10. Everything sells for 3x.' },
    { id: 'r_nopilots',  region: 3, col: 1, row: 2, cost: 4e+15,  req: ['r_recursive'],           fx: { risk: 0.5 },              name: 'Post-Human Navigation',desc: 'Mission risk halved.' },
    // ---- Void
    { id: 'r_ark',       region: 4, col: 0, row: 0, cost: 1e+18,  req: [],                        fx: { speed: 2 },               name: 'Void Navigation',     desc: 'Ships travel 2x faster.' },
    { id: 'r_siphon',    region: 4, col: 0, row: 1, cost: 3e+18,  req: [],                        fx: { outpost: 10 },            name: 'Galactic Siphons',    desc: 'Outposts output x10.' },
    { id: 'r_voidmkt',   region: 4, col: 0, row: 2, cost: 5e+18,  req: [],                        fx: { depth: 100, all: 5 },     name: 'Void Markets',        desc: 'Market depth x100. Everything x5.' },
    { id: 'r_ledgership',region: 4, col: 1, row: 0, cost: 1e+20,  req: ['r_ark'],                 fx: {},                         name: 'The Ledger',          desc: 'Unlocks the Ledger.' },
    { id: 'r_lastledger',region: 4, col: 1, row: 1, cost: 5e+20,  req: ['r_siphon', 'r_voidmkt'], fx: { all: 10 },               name: 'Nothing Off the Books', desc: 'Everything x10.' },
  ];

  // =====================================================================
  // PROJECTS — one-off company initiatives (Paperclips style)
  // show: { earned, missions, losses, staff, region, outposts }
  // =====================================================================
  AT.PROJECTS = [
    { id: 'p_logo',      cost: 2500,  show: { earned: 1200 },   fx: { value: 1.1 },             name: 'Paint the Logo',              desc: 'Ore sells for 10% more. It looks official now.', log: 'The logo is a pickaxe crossing a star. Nobody remembers voting on it.' },
    { id: 'p_insurance', cost: 6000,  show: { losses: 1 },      fx: { insurance: 2.5 },         name: 'Hull Insurance',              desc: 'Lost ships refund 75% of their price instead of 30%.', log: 'The policy covers hulls, cargo and launch fees. Pilots are listed under "consumables".' },
    { id: 'p_pods',      cost: 15000, show: { missions: 12 },   fx: { cargo: 1.25 },            name: 'Bigger Cargo Pods',           desc: 'Cargo +25%.' },
    { id: 'p_survey',    cost: 4e4,   show: { earned: 2e4 },    fx: { discovery: 1.5, targetCap: 3 }, name: 'Belt Survey Contract',  desc: 'Discovery 50% faster. Track 3 more targets.', log: 'Every rock within forty light-seconds is now on a spreadsheet.' },
    { id: 'p_recruit',   cost: 1.2e5, show: { staff: 6 },       fx: { hire: 0.7 },              name: 'Recruitment Campaign',        desc: 'Hiring costs 30% less.' },
    { id: 'p_vesta',     cost: 1.5e6, show: { earned: 4e5 },    fx: { depth: 1.5 },             name: 'Acquire Vesta Minerals',      desc: 'One less competitor. Market depth +50%.', log: 'Vesta Minerals is ours. Their crews were let go before the ink dried.' },
    { id: 'p_interlock', cost: 6e6,   show: { missions: 150 },  fx: { speed: 1.4, drill: 1.4, risk: 1.2 }, name: 'Disable Safety Interlocks', desc: 'Speed and drills +40%. Risk +20%.', log: 'Incident report #4471 filed. Incident report #4472 filed. Incident report #4473 filed.' },
    { id: 'p_lobby',     cost: 3e7,   show: { earned: 8e6 },    fx: { salary: 0.75, depth: 1.25 }, name: 'Lobby the Belt Authority', desc: 'Salaries -25%. Market depth +25%.', log: 'The Belt Authority approved our safety record. The Belt Authority has a new board member.' },
    { id: 'p_ceres',     cost: 4e8,   show: { earned: 1e8 },    fx: { value: 1.5 },             name: 'Annex Ceres Station',         desc: 'Ore sells for 50% more.', log: 'Ceres residents were offered relocation packages. Most accepted.' },
    { id: 'p_overseer',  cost: 2e9,   show: { earned: 5e8 },    fx: { autohire: 1 },            name: 'Install Overseer AI',         desc: 'Unlocks automatic staff hiring.', log: 'OVERSEER online. It has requested read access to payroll. Granted.' },
    { id: 'p_pluto',     cost: 2e13,  show: { region: 1, earned: 5e12 }, fx: { cargo: 2 },      name: 'Strip-Mine Pluto',            desc: 'Cargo x2.', log: 'The IAU filed a complaint about Pluto. It has been noted.' },
    { id: 'p_triton',    cost: 5e14,  show: { region: 1, earned: 1e14 }, fx: { value: 2 },      name: 'Capture Triton',              desc: 'Ore sells for 2x.', log: 'Triton has been towed to a more convenient orbit. Neptune did not object.' },
    { id: 'p_tithe',     cost: 1e16,  show: { region: 1, earned: 3e15 }, fx: { salary: 0.5 },   name: 'Indenture Agreements',        desc: 'Salaries halved.', log: 'New hires sign for forty years. The pension vests at forty-one.' },
    { id: 'p_beacons',   cost: 1e22,  show: { region: 2, earned: 3e21 }, fx: { all: 2 },        name: 'Silence the Deep Beacons',    desc: 'Everything x2. They were in the way.', log: 'The beacons were not ours. They were broadcasting a warning. They are quiet now.' },
    { id: 'p_sedna',     cost: 1e24,  show: { region: 2, earned: 2e23 }, fx: { speed: 3 },      name: 'Hollow Out Sedna',            desc: 'Ships travel 3x faster from a Sedna relay.' },
    { id: 'p_heliopause',cost: 5e25,  show: { region: 2, earned: 1e25 }, fx: { depth: 5 },      name: 'Privatize the Heliopause',    desc: 'Market depth x5.', log: 'The edge of the solar system is now a gated community.' },
    { id: 'p_sun',       cost: 1e34,  show: { region: 3, earned: 2e33 }, fx: { value: 3 },      name: 'Lift the Sun',                desc: 'Everything sells for 3x.', log: "Solar output is down 4%. Earth's weather has been reclassified as an externality." },
    { id: 'p_earth',     cost: 1e37,  show: { region: 3, earned: 2e36 }, fx: { all: 5, depth: 3 }, name: 'Acquire Earth',            desc: 'Everything x5. Market depth x3.', log: 'Eight billion new shareholders. None of them voting.' },
    { id: 'p_proxima',   cost: 1e40,  show: { region: 3, earned: 2e39 }, fx: { outpost: 5 },    name: 'Proxima Development Plan',    desc: 'Outposts output x5.', log: 'Proxima b had a biosphere. It has been reclassified as a resource.' },
    { id: 'p_milkyway',  cost: 1e55,  show: { region: 4, earned: 1e54 }, fx: { all: 10 },       name: 'Dismantle the Milky Way',     desc: 'Everything x10.', log: 'The galaxy is a supply chain now. The night sky over Earth went dark on a Tuesday.' },
    { id: 'p_andromeda', cost: 1e65,  show: { region: 4, earned: 1e64 }, fx: { all: 20, depth: 5 }, name: 'Hostile Takeover: Andromeda', desc: 'Everything x20. Market depth x5.', log: 'Andromeda resisted. Andromeda was restructured.' },
    { id: 'p_market',    cost: 1e78,  show: { region: 4, earned: 1e77 }, fx: { depth: 1e3, recovery: 10 }, name: 'Become the Market',   desc: 'Every buyer is a subsidiary. Prices barely move.', log: 'Every buyer is a subsidiary. Every seller is AstroTech. The ledger balances itself.' },
  ];

  // =====================================================================
  // INCIDENTS — decision cards. fx: cash (seconds of revenue), rep, rp (seconds of research),
  // buff [key, mult, seconds], salaryRun (permanent multiplier this run), injure (pilot seconds), xp
  // =====================================================================
  AT.INCIDENTS = [
    { id: 'i_hazardpay', min: 0, need: 'pilot', title: 'Hazard Pay', text: '{pilot} is requesting hazard pay for deep-belt runs.',
      a: { label: 'Approve', fx: { cash: -30, buff: ['risk', 0.85, 300] }, log: 'Hazard pay approved. Morale improved.' },
      b: { label: 'Deny', fx: { buff: ['risk', 1.15, 300] }, log: '{pilot} flew anyway. They did not smile.' } },
    { id: 'i_journalist', min: 0, need: 'loss', title: 'The Journalist', text: 'A reporter is asking about the loss of {lostship}.',
      a: { label: 'No comment', fx: { rep: -2 }, log: 'The story ran with a photo of the launch complex at night.' },
      b: { label: 'Public statement', fx: { cash: -20, rep: 3 }, log: 'The statement used the word "tragedy" twice and "unavoidable" three times.' } },
    { id: 'i_union', min: 0, need: 'staff', title: 'Union Organizers', text: 'Union flyers are appearing in the hangar.',
      a: { label: 'Recognize union', fx: { salaryRun: 1.1, buff: ['risk', 0.9, 900], rep: 3 }, log: 'The union was recognized. Safety complaints dropped by half.' },
      b: { label: 'Hire consultants', fx: { cash: -60 }, log: 'The flyers stopped appearing. So did three engineers.' } },
    { id: 'i_databuyer', min: 0, need: 'survey', title: 'Survey Data Buyer', text: 'A rival firm offers to buy your survey data.',
      a: { label: 'Sell it', fx: { cash: 90, buff: ['discovery', 0.6, 600] }, log: 'Survey data sold. The rival is now mining two of our best prospects.' },
      b: { label: 'Refuse', fx: { rep: 1 }, log: 'The rival said they would find it themselves. They did, eventually.' } },
    { id: 'i_debris', min: 0, need: 'missions', title: 'Debris Field', text: 'Tailings from {target} are drifting toward a weather satellite.',
      a: { label: 'Send a cleanup tug', fx: { cash: -40, rep: 2 }, log: 'The debris was cleared. Nobody noticed, which was the point.' },
      b: { label: 'Ignore it', fx: { rep: -3 }, log: 'The satellite went dark over the Pacific. Nobody linked it to us.' } },
    { id: 'i_audit', min: 0, need: 'missions', title: 'Safety Audit', text: 'A Belt Authority inspector requests full access to the launch complex.',
      a: { label: 'Comply', fx: { buff: ['speed', 0.8, 300], rep: 3 }, log: 'Launches slowed for the inspection. The report was mostly fine.' },
      b: { label: 'Expedite with a gift', fx: { cash: -30 }, log: 'The inspector found everything in order. The inspector has a new boat.' } },
    { id: 'i_overtime', min: 0, need: 'missions', title: 'Overtime', text: 'The board suggests double shifts at the drills.',
      a: { label: 'Approve', fx: { buff: ['drill', 1.6, 300], buff2: ['risk', 1.25, 300] }, log: 'Double shifts approved. Output is up. So are injuries.' },
      b: { label: 'Decline', fx: {}, log: 'The board noted your hesitation.' } },
    { id: 'i_speculators', min: 0, need: 'incorp', title: 'Ore Speculators', text: 'A hedge fund wants advance notice of your sales.',
      a: { label: 'Partner with them', fx: { cash: 120, buff: ['depth', 0.6, 600] }, log: 'The partnership was profitable. The market got thinner.' },
      b: { label: 'Refuse', fx: { rep: 1 }, log: 'The fund shorted us for a week, then lost interest.' } },
    { id: 'i_probe', min: 0, need: 'missions', title: 'Lost Probe', text: 'An old government probe is drifting near {target}.',
      a: { label: 'Salvage it', fx: { rp: 120 }, log: 'The probe had forty years of data on it. And a plaque with a child\'s drawing.' },
      b: { label: 'Leave it', fx: { rep: 1 }, log: 'The probe drifted on, still transmitting to no one.' } },
    { id: 'i_stowaway', min: 0, need: 'missions', title: 'Stowaway', text: 'A teenager was found hiding in the cargo hold of {ship}.',
      a: { label: 'Fly them home', fx: { cash: -20, rep: 2 }, log: 'The stowaway was returned home. They asked for an application form.' },
      b: { label: 'Bill the family', fx: { cash: 5, rep: -2 }, log: 'The invoice was paid in installments.' } },
    { id: 'i_quarter', min: 0, need: 'incorp', title: 'Quarterly Pressure', text: 'Analysts expect a strong quarter. The board wants a sales push.',
      a: { label: 'Dump inventory', fx: { cash: 60, buff: ['value', 0.85, 300] }, log: 'Revenue spiked. Prices took a while to recover.' },
      b: { label: 'Hold steady', fx: {}, log: 'The analysts were disappointed in a measured, quarterly way.' } },
    { id: 'i_leave', min: 0, need: 'pilot', title: 'Medical Leave', text: '{pilot} is requesting two weeks of leave.',
      a: { label: 'Grant leave', fx: { injure: 300, rep: 1 }, log: '{pilot} took leave and came back rested.' },
      b: { label: 'Deny', fx: { xp: 2, buff: ['risk', 1.1, 300] }, log: '{pilot} kept flying. Their reaction times have not been tested since.' } },
    { id: 'i_mayday', min: 0, need: 'missions', title: 'Mayday', text: 'A rival ship is broadcasting a distress call near {target}.',
      a: { label: 'Divert to rescue', fx: { cash: -30, rep: 5 }, log: 'Four crew rescued. Their company sent a thank-you card and an invoice for the fuel.' },
      b: { label: 'Maintain course', fx: { rep: -3 }, log: 'The mayday stopped after nine minutes.' } },
    { id: 'i_patent', min: 0, need: 'missions', title: 'Patent Claim', text: 'A holding company claims to own your drill design.',
      a: { label: 'Settle', fx: { cash: -60 }, log: 'Settled out of court. The holding company had two employees.' },
      b: { label: 'Fight it', fx: { buff: ['moduleCost', 1.3, 900] }, log: 'Legal fees are being added to every fleet upgrade until this is over.' } },
    { id: 'i_automate', min: 0, need: 'staff', title: 'Automation Proposal', text: 'Operations proposes replacing the night shift with drones.',
      a: { label: 'Approve', fx: { salaryRun: 0.9, rep: -2 }, log: 'The night shift was told by email.' },
      b: { label: 'Decline', fx: { rep: 1 }, log: 'The proposal was tabled until next quarter.' } },
    { id: 'i_memorial', min: 0, need: 'death', title: 'Memorial', text: 'Families of lost crew are asking for a memorial at the launch complex.',
      a: { label: 'Fund a memorial', fx: { cash: -30, rep: 4 }, log: 'A memorial wall was built. There is space reserved for more names.' },
      b: { label: 'Send a form letter', fx: { rep: -3 }, log: 'The form letter had a typo in the name.' } },
    { id: 'i_signal', min: 2, need: 'missions', title: 'Structured Noise', text: 'Analysts have found a repeating pattern in Oort background noise.',
      a: { label: 'Investigate', fx: { rp: 300 }, log: 'The pattern is a countdown. Nobody knows to what.' },
      b: { label: 'Classify it', fx: {}, log: 'The file was sealed. The analyst who found it was promoted and relocated.' } },
    { id: 'i_protest', min: 3, need: 'missions', title: 'Protest', text: 'Thousands are protesting outside the launch complex. The sky is getting darker.',
      a: { label: 'Meet them', fx: { cash: -30, rep: 3 }, log: 'You met with the protesters. They wanted the Sun back.' },
      b: { label: 'Private security', fx: { rep: -4 }, log: 'The complex was cleared by morning.' } },
    { id: 'i_lastpilot', min: 3, need: 'pilot', title: 'Retirement', text: '{pilot} is the last human pilot on staff. They have asked to fly one more mission.',
      a: { label: 'One more flight', fx: { xp: 5, rep: 2 }, log: '{pilot} flew one more mission and did not come to the retirement party.' },
      b: { label: 'Retire them now', fx: {}, log: '{pilot} was retired with a plaque. The plaque was made by a drone.' } },
  ];

  // =====================================================================
  // EXPEDITIONS — story missions. Appear in the target list when `when` is met.
  // Each resolves into a two-option choice that grants one of two artifacts.
  // =====================================================================
  AT.EXPEDITIONS = [
    { id: 'x_derelict', region: 0, when: { missions: 8 }, name: 'Derelict: VMS Prospector-9', cls: 'S', dist: 18, haz: 0.25, mine: 40,
      intro: 'A Vesta Minerals survey ship went silent here eleven years ago. It is still broadcasting a docking beacon.',
      text: 'The derelict is intact. The crew is not. The flight recorder is still running.',
      a: { label: 'Recover the flight recorder', art: 'a_blackbox', log: 'The recorder held eleven years of survey data, and a final message nobody listened to.' },
      b: { label: 'Strip it for parts', art: 'a_salvage', log: 'The hull was cut into sections and sold. The beacon was switched off.' } },
    { id: 'x_apophis', region: 0, when: { earned: 1e6 }, name: 'Apophis Flyby', cls: 'S', dist: 9, haz: 0.35, mine: 60,
      intro: 'Apophis passes close to Earth this week. Everyone will be watching.',
      text: 'Your crew is on the surface of Apophis, live on every channel on Earth.',
      a: { label: 'Mine it on camera', art: 'a_apophis', log: 'The broadcast was the most-watched event of the year. AstroTech logo visible throughout.' },
      b: { label: 'Nudge it to a Lagrange point', art: 'a_lagrange', log: 'Apophis is now parked at L4. It is company property.' } },
    { id: 'x_psyche', region: 0, when: { research: 'r_outposts' }, name: 'The Psyche Claim', cls: 'M', dist: 36, haz: 0.55, mine: 90,
      intro: 'Psyche is a whole world of metal. Another company filed a claim first.',
      text: 'The rival claim crew is on the surface. Their lease expires in forty days. Their oxygen expires sooner.',
      a: { label: 'Buy out the claim', art: 'a_deed', log: 'The rival accepted. Psyche is ours, on paper and in fact.' },
      b: { label: 'Arrange an accident', art: 'a_psychecore', log: 'The rival crew suffered an unfortunate depressurization. The claim lapsed.' } },
    { id: 'x_pluto', region: 1, when: { region: 1, missions: 5 }, name: 'The Pluto Survey', cls: 'KP', dist: 190, haz: 0.4, mine: 90,
      intro: 'Nobody has landed on Pluto in two hundred years. The heart-shaped plain is still there.',
      text: 'Sputnik Planitia is a glacier of nitrogen ice the size of a country. It is very beautiful.',
      a: { label: 'Map the heart', art: 'a_heart', log: 'The survey was published. Schoolchildren on Earth learned the new map.' },
      b: { label: 'Take a core sample', art: 'a_tholin', log: 'A core four kilometers deep. The heart has a hole in it now.' } },
    { id: 'x_arrokoth', region: 1, when: { region: 1, earned: 1e12 }, name: 'Arrokoth', cls: 'KB', dist: 230, haz: 0.5, mine: 90,
      intro: 'A contact binary: two worlds that touched gently four billion years ago.',
      text: 'The two lobes are barely holding on to each other.',
      a: { label: 'Leave them together', art: 'a_twin', log: 'Arrokoth was left as it was. The board asked why.' },
      b: { label: 'Separate them', art: 'a_snowman', log: 'The lobes came apart with almost no force. One was towed home.' } },
    { id: 'x_signal', region: 1, when: { region: 1, earned: 1e14 }, name: 'The Cold Signal', cls: 'KS', dist: 290, haz: 0.65, mine: 120,
      intro: 'Something beyond the Kuiper Belt is transmitting on a hydrogen line. It is not natural.',
      text: 'The source is a small object, older than the Sun. It is repeating the same message.',
      a: { label: 'Record the signal', art: 'a_recording', log: 'The recording was sent to the lab. Nobody can read it yet.' },
      b: { label: 'Jam it', art: 'a_jammer', log: 'The signal stopped. Something, somewhere, will notice.' } },
    { id: 'x_beacon', region: 2, when: { region: 2, missions: 10 }, name: 'Beacon Alpha', cls: 'OB', dist: 7000, haz: 0.6, mine: 120,
      intro: 'A structure in the Oort Cloud, broadcasting the Cold Signal at full power.',
      text: 'The beacon is a lattice of metal no human made. The signal is a warning. It shows a star going dark.',
      a: { label: 'Study it', art: 'a_lens', log: 'The beacon was studied for a year. The warning was filed under "competitive intelligence".' },
      b: { label: 'Dismantle it', art: 'a_alloyheart', log: 'The beacon was taken apart and sold by the tonne.' } },
    { id: 'x_choir', region: 2, when: { region: 2, earned: 1e23 }, name: 'The Choir', cls: 'OB', dist: 8800, haz: 0.75, mine: 150,
      intro: 'Hundreds of beacons, all transmitting the same warning in harmony.',
      text: 'They are singing about something that ate its own stars. They have been singing for a very long time.',
      a: { label: 'Listen', art: 'a_choir', log: 'The analysts listened for a week. Two resigned. The rest asked for raises.' },
      b: { label: 'Silence them', art: 'a_silence', log: 'The Choir went quiet one beacon at a time.' } },
    { id: 'x_remnant', region: 3, when: { region: 3, missions: 10 }, name: 'The Proxima Remnant', cls: 'SR', dist: 1.3e5, haz: 0.6, mine: 150,
      intro: 'A dead Dyson shell around a dim red star. Someone was here before us.',
      text: 'The builders are long gone. Their records survived. They describe a company. It grew until it ran out of stars.',
      a: { label: 'Read their ledger', art: 'a_ledger', log: 'Their final entry was a quarterly report. Growth: 0.0%.' },
      b: { label: 'Strip the shell', art: 'a_shell', log: 'The shell was dismantled. Their records were recycled.' } },
    { id: 'x_lastlight', region: 3, when: { region: 3, earned: 1e38 }, name: 'Last Light', cls: 'SW', dist: 2.4e5, haz: 0.7, mine: 150,
      intro: 'A white dwarf, hollowed out and cooling. The beacons were warning about this.',
      text: 'There is one ember left at the core. It will burn for another trillion years if no one touches it.',
      a: { label: 'Leave the ember', art: 'a_ember', log: 'The ember was left alone. The board asked for a cost-benefit analysis.' },
      b: { label: 'Take the ember', art: 'a_cinder', log: 'The ember was extracted. The star is dark now.' } },
    { id: 'x_andromeda', region: 4, when: { region: 4, missions: 10 }, name: 'The Other Ledger', cls: 'GS', dist: 4e7, haz: 0.65, mine: 180,
      intro: 'Andromeda is being consumed. Not by us.',
      text: 'The other company has no name. Its ships look like ours. Its logo is a pickaxe crossing a star.',
      a: { label: 'Propose a merger', art: 'a_merger', log: 'The merger closed in eleven seconds. Both boards voted the same way.' },
      b: { label: 'Hostile takeover', art: 'a_takeover', log: 'The other company was acquired. Its founder was never located.' } },
    { id: 'x_mirror', region: 4, when: { region: 4, earned: 1e70 }, name: 'The Mirror', cls: 'GQ', dist: 1.2e8, haz: 0.8, mine: 200,
      intro: 'At the edge of the observable universe, a signal on AstroTech\'s own frequency.',
      text: 'It is a launch complex. It is ours. The logo is newer. The date on the gantry has not happened yet.',
      a: { label: 'Look away', art: 'a_mirror', log: 'The file was closed. Growth continued.' },
      b: { label: 'Send a message', art: 'a_message', log: 'The message said: "Stop." The reply said: "We tried."' } },
  ];

  // =====================================================================
  // ARTIFACTS — permanent bonuses that survive every reset
  // =====================================================================
  AT.ARTIFACTS = {
    a_blackbox:  { name: 'Prospector-9 Recorder', fx: { surveyTime: 0.7, surveyCost: 0.7 }, desc: 'Surveys 30% faster and cheaper.', icon: 'box' },
    a_salvage:   { name: 'Salvaged Reactor',      fx: { shipCost: 0.85 },        desc: 'Ships cost 15% less.', icon: 'reactor' },
    a_apophis:   { name: 'Apophis Broadcast',     fx: { rep: 2 },                desc: 'Reputation gains x2.', icon: 'screen' },
    a_lagrange:  { name: 'L4 Anchor',             fx: { padsStart: 1 },          desc: 'Start every run with one more launch pad.', icon: 'anchor' },
    a_deed:      { name: 'Psyche Deed',           fx: { mrisk: 0.7 },            desc: 'M-type and V-type risk -30%.', icon: 'scroll' },
    a_psychecore:{ name: 'Psyche Core',           fx: { outpost: 1.5 },          desc: 'Outposts output +50%.', icon: 'core' },
    a_heart:     { name: 'Map of the Heart',      fx: { rp: 1.5 },               desc: 'Research x1.5.', icon: 'map' },
    a_tholin:    { name: 'Heart Core Sample',     fx: { value: 1.15 },           desc: 'Ore sells for 15% more.', icon: 'vial' },
    a_twin:      { name: 'The Twins',             fx: { contract: 1.5 },         desc: 'Contract rewards x1.5.', icon: 'twin' },
    a_snowman:   { name: 'Severed Lobe',          fx: { discovery: 1.5 },        desc: 'Discovery 50% faster.', icon: 'rock' },
    a_recording: { name: 'Cold Signal Recording', fx: { gain0: 1.5 },            desc: 'Cryo Core gains x1.5.', icon: 'tape' },
    a_jammer:    { name: 'Signal Jammer',         fx: { risk: 0.9 },             desc: 'Mission risk -10%.', icon: 'antenna' },
    a_lens:      { name: 'Beacon Lens',           fx: { all: 2 },                desc: 'Everything x2.', icon: 'lens' },
    a_alloyheart:{ name: 'Lattice Heart',         fx: { cargo: 1.5 },            desc: 'Cargo x1.5.', icon: 'lattice' },
    a_choir:     { name: 'Choir Fragment',        fx: { gainAll: 1.2 },          desc: 'All prestige gains x1.2.', icon: 'bell' },
    a_silence:   { name: 'The Silence',           fx: { salary: 0.6 },           desc: 'Salaries -40%.', icon: 'mute' },
    a_ledger:    { name: 'Remnant Ledger',        fx: { value: 2 },              desc: 'Ore sells for 2x.', icon: 'book' },
    a_shell:     { name: 'Shell Fragment',        fx: { outpost: 2 },            desc: 'Outposts output x2.', icon: 'shell' },
    a_ember:     { name: 'The Ember',             fx: { gain2: 1.5 },            desc: 'Star Seed gains x1.5.', icon: 'ember' },
    a_cinder:    { name: 'Cinder Drive',          fx: { speed: 2 },              desc: 'Ships travel 2x faster.', icon: 'flame' },
    a_merger:    { name: 'Merger Agreement',      fx: { all: 5 },                desc: 'Everything x5.', icon: 'scroll' },
    a_takeover:  { name: 'Founder\'s Seal',       fx: { gain3: 1.5 },            desc: 'Dark Matter gains x1.5.', icon: 'seal' },
    a_mirror:    { name: 'Closed File',           fx: { all: 3 },                desc: 'Everything x3.', icon: 'box' },
    a_message:   { name: 'The Reply',             fx: { gainAll: 1.3 },          desc: 'All prestige gains x1.3.', icon: 'tape' },
    // rare finds on ordinary missions
    a_pallasite: { name: 'Pallasite Slice',       fx: { value: 1.1 },            desc: 'Ore sells for 10% more.', icon: 'gem', find: 0 },
    a_microbe:   { name: 'Fossil Microbe',        fx: { rp: 1.25 },              desc: 'Research +25%.', icon: 'vial', find: 0 },
    a_presolar:  { name: 'Pre-Solar Grain',       fx: { discovery: 1.25 },       desc: 'Discovery 25% faster.', icon: 'gem', find: 1 },
    a_disc:      { name: 'A Golden Disc',         fx: { rep: 2 },                desc: 'Reputation gains x2. Not ours.', icon: 'disc', find: 1 },
    a_rogue:     { name: 'Rogue Planet Core',     fx: { cargo: 1.25 },           desc: 'Cargo +25%.', icon: 'core', find: 2 },
    a_glass:     { name: 'Singing Glass',         fx: { offline: 4 },            desc: 'Offline progress lasts 4 hours longer.', icon: 'lens', find: 2 },
    a_pulsar:    { name: 'Pulsar Clock',          fx: { speed: 1.5 },            desc: 'Ships travel 50% faster.', icon: 'clock', find: 3 },
    a_pearl:     { name: 'Void Pearl',            fx: { all: 3 },                desc: 'Everything x3.', icon: 'gem', find: 4 },
  };
  AT.ARTIFACT_FIND_CHANCE = 0.003;

  // =====================================================================
  // BOARD DIRECTIVES — the objective chain. Persistent across resets.
  // cond: [type, value]. reward: cash (seconds of revenue, min $), rp (seconds)
  // =====================================================================
  AT.DIRECTIVES = [
    { text: 'Buy your first ship in the Fleet console.', cond: ['ships', 1] },
    { text: 'Pick a target in Mission Control and launch a mission.', cond: ['launched', 1] },
    { text: 'Sell your cargo on the Market.', cond: ['sold', 1] },
    { text: 'Hire a pilot for your next ship.', cond: ['pilots', 1], reward: { min: 300 } },
    { text: 'Survey an asteroid with a probe.', cond: ['surveyed', 1], reward: { min: 500 } },
    { text: 'Complete 5 missions.', cond: ['missions', 5], reward: { cash: 60, min: 800 } },
    { text: 'Build a second launch pad.', cond: ['pads', 2], reward: { cash: 60, min: 1000 } },
    { text: 'Hire a scientist and start research.', cond: ['staff_scientist', 1] },
    { text: 'Research Flight Director.', cond: ['research', 'r_flight'], reward: { cash: 90 } },
    { text: 'Deliver a client contract.', cond: ['contracts', 1], reward: { cash: 90 } },
    { text: 'Bring back cargo from an M-type asteroid.', cond: ['class_M', 1], reward: { cash: 120 } },
    { text: 'Own 4 ships.', cond: ['ships', 4], reward: { cash: 120 } },
    { text: 'Earn $100K this run.', cond: ['earned', 1e5], reward: { cash: 120 } },
    { text: 'Take the company public.', cond: ['research', 'r_incorp'], reward: { cash: 120 } },
    { text: 'Commission an Excavator.', cond: ['hull_excavator', 1], reward: { cash: 180 } },
    { text: 'Reach Reputation level 2.', cond: ['rep', 2], reward: { cash: 180 } },
    { text: 'Complete the Derelict expedition.', cond: ['exp', 'x_derelict'], reward: { cash: 240 } },
    { text: 'Complete 100 missions.', cond: ['missions', 100], reward: { cash: 240, rp: 120 } },
    { text: 'Build an outpost.', cond: ['outposts', 1], reward: { cash: 300 } },
    { text: 'Earn $50M this run.', cond: ['earned', 5e7], reward: { cash: 300, rp: 180 } },
    { text: 'Reach $2B in equity and jump to the Kuiper Belt.', cond: ['layer0', 1] },
    { text: 'Bring back cargo from the Kuiper Belt.', cond: ['region_1', 1], reward: { cash: 300 } },
    { text: 'Commission an Icebreaker.', cond: ['hull_icebreaker', 1], reward: { cash: 300 } },
    { text: 'Complete the Pluto Survey.', cond: ['exp', 'x_pluto'], reward: { cash: 300 } },
    { text: 'Complete a Kuiper challenge.', cond: ['challenges0', 1], reward: { cash: 300 } },
    { text: 'Build an Ice Station in the Kuiper Belt.', cond: ['outposts_1', 1], reward: { cash: 300 } },
    { text: 'Perform 10 Kuiper Jumps.', cond: ['layer0', 10] },
    { text: 'Exodus to the Oort Cloud.', cond: ['layer1', 1] },
    { text: 'Bring back cargo from a comet.', cond: ['region_2', 1], reward: { cash: 300 } },
    { text: 'Complete the Beacon Alpha expedition.', cond: ['exp', 'x_beacon'], reward: { cash: 300 } },
    { text: 'Complete 3 Kuiper challenges.', cond: ['challenges0', 3] },
    { text: 'Ignite a path to the stars.', cond: ['layer2', 1] },
    { text: 'Bring back cargo from a star.', cond: ['region_3', 1], reward: { cash: 300 } },
    { text: 'Complete the Proxima Remnant expedition.', cond: ['exp', 'x_remnant'] },
    { text: 'Collect 12 artifacts.', cond: ['artifacts', 12] },
    { text: 'Ascend beyond the galaxy.', cond: ['layer3', 1] },
    { text: 'Bring back cargo from another galaxy.', cond: ['region_4', 1], reward: { cash: 300 } },
    { text: 'Complete The Other Ledger expedition.', cond: ['exp', 'x_andromeda'] },
    { text: 'Collect 24 artifacts.', cond: ['artifacts', 24] },
    { text: 'Close the ledger.', cond: ['ended', 1] },
  ];

  // =====================================================================
  // PRESTIGE LAYERS
  // gain = floor((peakEquity / req) ^ exp * mults)
  // milestones: unlocked by number of resets of that layer
  // challenges: restricted runs, goal = reach `goal` equity; reward permanent
  // =====================================================================
  AT.LAYERS = [
    { id: 'kuiper', region: 1, name: 'Kuiper Jump', verb: 'JUMP TO THE KUIPER BELT', cur: 'Cryo Cores', sym: 'CC', req: 2e9, exp: 0.3, color: '#86c3ee',
      flavor: 'Liquidate the inner-system operation. Take what it taught us further out.',
      upgrades: [
        { id: 'k_crews',   name: 'Veteran Crews',          base: 1,  growth: 4,   max: 40, fx: { all: 2 },        desc: 'Everything sells for 2x per level.' },
        { id: 'k_seed',    name: 'Seed Capital',           base: 1,  growth: 3,   max: 4,  fx: { startCash: 1 },  desc: 'Start each run with more cash ($5K, $100K, $3M, $100M).' },
        { id: 'k_pads',    name: 'Prefab Pads',            base: 2,  growth: 4,   max: 4,  fx: { padsStart: 1 },  desc: 'Start each run with one more launch pad per level.' },
        { id: 'k_labs',    name: 'Cold Labs',              base: 2,  growth: 4,   max: 8,  fx: { rp: 2 },         desc: 'Research x2 per level.' },
        { id: 'k_doctrine',name: 'Fleet Doctrine',         base: 3,  growth: 4.5, max: 10, fx: { speed: 1.25, cargo: 1.25 }, desc: 'Ships 25% faster and carry 25% more per level.' },
        { id: 'k_orders',  name: 'Standing Orders',        base: 3,  growth: 1,   max: 1,  fx: { startResearch: 1 }, desc: 'Start every run with Sales Daemon, Flight Director, Autopilot and Field Repair Kits.' },
        { id: 'k_charter', name: 'Charter Rights',         base: 6,  growth: 1,   max: 1,  fx: { incorp: 1, noDilutePenalty: 1 }, desc: 'Start incorporated. Issuing shares no longer hurts confidence.' },
        { id: 'k_memory',  name: 'Institutional Memory',   base: 15, growth: 1,   max: 1,  fx: { keepResearch0: 1 }, desc: 'Keep Inner System research when you Jump.' },
        { id: 'k_safety',  name: 'Safety Culture',         base: 5,  growth: 4,   max: 6,  fx: { risk: 0.85 },    desc: 'Mission risk -15% per level.' },
        { id: 'k_resonance',name:'Core Resonance',         base: 40, growth: 1,   max: 1,  fx: { resonance: 0.3 },desc: 'Everything x(1 + Cryo Cores ever earned)^0.3.' },
      ],
      milestones: [
        { n: 1,  text: 'Kuiper Belt targets appear in every run.', fx: {} },
        { n: 2,  text: 'Start every run with a Hauler.', fx: { startHauler: 1 } },
        { n: 3,  text: 'Kuiper challenges unlocked.', fx: { challenges0: 1 } },
        { n: 5,  text: 'Observatory starts at level 3.', fx: { startObs: 3 } },
        { n: 8,  text: 'Start every run with Fleet Coordination AI.', fx: { startFleetAI: 1 } },
        { n: 12, text: 'Procurement AI: pads, ships and fleet upgrades can be bought automatically.', fx: { autobuy: 1 } },
        { n: 15, text: 'Keep Board Automation and Guidance research.', fx: { keepBiz: 1 } },
        { n: 30, text: 'Projects stay completed through Kuiper Jumps.', fx: { keepProjects0: 1 } },
        { n: 60, text: 'Cryo Core gains x2.', fx: { gain0: 2 } },
      ],
      challenges: [
        { id: 'c_skeleton', name: 'Skeleton Crew',  desc: 'Staff cannot be hired.',                 rules: { noStaff: 1 },   reward: 'Staff salaries -50% forever.', rfx: { salary: 0.5 } },
        { id: 'c_bear',     name: 'Bear Market',    desc: 'Ore sells for 40% of normal.',           rules: { value: 0.4 },   reward: 'Market depth x2 forever.',     rfx: { depth: 2 } },
        { id: 'c_fragile',  name: 'Fragile Hulls',  desc: 'Mission risk x2.',                       rules: { risk: 2 },      reward: 'Mission risk -15% forever.',   rfx: { risk: 0.85 } },
        { id: 'c_blind',    name: 'Flying Blind',   desc: 'Surveys are disabled.',                  rules: { noSurvey: 1 },  reward: 'Surveys are instant.',         rfx: { surveyTime: 0.001 } },
        { id: 'c_cash',     name: 'Cash Only',      desc: 'Research is disabled.',                  rules: { noResearch: 1 },reward: 'Research x3 forever.',          rfx: { rp: 3 } },
        { id: 'c_onepad',   name: 'One Pad',        desc: 'Only one launch pad.',                   rules: { maxPads: 1 },   reward: 'Start every run with one more pad.', rfx: { padsStart: 1 } },
      ],
    },
    { id: 'oort', region: 2, name: 'Oort Exodus', verb: 'EXODUS TO THE OORT CLOUD', cur: 'Comet Shards', sym: 'CS', req: 3e20, exp: 0.22, color: '#4fd1b0',
      flavor: 'Abandon the inner system. It has nothing left to give.',
      upgrades: [
        { id: 'o_momentum', name: 'Comet Momentum',   base: 1,  growth: 3.5, max: 30, fx: { all: 3 },         desc: 'Everything x3 per level.' },
        { id: 'o_compress', name: 'Cryo Compression', base: 1,  growth: 3,   max: 10, fx: { gain0: 2 },       desc: 'Cryo Core gains x2 per level.' },
        { id: 'o_archive',  name: 'Archive Vaults',   base: 3,  growth: 1,   max: 1,  fx: { keepLayer0: 1 },  desc: 'Keep Cryo Core upgrades on Exodus.' },
        { id: 'o_daemon',   name: 'Jump Daemon',      base: 4,  growth: 1,   max: 1,  fx: { autoLayer0: 1 },  desc: 'Automatically perform Kuiper Jumps.' },
        { id: 'o_labs',     name: 'Long-Period Labs', base: 2,  growth: 4,   max: 8,  fx: { rp: 5 },          desc: 'Research x5 per level.' },
        { id: 'o_contracts',name: 'Standing Contracts',base: 5, growth: 1,   max: 1,  fx: { keepProjects: 1 },desc: 'Keep completed projects on every reset.' },
        { id: 'o_rigs',     name: 'Rig Blueprints',   base: 4,  growth: 4,   max: 8,  fx: { outpost: 2 },     desc: 'Outposts output x2 per level.' },
        { id: 'o_dig',      name: 'Deep Archaeology', base: 6,  growth: 1,   max: 1,  fx: { artifactChance: 4 }, desc: 'Artifact finds 4x more likely.' },
        { id: 'o_lattice',  name: 'Shard Lattice',    base: 25, growth: 1,   max: 1,  fx: { resonance: 0.35 },desc: 'Everything x(1 + Comet Shards ever earned)^0.35.' },
      ],
      milestones: [
        { n: 1,  text: 'Oort Cloud targets appear in every run.', fx: {} },
        { n: 2,  text: 'Keep Kuiper research on every reset.', fx: { keepResearch1: 1 } },
        { n: 3,  text: 'Oort challenges unlocked.', fx: { challenges1: 1 } },
        { n: 5,  text: 'Start every run with an Icebreaker.', fx: { startIce: 1 } },
        { n: 10, text: 'Kuiper Jump milestones count as completed.', fx: { allMilestones0: 1 } },
        { n: 25, text: 'Comet Shard gains x2.', fx: { gain1: 2 } },
      ],
      challenges: [
        { id: 'c_coldstart', name: 'Cold Start',     desc: 'Cryo Core upgrades are disabled.',   rules: { noLayer0: 1 },  reward: 'Cryo Core gains x3 forever.',  rfx: { gain0: 3 } },
        { id: 'c_longhaul',  name: 'Long Haul',      desc: 'All distances x3.',                  rules: { dist: 3 },      reward: 'Ships travel 50% faster forever.', rfx: { speed: 1.5 } },
        { id: 'c_hostile',   name: 'Hostile Board',  desc: 'Investor confidence is locked at 0.5.', rules: { conf: 0.5 }, reward: 'Valuation x3 forever.',       rfx: { valuation: 3 } },
        { id: 'c_manual',    name: 'Manual Control', desc: 'All automation is disabled.',        rules: { noAuto: 1 },    reward: 'Comet Shard gains x2 forever.',rfx: { gain1: 2 } },
      ],
    },
    { id: 'stars', region: 3, name: 'Stellar Ignition', verb: 'IGNITE A PATH TO THE STARS', cur: 'Star Seeds', sym: 'SS', req: 1e37, exp: 0.16, color: '#ff8f3d',
      flavor: 'Burn the solar system for one push. The stars are next.',
      upgrades: [
        { id: 's_furnace',  name: 'Stellar Furnace',  base: 1,  growth: 4,   max: 25, fx: { all: 8 },         desc: 'Everything x8 per level.' },
        { id: 's_cascade',  name: 'Shard Cascade',    base: 1,  growth: 4,   max: 10, fx: { gain1: 3 },       desc: 'Comet Shard gains x3 per level.' },
        { id: 's_eternal',  name: 'Eternal Archives', base: 3,  growth: 1,   max: 1,  fx: { keepLayer1: 1, keepResearchAll: 1 }, desc: 'Keep Comet Shard upgrades and all research on Ignition.' },
        { id: 's_daemon',   name: 'Exodus Daemon',    base: 4,  growth: 1,   max: 1,  fx: { autoLayer1: 1 },  desc: 'Automatically perform Oort Exoduses.' },
        { id: 's_labs',     name: 'Light-Speed Labs', base: 2,  growth: 5,   max: 8,  fx: { rp: 10 },         desc: 'Research x10 per level.' },
        { id: 's_swarms',   name: 'Swarm Doctrine',   base: 5,  growth: 5,   max: 8,  fx: { outpost: 3 },     desc: 'Outposts output x3 per level.' },
        { id: 's_bloom',    name: 'Seed Bloom',       base: 20, growth: 1,   max: 1,  fx: { resonance: 0.4 }, desc: 'Everything x(1 + Star Seeds ever earned)^0.4.' },
      ],
      milestones: [
        { n: 1,  text: 'Stars appear as targets in every run.', fx: {} },
        { n: 2,  text: 'Stellar challenges unlocked.', fx: { challenges2: 1 } },
        { n: 3,  text: 'Start every run with a Comet Runner.', fx: { startRunner: 1 } },
        { n: 5,  text: 'Oort Exodus milestones count as completed.', fx: { allMilestones1: 1 } },
        { n: 15, text: 'Star Seed gains x2.', fx: { gain2: 2 } },
      ],
      challenges: [
        { id: 'c_dark',     name: 'Dark Sky',      desc: 'Comet Shard upgrades are disabled.',   rules: { noLayer1: 1 },  reward: 'Comet Shard gains x5 forever.', rfx: { gain1: 5 } },
        { id: 'c_noout',    name: 'No Fixed Address', desc: 'Outposts cannot be built.',         rules: { noOutposts: 1 },reward: 'Outposts output x10 forever.',  rfx: { outpost: 10 } },
        { id: 'c_glass',    name: 'Glass Cannon',  desc: 'Every failure loses the ship.',        rules: { allLost: 1 },   reward: 'Mission risk -30% forever.',     rfx: { risk: 0.7 } },
      ],
    },
    { id: 'galaxy', region: 4, name: 'Galactic Ascent', verb: 'ASCEND BEYOND THE GALAXY', cur: 'Dark Matter', sym: 'DM', req: 1e68, exp: 0.11, color: '#a898ff',
      flavor: 'One galaxy was the start-up phase.',
      upgrades: [
        { id: 'g_leverage', name: 'Dark Leverage',    base: 1,  growth: 3.5, max: 25, fx: { all: 12 },        desc: 'Everything x12 per level.' },
        { id: 'g_rain',     name: 'Seed Rain',        base: 1,  growth: 4,   max: 10, fx: { gain2: 4 },       desc: 'Star Seed gains x4 per level.' },
        { id: 'g_total',    name: 'Total Recall',     base: 2,  growth: 1,   max: 1,  fx: { keepLayer2: 1 },  desc: 'Keep Star Seed upgrades on Ascent.' },
        { id: 'g_daemon',   name: 'Ignition Daemon',  base: 3,  growth: 1,   max: 1,  fx: { autoLayer2: 1 },  desc: 'Automatically perform Stellar Ignitions.' },
        { id: 'g_labs',     name: 'Void Labs',        base: 2,  growth: 5,   max: 8,  fx: { rp: 100 },        desc: 'Research x100 per level.' },
        { id: 'g_monopoly', name: 'Gravitational Monopoly', base: 6, growth: 1, max: 1, fx: { depth: 1000, recovery: 5 }, desc: 'Market depth x1000. Prices recover 5x faster.' },
      ],
      milestones: [
        { n: 1, text: 'Galaxies appear as targets in every run.', fx: {} },
        { n: 2, text: 'Void challenges unlocked.', fx: { challenges3: 1 } },
        { n: 3, text: 'Stellar Ignition milestones count as completed.', fx: { allMilestones2: 1 } },
        { n: 10, text: 'Dark Matter gains x2.', fx: { gain3: 2 } },
      ],
      challenges: [
        { id: 'c_nostars',  name: 'Starless',       desc: 'Star Seed upgrades are disabled.',   rules: { noLayer2: 1 }, reward: 'Star Seed gains x5 forever.', rfx: { gain2: 5 } },
        { id: 'c_austerity',name: 'Austerity',      desc: 'Ships cost 100x more.',               rules: { shipCost: 100 }, reward: 'Ships cost 90% less forever.', rfx: { shipCost: 0.1 } },
      ],
    },
  ];
  AT.FINAL_REQ = 1e94;

  // =====================================================================
  // STORY LOG
  // =====================================================================
  AT.STORY = {
    start:      'AstroTech Mining Co. is registered. Assets: one launch pad, one loan, one telescope pointed at the sky.',
    firstShip:  'The first ship rolls out to the pad. Someone painted a name on it overnight.',
    firstLaunch:'Ignition. Liftoff. The first AstroTech mission is on its way.',
    firstReturn:'Cargo recovered. The hold smells like iron and cold.',
    firstSale:  'First sale. The buyer did not ask where it came from.',
    firstSurvey:'The first survey is in. Every rock has a price now.',
    firstLoss:  'Contact lost. The ship has been written off. The paperwork took longer than the mission.',
    firstDeath: 'A pilot died today. The company sent flowers. The flowers were expensed.',
    research:   'The lab has a whiteboard. Someone wrote GROWTH at the top and circled it.',
    flight:     'Flight Director online. Ships no longer wait to be told.',
    autopilot:  'The first ship launched with an empty cockpit. It came back on time.',
    incorp:     'AstroTech is public. We answer to the shareholders now. The shareholders answer to growth.',
    qMiss:      'The quarter missed guidance. The board would like to remind you that growth is not optional.',
    qBeat:      'The quarter beat guidance. The board raised next quarter\'s target.',
    contract:   'First client contract delivered. They asked for a discount next time. They will not get one.',
    outpost:    'The first outpost is online. Nobody lives there. Nobody needs to.',
    depleted:   'An asteroid has been mined out. It was here for four billion years.',
    hundred:    'One hundred missions flown. The launch schedule no longer has gaps.',
    fleetai:    'Fleet Coordination AI is online. It picked its first target faster than any of us could.',
    dilute:     'New shares issued. The company is a little less ours.',
    lowOwn:     'Your stake is below 50%. The board voted to retain you as Chief Executive. For now.',
    strike:     'Payroll failed. The crew has stopped working.',
    canJump:    'Long-range survey: the Kuiper Belt is unclaimed. The inner system is nearly spent.',
    kuiper:     'Kuiper operations established. Out here, the Sun is just a bright star.',
    aipilots:   'The last human pilot was moved to a training role. There is nobody left to train.',
    oort:       'Oort Cloud reached. Long-range sensors found structures out here. They are not ours.',
    stars:      'The Sun has been spent to reach the stars. Proxima signs first. The others will follow.',
    galaxy:     'The Milky Way is a solved problem. There are two trillion others.',
    nearEnd:    'Projections show one remaining market: everything.',
  };
  AT.ENDING = [
    'There are no more buyers.',
    'There are no more sellers.',
    'Every atom in the observable universe is inventory.',
    'Every ledger in the observable universe is ours.',
    'The board has convened for the last time. It is one voice now. It is yours.',
    'Growth: complete.',
    'AstroTech thanks you for your service.',
  ];

  // =====================================================================
  // ACHIEVEMENTS (Steam API names)
  // =====================================================================
  AT.ACHIEVEMENTS = [
    { id: 'ACH_FIRST_LAUNCH',  name: 'Liftoff',              desc: 'Launch your first mission.' },
    { id: 'ACH_FIRST_SALE',    name: 'Open for Business',    desc: 'Sell your first cargo.' },
    { id: 'ACH_SURVEY',        name: 'Know Your Rock',       desc: 'Survey an asteroid.' },
    { id: 'ACH_FIRST_LOSS',    name: 'Acceptable Losses',    desc: 'Lose a ship.' },
    { id: 'ACH_MISSIONS_100',  name: 'Regular Service',      desc: 'Complete 100 missions in total.' },
    { id: 'ACH_MISSIONS_1K',   name: 'Launch Cadence',       desc: 'Complete 1,000 missions in total.' },
    { id: 'ACH_MISSIONS_10K',  name: 'Industrial Scale',     desc: 'Complete 10,000 missions in total.' },
    { id: 'ACH_FLEET_10',      name: 'Fleet Owner',          desc: 'Own 10 ships at once.' },
    { id: 'ACH_PADS_6',        name: 'Spaceport',            desc: 'Own 6 launch pads.' },
    { id: 'ACH_PILOT_10',      name: 'Ace',                  desc: 'Train a pilot to level 10.' },
    { id: 'ACH_PILOT_20',      name: 'Living Legend',        desc: 'Train a pilot to level 20.' },
    { id: 'ACH_DEATHS_10',     name: 'Attrition',            desc: 'Lose 10 pilots. The memorial wall has room.' },
    { id: 'ACH_MILLION',       name: 'Seven Figures',        desc: 'Earn $1,000,000 in a single run.' },
    { id: 'ACH_BILLION',       name: 'Ten Figures',          desc: 'Earn $1,000,000,000 in a single run.' },
    { id: 'ACH_IPO',           name: 'Going Public',         desc: 'Research Incorporation.' },
    { id: 'ACH_QUARTER_5',     name: 'Beat and Raise',       desc: 'Beat quarterly guidance 5 times in a row.' },
    { id: 'ACH_CRASH',         name: 'Flooding the Market',  desc: 'Crash an ore price below 10% of normal.' },
    { id: 'ACH_CONTRACTS_25',  name: 'Preferred Vendor',     desc: 'Deliver 25 contracts in total.' },
    { id: 'ACH_REP_MAX',       name: 'Household Name',       desc: 'Reach the highest reputation level.' },
    { id: 'ACH_OUTPOST',       name: 'Homesteader',          desc: 'Build an outpost.' },
    { id: 'ACH_OUTPOSTS_10',   name: 'Colonial Holdings',    desc: 'Own 10 outposts at once.' },
    { id: 'ACH_DEPLETE',       name: 'Nothing Left',         desc: 'Mine an asteroid down to nothing.' },
    { id: 'ACH_INTERLOCK',     name: 'Move Fast',            desc: 'Disable the safety interlocks.' },
    { id: 'ACH_INCIDENTS_25',  name: 'Crisis Manager',       desc: 'Resolve 25 incidents.' },
    { id: 'ACH_EXPEDITION',    name: 'Expedition Leader',    desc: 'Complete an expedition.' },
    { id: 'ACH_EXP_ALL',       name: 'Seen It All',          desc: 'Complete all 12 expeditions.' },
    { id: 'ACH_ART_10',        name: 'Curator',              desc: 'Collect 10 artifacts.' },
    { id: 'ACH_ART_ALL',       name: 'The Collection',       desc: 'Collect every artifact.' },
    { id: 'ACH_KUIPER',        name: 'Cold Open',            desc: 'Perform your first Kuiper Jump.' },
    { id: 'ACH_OORT',          name: 'Long Haul',            desc: 'Perform your first Oort Exodus.' },
    { id: 'ACH_STARS',         name: 'Ignition',             desc: 'Perform your first Stellar Ignition.' },
    { id: 'ACH_GALAXY',        name: 'Ascendant',            desc: 'Perform your first Galactic Ascent.' },
    { id: 'ACH_CHALLENGE',     name: 'Under Pressure',       desc: 'Complete a challenge.' },
    { id: 'ACH_CHALLENGE_ALL', name: 'No Excuses',           desc: 'Complete every challenge.' },
    { id: 'ACH_EARTH',         name: 'Hostile Homecoming',   desc: 'Acquire Earth.' },
    { id: 'ACH_ALL_RESEARCH',  name: 'Total Knowledge',      desc: 'Complete every research node in one run.' },
    { id: 'ACH_END',           name: 'The Last Transaction', desc: 'Finish the game.' },
    { id: 'ACH_NGPLUS',        name: 'Again',                desc: 'Start a new universe.' },
  ];
})(typeof window !== 'undefined' ? (window.AT = window.AT || {}) : (globalThis.AT = globalThis.AT || {}));
