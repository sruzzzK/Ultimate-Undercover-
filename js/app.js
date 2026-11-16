
import { State } from './state.js';
import { Storage } from './storage.js';
import { Engine } from './engine.js';
import { UI } from './ui.js';
import { RAW_WORD_DATABASE } from '../data/words.js';

// Audio is deliberately excluded from gameplay.
// Nothing should depend on sound working.

function showStartupError(err) {
  console.error('Ultimate Undercover startup error:', err);

  let box = document.getElementById('startup-error');

  if (!box) {
    box = document.createElement('div');
    box.id = 'startup-error';
    box.style.cssText = `
      position:fixed;
      z-index:99999;
      top:10px;
      left:10px;
      right:10px;
      padding:16px;
      background:#7f1d1d;
      color:white;
      border-radius:12px;
      font:14px sans-serif;
      white-space:pre-wrap;
    `;
    document.body.appendChild(box);
  }

  box.textContent =
    'GAME STARTUP ERROR\n' +
    (err?.message || String(err)) +
    '\n\nPlease send this error to the developer.';
}

function bindEvents() {
  const el = (id) => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing HTML element: ${id}`);
    return element;
  };

  // Navigation
  el('btn-home-play').addEventListener('click', () => {
    UI.renderSetup();
    UI.showScreen('screen-setup', 'GAME SETUP');
  });

  el('btn-nav-home').addEventListener('click', () => {
    UI.showScreen('screen-home');
  });

  const openSettings = () => {
    UI.renderHomeStats();
    el('modal-settings').classList.remove('hidden');
  };

  el('btn-home-settings').addEventListener('click', openSettings);
  el('btn-nav-settings').addEventListener('click', openSettings);

  el('btn-close-settings').addEventListener('click', () => {
    el('modal-settings').classList.add('hidden');
  });

  el('btn-home-rules').addEventListener('click', () => {
    el('modal-rules').classList.remove('hidden');
  });

  el('btn-close-rules').addEventListener('click', () => {
    el('modal-rules').classList.add('hidden');
  });

  // Settings
  const syncSetting = (id, key, isCheckbox = true) => {
    el(id).addEventListener('change', (e) => {
      State.settings[key] = isCheckbox
        ? e.target.checked
        : isNaN(Number(e.target.value))
          ? e.target.value
          : Number(e.target.value);

      Storage.saveSettings(State.settings);

      try {
        UI.applyThemeAndPrefs();
      } catch (err) {
        console.error('Settings display error:', err);
      }
    });
  };

  syncSetting('set-dark-theme', 'darkTheme');
  syncSetting('set-sound', 'sound');
  syncSetting('set-animations', 'animations');
  syncSetting('set-uc-win-rule', 'ucWinRule', false);
  syncSetting('set-tie-rule', 'tieRule', false);
  syncSetting('set-disc-timer', 'discTimer', false);
  syncSetting('set-vote-timer', 'voteTimer', false);
  syncSetting('set-recycle-words', 'recycleWords');

  el('btn-reset-history').addEventListener('click', () => {
    State.usedPairIds.clear();
    Storage.clearHistory();
    UI.renderHomeStats();
    UI.toast('Word history cleared! All pairs are fresh again.');
  });

  // Player count
  el('btn-players-dec').addEventListener('click', () => {
    if (State.setup.playerCount > 3) {
      State.setup.playerCount--;
      Storage.saveSetup(State.setup);
      UI.renderSetup();
    }
  });

  el('btn-players-inc').addEventListener('click', () => {
    if (State.setup.playerCount < 20) {
      State.setup.playerCount++;
      Storage.saveSetup(State.setup);
      UI.renderSetup();
    }
  });

  el('chk-random-roles').addEventListener('change', (e) => {
    State.setup.randomRoles = e.target.checked;
    Storage.saveSetup(State.setup);
    UI.renderSetup();
  });

  el('btn-uc-dec').addEventListener('click', () => {
    if (State.setup.undercoverCount > 0) {
      State.setup.undercoverCount--;
      Storage.saveSetup(State.setup);
      UI.renderSetup();
    }
  });

  el('btn-uc-inc').addEventListener('click', () => {
    if (State.setup.undercoverCount < State.setup.playerCount - 1) {
      State.setup.undercoverCount++;
      Storage.saveSetup(State.setup);
      UI.renderSetup();
    }
  });

  el('btn-mw-dec').addEventListener('click', () => {
    if (State.setup.mrWhiteCount > 0) {
      State.setup.mrWhiteCount--;
      Storage.saveSetup(State.setup);
      UI.renderSetup();
    }
  });

  el('btn-mw-inc').addEventListener('click', () => {
    if (State.setup.mrWhiteCount < State.setup.playerCount - 1) {
      State.setup.mrWhiteCount++;
      Storage.saveSetup(State.setup);
      UI.renderSetup();
    }
  });

  // Difficulty and categories
  el('difficulty-selector').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;

    State.setup.difficulty = btn.dataset.diff;
    Storage.saveSetup(State.setup);
    UI.renderSetup();
  });

  el('category-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    const cat = chip.dataset.cat;
    let selected = State.setup.selectedCategories;

    if (selected.length === 0) {
      selected = State.categories.filter((c) => c !== cat);
    } else if (selected.includes(cat)) {
      selected = selected.filter((c) => c !== cat);
    } else {
      selected = [...selected, cat];

      if (selected.length === State.categories.length) {
        selected = [];
      }
    }

    State.setup.selectedCategories = selected;
    Storage.saveSetup(State.setup);
    UI.renderSetup();
  });

  el('btn-cats-all').addEventListener('click', () => {
    State.setup.selectedCategories = [];
    Storage.saveSetup(State.setup);
    UI.renderSetup();
  });

  el('btn-cats-none').addEventListener('click', () => {
    State.setup.selectedCategories = [State.categories[0]];
    Storage.saveSetup(State.setup);
    UI.renderSetup();
    UI.toast('At least one category must remain selected.');
  });

  // Player names
  el('player-names-list').addEventListener('input', (e) => {
    if (!e.target.classList.contains('name-input')) return;

    const idx = Number(e.target.dataset.index);
    State.savedNames[idx] = e.target.value;
    Storage.saveNames(State.savedNames);
  });

  el('btn-reset-names').addEventListener('click', () => {
    State.savedNames = [];
    Storage.saveNames([]);
    UI.renderSetup();
  });

  // Start game
  el('btn-start-match').addEventListener('click', () => {
    const inputs = [
      ...document.querySelectorAll('#player-names-list .name-input')
    ];

    const names = inputs.map(
      (inp, i) => inp.value.trim() || `Player ${i + 1}`
    );

    State.savedNames = names;
    Storage.saveNames(names);

    try {
      Engine.createMatch(names);
      UI.renderDistributionStep();
      UI.showScreen('screen-distribution', 'SECRET ROLES');
    } catch (err) {
      UI.toast(err.message);
    }
  });

  // Role distribution
  el('btn-reveal-role').addEventListener('click', () => {
    UI.revealCurrentPlayerSecret();
  });

  el('btn-hide-pass').addEventListener('click', () => {
    State.match.distIndex++;

    if (State.match.distIndex < State.match.players.length) {
      UI.renderDistributionStep();
    } else {
      UI.renderDiscussion();
      UI.showScreen('screen-discussion', 'DISCUSSION');
    }
  });

  // Discussion to voting
  el('btn-goto-voting').addEventListener('click', () => {
    const aliveIds = State.match.players
      .filter((p) => p.alive)
      .map((p) => p.id);

    State.match.voting = {
      eligibleVoters: aliveIds,
      candidates: aliveIds,
      voterIndex: 0,
      votes: {},
      selectedTarget: null,
      isRevote: false
    };

    UI.renderVotingTurn();
    UI.showScreen('screen-voting', 'VOTING');
  });

  // Voting selection
  el('voting-candidates-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.candidate-card');
    if (!card || card.disabled) return;

    document
      .querySelectorAll('#voting-candidates-grid .candidate-card')
      .forEach((c) => c.classList.remove('selected'));

    card.classList.add('selected');
    State.match.voting.selectedTarget = card.dataset.id;
    el('btn-confirm-vote').disabled = false;
  });

  // Confirm vote
  el('btn-confirm-vote').addEventListener('click', () => {
    const { voting } = State.match;
    if (!voting.selectedTarget) return;

    voting.votes[voting.selectedTarget] =
      (voting.votes[voting.selectedTarget] || 0) + 1;

    voting.voterIndex++;

    if (voting.voterIndex < voting.eligibleVoters.length) {
      UI.renderVotingTurn();
      return;
    }

    const outcome = Engine.tallyVotes();

    if (outcome.status === 'REVOTE') {
      if (voting.isRevote) {
        const pickedId = outcome.tiedIds[
          Math.floor(Math.random() * outcome.tiedIds.length)
        ];

        const eliminated = State.match.players.find(
          (p) => p.id === pickedId
        );

        eliminated.alive = false;
        State.match.lastEliminated = eliminated;

        UI.toast('Revote tied again! Random sudden-death elimination.');
        UI.renderElimination(eliminated, true);
        UI.showScreen('screen-elimination', 'ELIMINATION');
        return;
      }

      UI.toast('Tie detected! Starting revote among tied suspects.');

      const aliveIds = State.match.players
        .filter((p) => p.alive)
        .map((p) => p.id);

      State.match.voting = {
        eligibleVoters: aliveIds,
        candidates: outcome.tiedIds,
        voterIndex: 0,
        votes: {},
        selectedTarget: null,
        isRevote: true
      };

      UI.renderVotingTurn();
      return;
    }

    if (outcome.status === 'NO_ELIMINATION') {
      UI.toast('Vote tied! Nobody was eliminated this round.');
      State.match.round++;
      UI.renderDiscussion();
      UI.showScreen('screen-discussion', 'DISCUSSION');
      return;
    }

    const eliminated = State.match.players.find(
      (p) => p.id === outcome.playerId
    );

    eliminated.alive = false;
    State.match.lastEliminated = eliminated;

    UI.renderElimination(eliminated, outcome.wasTieRandom);
    UI.showScreen('screen-elimination', 'ELIMINATION');
  });

  // Mr. White final guess
  el('btn-submit-mw-guess').addEventListener('click', () => {
    const guess = el('input-mw-guess').value;

    if (!guess.trim()) {
      UI.toast('Enter a guess first!');
      return;
    }

    if (Engine.checkMrWhiteGuess(guess)) {
      UI.renderVictory({
        gameOver: true,
        winner: 'MR_WHITE',
        title: 'MR. WHITE WINS!',
        reason: `${State.match.lastEliminated.name} correctly guessed "${State.match.wordPair.civ}"!`
      });

      UI.showScreen('screen-victory', 'VICTORY');
    } else {
      UI.toast(`Wrong guess! "${guess.trim()}" is not the Civilian word.`);
      el('mr-white-guess-box').classList.add('hidden');
      el('btn-after-elim').classList.remove('hidden');
    }
  });

  // Continue after elimination
  el('btn-after-elim').addEventListener('click', () => {
    const victoryCheck = Engine.evaluateVictory();

    if (victoryCheck.gameOver) {
      UI.renderVictory(victoryCheck);
      UI.showScreen('screen-victory', 'VICTORY');
    } else {
      State.match.round++;
      UI.renderDiscussion();
      UI.showScreen('screen-discussion', 'DISCUSSION');
    }
  });

  // Victory screen
  el('btn-victory-again').addEventListener('click', () => {
    UI.renderSetup();
    UI.showScreen('screen-setup', 'GAME SETUP');
  });

  el('btn-victory-home').addEventListener('click', () => {
    UI.showScreen('screen-home');
  });
}

function bootstrap() {
  // Word database
  try {
    Engine.sanitizeDatabase(RAW_WORD_DATABASE);
  } catch (err) {
    showStartupError(err);
    return;
  }

  // Optional startup tasks must not prevent gameplay controls.
  try {
    UI.applyThemeAndPrefs();
  } catch (err) {
    console.error('Theme setup failed:', err);
  }

  try {
    UI.renderHomeStats();
  } catch (err) {
    console.error('Home stats setup failed:', err);
  }

  // Service worker is optional.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Offline support unavailable:', err);
    });
  }

  // Attach game controls.
  try {
    bindEvents();
  } catch (err) {
    showStartupError(err);
  }
}

try {
  bootstrap();
} catch (err) {
  showStartupError(err);
}
