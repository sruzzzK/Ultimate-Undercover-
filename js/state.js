import { Storage } from './storage.js';

export const DEFAULT_SETTINGS = {
  darkTheme: true,
  sound: true,
  animations: true,
  ucWinRule: 'parity', // 'parity' | 'last_two'
  tieRule: 'revote',   // 'revote' | 'no_elim' | 'random'
  discTimer: 0,
  voteTimer: 0,
  recycleWords: true
};

export const DEFAULT_SETUP = {
  playerCount: 5,
  undercoverCount: 1,
  mrWhiteCount: 1,
  randomRoles: false,
  difficulty: 'all',
  selectedCategories: [] // empty means all categories active
};

export const State = {
  settings: Storage.loadSettings(DEFAULT_SETTINGS),
  setup: Storage.loadSetup(DEFAULT_SETUP),
  savedNames: Storage.loadNames(),
  usedPairIds: Storage.loadHistory(),

  // Validated word database populated at boot
  wordBank: [],
  categories: [],

  // Active Match Runtime State
  match: null
};
