// Tumble Dojo: tabuľka kombinácií, jediné miesto na ladenie. Časy v krokoch 120 Hz.
export const PB = 1, CO = 2, FE = 3, FL = 4, TH = 5, DP = 6, RP = 7, GW = 8, PT = 9, BL = 10, ET = 11, SP = 12;
export const POCET = 12;
export const MENA = ['', 'PERFECT BRACE', 'COUNTER', 'FEINT', 'FLANK', 'THROW', 'DOUBLE PUSH', 'RUNNING PUSH',
  'GIVE WAY', 'PULL THROUGH', 'BELT PUSH', 'EDGE TURN', 'GROUND STOMP'];
// vstup pre Moves a Record: [dotyk, klávesnica Dojo keys]
export const VSTUP = [null,
  ['Brace just before a lunge lands', 'K just before a lunge lands'],
  ['After they bounce off your brace, tap Lunge or slide Brace onto it', 'After a bounce off your brace, J'],
  ['Hold Lunge, and when they brace, swipe that thumb sideways', 'While holding J, Q or E when they brace'],
  ['Step, then Lunge right away, around their brace', 'Q or E, then J, around their brace'],
  ['Grab, then Step right away', 'I, then Q or E right away'],
  ['Lunge lands, tap Lunge again', 'J lands, J again'],
  ['Walk at them and hold Lunge until the ring is full, release on the move', 'W A S D at them, hold J until full, release'],
  ['Stick away from them and Brace', 'Walk away and K'],
  ['Grab as their lunge arrives', 'I as their lunge arrives'],
  ['Grab, then Lunge while holding', 'I, then J while holding'],
  ['At the rope, Step as they push you', 'At the rope, Q or E as they push'],
  ['Stomp when all 3 Focus dots are full', 'O when all 3 Focus dots are full']
];
export const O = {
  PB_MIN: 7, PB_MAX: 18, PB_E: 1.1, PB_STAG: 48,                          // K1 PERFECT BRACE
  CO_WIN: 30, CO_K: 1.2, CO_VMIN: 0.9, CO_VMAX: 2.4, CO_REC: 30,          // K2 COUNTER
  FE_MIN: 15, FE_BR: 42, FE_FZ: 36,                                       // K3 FEINT
  FL_WIN: 24, FL_V: 1.15, FL_CONE: 0.9396926207859084, FL_BR: 36, FL_IMP: 1.25, FL_STAG: 42,   // K4 FLANK (kužeľ ±20°)
  TH_WIN: 30, TH_V: 1.25, TH_STAG: 42, TH_REC: 24, TH_N: 10, TH_C: 0.9876883405951378, TH_S: 0.15643446504023087,   // K5 THROW
  DP_WIN: 24, DP_V: 1.3, DP_ACT: 18, DP_BRK: 30, DP_STAG: 30, DP_REC: 42, // K6 DOUBLE PUSH
  RP_WALK: 72, RP_GAP: 6, RP_COS: 0.8191520442889918, RP_K: 1.15, RP_MAX: 2.4, RP_REC: 12,   // K7 RUNNING PUSH (±35°)
  GW_COS: 0.7071067811865476, GW_WIN: 36, GW_BACK: 0.72, GW_FWD: 0.25, GW_STAG: 54,        // K8 GIVE WAY (±45°)
  PT_PRE: 12, PT_POST: 6, PT_K: 1.2, PT_SHIFT: 0.1, PT_STAG: 36,         // K9 PULL THROUGH
  PT_C: 0.8660254037844386, PT_S: 0.5,
  BL_WIN: 20, BL_V: 0.7, BL_DUR: 48, BL_BR: 8, BL_STAG: 24,              // K10 BELT PUSH
  ET_EDGE: 0.2, ET_WIN: 14, ET_STAG: 30, ET_V: 0.6, ET_N: 12, ET_C: 0.9659258262890683, ET_S: 0.25881904510252074,   // K11 EDGE TURN
  SP_IN: 42, SP_R: 0.55, SP_V: 0.6, SP_STAG: 30, SP_REC: 36, SP_MISS: 36, // GROUND STOMP
  SILA: 3,
  OP_DUR: 108, OP_IMP: 1.3, OP_STAG: 36, OP_VMIN: 1.3, OP_NOBR: 84       // OPEN 0,9 s
};
// otvárajú súpera (THROW, BELT PUSH a PULL THROUGH vytláčajú samy)
export const OTVARA = [0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1];
// Focus plnia len zaslúžené kombinácie
export const FOCUS = [0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0];
export const VIB = {   // vibrácie (ms)
  nabite: [6], tuk: [10], silny: [18], strata: [25], kombo: [12, 40, 20], perfekt: [10, 30, 10], velky: [20, 40, 35], bod: [60], koniec: [30, 60, 30]
};
