import { State } from './state.js';
import { Storage } from './storage.js';

export const Engine = {
  /**
   * Deduplicates & validates raw word entries so counts are 100% authentic.
   * Rejects missing fields, identical words, reversed duplicates, and exact duplicates.
   */
  sanitizeDatabase(rawList) {
    const seenKeys = new Set();
    const valid = [];
    const catSet = new Set();

    for (const item of rawList) {
      if (!item || !item.civ || !item.uc || !item.cat || !item.diff) continue;

      const civ = String(item.civ).trim();
      const uc = String(item.uc).trim();
      const cat = String(item.cat).trim();
      const diff = String(item.diff).trim().toLowerCase();

      if (!civ || !uc || civ.toLowerCase() === uc.toLowerCase()) continue;
      if (!['easy', 'medium', 'hard'].includes(diff)) continue;

      // Canonical key prevents both (A,B) and reversed (B,A) duplicates
      const pairKey = [civ.toLowerCase(), uc.toLowerCase()].sort().join('::');
      if (seenKeys.has(pairKey)) continue;

      seenKeys.add(pairKey);
      catSet.add(cat);
      valid.push({
        id: pairKey,
        civ,
        uc,
        cat,
        diff
      });
    }

    State.wordBank = valid;
    State.categories = [...catSet].sort((a, b) => a.localeCompare(b));
  },

  /**
   * Validates role counts for a given player count.
   */
  validateRoles(total, uc, mw) {
    if (total < 3 || total > 20) {
      return { valid: false, message: 'Player count must be between 3 and 20.' };
    }
    if (uc < 0 || mw < 0) {
      return { valid: false, message: 'Role counts cannot be negative.' };
    }
    if (uc + mw < 1) {
      return { valid: false, message: 'At least 1 Undercover or Mr. White is required.' };
    }
    const civilians = total - uc - mw;
    if (civilians < 1) {
      return { valid: false, message: 'There must be at least 1 Civilian.' };
    }
    if (uc + mw >= civilians) {
      return {
        valid: false,
        message: 'Civilians must outnumber Undercovers + Mr. Whites at game start.'
      };
    }
    return { valid: true, civilians, message: '' };
  },

  /**
   * Generates balanced randomized role counts when "Randomize Role Counts" is enabled.
   */
  generateRandomRoleCounts(total) {
    const maxInfiltrators = Math.max(1, Math.floor((total - 1) / 2));
    const totalInfiltrators = Math.max(1, Math.floor(Math.random() * maxInfiltrators) + 1);
    const mw = total >= 4 && Math.random() < 0.45 ? 1 : 0;
    const uc = Math.max(totalInfiltrators - mw, mw === 0 ? 1 : 0);
    return { uc, mw };
  },

  /**
   * Filters available word pairs by selected categories and difficulty.
   */
  getFilteredPool() {
    const { difficulty, selectedCategories } = State.setup;
    const useAllCats = selectedCategories.length === 0;

    return State.wordBank.filter((entry) => {
      const diffMatch = difficulty === 'all' || entry.diff === difficulty;
      const catMatch = useAllCats || selectedCategories.includes(entry.cat);
      return diffMatch && catMatch;
    });
  },

  /**
   * Selects a fair, non-repeating word pair using persistent history.
   */
  pickWordPair() {
    const pool = this.getFilteredPool();
    if (pool.length === 0) return null;

    let unplayed = pool.filter((p) => !State.usedPairIds.has(p.id));

    if (unplayed.length === 0) {
      if (!State.settings.recycleWords) {
        return null;
      }
      // Clear history for entries in the active pool so play can continue
      for (const item of pool) {
        State.usedPairIds.delete(item.id);
      }
      Storage.saveHistory(State.usedPairIds);
      unplayed = pool;
    }

    const chosen = unplayed[Math.floor(Math.random() * unplayed.length)];
    State.usedPairIds.add(chosen.id);
    Storage.saveHistory(State.usedPairIds);
    return chosen;
  },

  /**
   * Fisher-Yates unbiased shuffle.
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  /**
   * Initializes a brand new match state.
   */
  createMatch(playerNames) {
    const total = State.setup.playerCount;
    let { undercoverCount: uc, mrWhiteCount: mw } = State.setup;

    if (State.setup.randomRoles) {
      const rand = this.generateRandomRoleCounts(total);
      uc = rand.uc;
      mw = rand.mw;
    }

    const validation = this.validateRoles(total, uc, mw);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const wordPair = this.pickWordPair();
    if (!wordPair) {
      throw new Error('No unused word pairs available for the current filter. Reset history or broaden filters.');
    }

    // Build role deck
    const roles = [
      ...Array(validation.civilians).fill('CIVILIAN'),
      ...Array(uc).fill('UNDERCOVER'),
      ...Array(mw).fill('MR_WHITE')
    ];
    const shuffledRoles = this.shuffle(roles);

    const players = playerNames.slice(0, total).map((name, idx) => {
      const role = shuffledRoles[idx];
      let word = null;
      if (role === 'CIVILIAN') word = wordPair.civ;
      if (role === 'UNDERCOVER') word = wordPair.uc;

      return {
        id: `p_${idx}`,
        name: name.trim() || `Player ${idx + 1}`,
        role,
        word,
        alive: true
      };
    });

    // Ensure Mr. White is never forced to speak first in Round 1 if avoidable
    let speakingOrder = this.shuffle(players.map((p) => p.id));
    if (players.find((p) => p.id === speakingOrder[0])?.role === 'MR_WHITE') {
      const nonMwIdx = speakingOrder.findIndex(
        (id) => players.find((p) => p.id === id)?.role !== 'MR_WHITE'
      );
      if (nonMwIdx > 0) {
        [speakingOrder[0], speakingOrder[nonMwIdx]] = [speakingOrder[nonMwIdx], speakingOrder[0]];
      }
    }

    State.match = {
      round: 1,
      wordPair,
      players,
      distIndex: 0,
      speakingOrder,
      voting: {
        eligibleVoters: [],
        candidates: [],
        voterIndex: 0,
        votes: {}, // targetId -> count
        selectedTarget: null
      },
      lastEliminated: null
    };

    return State.match;
  },

  /**
   * Evaluates voting results and handles configured tie-break rules.
   */
  tallyVotes() {
    const { votes, candidates } = State.match.voting;
    let maxVotes = -1;
    let leaders = [];

    for (const cid of candidates) {
      const count = votes[cid] || 0;
      if (count > maxVotes) {
        maxVotes = count;
        leaders = [cid];
      } else if (count === maxVotes) {
        leaders.push(cid);
      }
    }

    // Clear winner
    if (leaders.length === 1) {
      return { status: 'ELIMINATED', playerId: leaders[0] };
    }

    // Tie handling
    const tieRule = State.settings.tieRule;
    if (tieRule === 'no_elim') {
      return { status: 'NO_ELIMINATION' };
    }
    if (tieRule === 'random') {
      const picked = leaders[Math.floor(Math.random() * leaders.length)];
      return { status: 'ELIMINATED', playerId: picked, wasTieRandom: true };
    }
    // Default: 'revote' among tied leaders
    return { status: 'REVOTE', tiedIds: leaders };
  },

  /**
   * Checks whether Mr. White's typed guess matches the Civilian word (case/plural/typo tolerant).
   */
  checkMrWhiteGuess(guessRaw) {
    const target = State.match.wordPair.civ.toLowerCase().trim();
    const guess = String(guessRaw || '').toLowerCase().trim();
    if (!guess) return false;
    if (guess === target) return true;

    // Allow simple plural differences (e.g. "apple" vs "apples")
    if (guess + 's' === target || target + 's' === guess) return true;
    if (guess + 'es' === target || target + 'es' === guess) return true;

    // Allow 1-character Levenshtein typo for words >= 5 characters
    if (target.length >= 5 && this.levenshtein(guess, target) <= 1) {
      return true;
    }
    return false;
  },

  levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  },

  /**
   * Evaluates win conditions after an elimination or skipped round.
   */
  evaluateVictory() {
    const alive = State.match.players.filter((p) => p.alive);
    const civAlive = alive.filter((p) => p.role === 'CIVILIAN').length;
    const ucAlive = alive.filter((p) => p.role === 'UNDERCOVER').length;
    const mwAlive = alive.filter((p) => p.role === 'MR_WHITE').length;
    const infiltratorsAlive = ucAlive + mwAlive;

    // 1. Civilians win if all Undercovers & Mr. Whites are eliminated
    if (infiltratorsAlive === 0) {
      return {
        gameOver: true,
        winner: 'CIVILIANS',
        title: 'CIVILIANS WIN!',
        reason: 'All Undercovers and Mr. Whites have been eliminated.'
      };
    }

    // 2. Undercover / Infiltrator win conditions
    const rule = State.settings.ucWinRule;
    if (rule === 'last_two' && alive.length <= 2 && infiltratorsAlive >= 1) {
      return {
        gameOver: true,
        winner: ucAlive > 0 ? 'UNDERCOVER' : 'MR_WHITE',
        title: ucAlive > 0 ? 'UNDERCOVER WINS!' : 'MR. WHITE SURVIVES!',
        reason: 'An infiltrator survived down to the final two players.'
      };
    }

    if (rule === 'parity' && infiltratorsAlive >= civAlive) {
      return {
        gameOver: true,
        winner: ucAlive > 0 ? 'UNDERCOVER' : 'MR_WHITE',
        title: ucAlive > 0 ? 'UNDERCOVER WINS!' : 'MR. WHITE WINS!',
        reason: 'Infiltrators now equal or outnumber the remaining Civilians.'
      };
    }

    return { gameOver: false };
  }
};
      
