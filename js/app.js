import { State } from './state.js';
import { Storage } from './storage.js';
import { Engine } from './engine.js';
import { AudioFX } from './audio.js';
import { UI } from './ui.js';
import { RAW_WORD_DATABASE } from '../data/words.js';

function bootstrap() {
  // 1. Validate and deduplicate the word database on boot
  Engine.sanitizeDatabase(RAW_WORD_DATABASE);

  // 2. Apply saved theme & preferences
  UI.applyThemeAndPrefs();
  UI.renderHomeStats();

  // 3. Register Service Worker for offline playability
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  bindEvents();
}

function bindEvents() {
  // Navigation & Modals
  document.getElementById('btn-home-play').addEventListener('click', () => {
    AudioFX.click();
    UI.renderSetup();
    UI.showScreen('screen-setup', 'GAME SETUP');
  });

  document.getElementById('btn-nav-home').addEventListener('click', () => {
    AudioFX.click();
    UI.showScreen('screen-home');
  });

  const openSettings = () => {
    AudioFX.click();
    UI.renderHomeStats();
    document.getElementById('modal-settings').classList.remove('hidden');
  };
  document.getElementById('btn-home-settings').addEventListener('click', openSettings);
  document.getElementById('btn-nav-settings').addEventListener('click', openSettings);
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    AudioFX.click();
    document.getElementById('modal-settings').classList.add('hidden');
  });

  document.getElementById('btn-home-rules').addEventListener('click', () => {
    AudioFX.click();
    document.getElementById('modal-rules').classList.remove('hidden');
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    AudioFX.click();
    document.getElementById('modal-rules').classList.add('hidden');
  });

  // Settings Toggles & Selects
  const syncSetting = (id, key, isCheckbox = true) => {
    document.getElementById(id).addEventListener('change', (e) => {
      State.settings[key] = isCheckbox
        ? e.target.checked
        : isNaN(Number(e.target.value))
          ? e.target.value
          : Number(e.target.value);
      Storage.saveSettings(State.settings);
      UI.applyThemeAndPrefs();
      AudioFX.click();
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

  document.getElementById('btn-reset-history').addEventListener('click', () => {
    State.usedPairIds.clear();
    Storage.clearHistory();
    UI.renderHomeStats();
    AudioFX.click();
    UI.toast('Word history cleared! All pairs are fresh again.');
  });

  // Setup Controls: Player Count & Roles
  document.getElementById('btn-players-dec').addEventListener('click', () => {
    if (State.setup.playerCount > 3) {
      State.setup.playerCount--;
      Storage.saveSetup(State.setup);
      AudioFX.click();
      UI.renderSetup();
    }
  });

  document.getElementById('btn-players-inc').addEventListener('click', () => {
    if (State.setup.playerCount < 20) {
      State.setup.playerCount++;
      Storage.saveSetup(State.setup);
      AudioFX.click();
      UI.renderSetup();
    }
  });

  document.getElementById('chk-random-roles').addEventListener('change', (e) => {
    State.setup.randomRoles = e.target.checked;
    Storage.saveSetup(State.setup);
    AudioFX.click();
    UI.renderSetup();
  });

  document.getElementById('btn-uc-dec').addEventListener('click', () => {
    if (State.setup.undercoverCount > 0) {
      State.setup.undercoverCount--;
      Storage.saveSetup(State.setup);
      AudioFX.click();
      UI.renderSetup();
    }
  });

  document.getElementById('btn-uc-inc').addEventListener('click', () => {
    if (State.setup.undercoverCount < State.setup.playerCount - 1) {
      State.setup.undercoverCount++;
      Storage.saveSetup(State.setup);
      AudioFX.click();
      UI.renderSetup();
    }
  });

  document.getElementById('btn-mw-dec').addEventListener('click', () => {
    if (State.setup.mrWhiteCount > 0) {
      State.setup.mrWhiteCount--;
      Storage.saveSetup(State.setup);
      AudioFX.click();
      UI.renderSetup();
    }
  });

  document.getElementById('btn-mw-inc').addEventListener('click', () => {
    if (State.setup.mrWhiteCount < State.setup.playerCount - 1) {
      State.setup.mrWhiteCount++;
      Storage.saveSetup(State.setup);
      AudioFX.click();
      UI.renderSetup();
    }
  });

  // Difficulty & Categories
  document.getElementById('difficulty-selector').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    State.setup.difficulty = btn.dataset.diff;
    Storage.saveSetup(State.setup);
    AudioFX.click();
    UI.renderSetup();
  });

  document.getElementById('category-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const cat = chip.dataset.cat;
    let selected = State.setup.selectedCategories;

    if (selected.length === 0) {
      // Transition from "All" to everything except clicked
      selected = State.categories.filter((c) => c !== cat);
    } else if (selected.includes(cat)) {
      selected = selected.filter((c) => c !== cat);
    } else {
      selected = [...selected, cat];
      if (selected.length === State.categories.length) selected = [];
    }

    State.setup.selectedCategories = selected;
    Storage.saveSetup(State.setup);
    AudioFX.click();
    UI.renderSetup();
  });

  document.getElementById('btn-cats-all').addEventListener('click', () => {
    State.setup.selectedCategories = [];
    Storage.saveSetup(State.setup);
    AudioFX.click();
    UI.renderSetup();
  });

  document.getElementById('btn-cats-none').addEventListener('click', () => {
    State.setup.selectedCategories = [State.categories[0]];
    Storage.saveSetup(State.setup);
    AudioFX.click();
    UI.renderSetup();
    UI.toast('At least one category must remain selected.');
  });

  // Player Names Persistence
  document.getElementById('player-names-list').addEventListener('input', (e) => {
    if (!e.target.classList.contains('name-input')) return;
    const idx = Number(e.target.dataset.index);
    State.savedNames[idx] = e.target.value;
    Storage.saveNames(State.savedNames);
  });

  document.getElementById('btn-reset-names').addEventListener('click', () => {
    State.savedNames = [];
    Storage.saveNames([]);
    AudioFX.click();
    UI.renderSetup();
  });

  // Start Match
  document.getElementById('btn-start-match').addEventListener('click', () => {
    const inputs = [...document.querySelectorAll('#player-names-list .name-input')];
    const names = inputs.map((inp, i) => inp.value.trim() || `Player ${i + 1}`);
    State.savedNames = names;
    Storage.saveNames(names);

    try {
      Engine.createMatch(names);
      AudioFX.click();
      UI.renderDistributionStep();
      UI.showScreen('screen-distribution', 'SECRET ROLES');
    } catch (err) {
      UI.toast(err.message);
    }
  });

  // Role Distribution Flow
  document.getElementById('btn-reveal-role').addEventListener('click', () => {
    AudioFX.reveal();
    UI.revealCurrentPlayerSecret();
  });

  document.getElementById('btn-hide-pass').addEventListener('click', () => {
    AudioFX.click();
    State.match.distIndex++;
    if (State.match.distIndex < State.match.players.length) {
      UI.renderDistributionStep();
    } else {
      UI.renderDiscussion();
      UI.showScreen('screen-discussion', 'DISCUSSION');
    }
  });

  // Discussion -> Voting
  document.getElementById('btn-goto-voting').addEventListener('click', () => {
    AudioFX.click();
    const aliveIds = State.match.players.filter((p) => p.alive).map((p) => p.id);
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

  // Voting Selection & Confirmation
  document.getElementById('voting-candidates-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.candidate-card');
    if (!card || card.disabled) return;
    AudioFX.click();

    document
      .querySelectorAll('#voting-candidates-grid .candidate-card')
      .forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    State.match.voting.selectedTarget = card.dataset.id;
    document.getElementById('btn-confirm-vote').disabled = false;
  });

  document.getElementById('btn-confirm-vote').addEventListener('click', () => {
    const { voting } = State.match;
    if (!voting.selectedTarget) return;

    AudioFX.click();
    voting.votes[voting.selectedTarget] = (voting.votes[voting.selectedTarget] || 0) + 1;
    voting.voterIndex++;

    if (voting.voterIndex < voting.eligibleVoters.length) {
      UI.renderVotingTurn();
      return;
    }

    // All eligible voters have voted -> tally results
    const outcome = Engine.tallyVotes();

    if (outcome.status === 'REVOTE') {
      UI.toast('Tie detected! Starting revote among tied suspects.');
      const aliveIds = State.match.players.filter((p) => p.alive).map((p) => p.id);
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

    // Eliminate player
    const eliminated = State.match.players.find((p) => p.id === outcome.playerId);
    eliminated.alive = false;
    State.match.lastEliminated = eliminated;
    AudioFX.eliminate();
    UI.renderElimination(eliminated, outcome.wasTieRandom);
    UI.showScreen('screen-elimination', 'ELIMINATION');
  });

  // Mr. White Final Guess Submission
  document.getElementById('btn-submit-mw-guess').addEventListener('click', () => {
    const guess = document.getElementById('input-mw-guess').value;
    if (!guess.trim()) {
      UI.toast('Enter a guess first!');
      return;
    }

    if (Engine.checkMrWhiteGuess(guess)) {
      AudioFX.victory();
      UI.renderVictory({
        gameOver: true,
        winner: 'MR_WHITE',
        title: 'MR. WHITE WINS!',
        reason: `${State.match.lastEliminated.name} correctly guessed "${State.match.wordPair.civ}"!`
      });
      UI.showScreen('screen-victory', 'VICTORY');
    } else {
      UI.toast(`Wrong guess! "${guess.trim()}" is not the Civilian word.`);
      document.getElementById('mr-white-guess-box').classList.add('hidden');
      document.getElementById('btn-after-elim').classList.remove('hidden');
    }
  });

  // Continue after Elimination
  document.getElementById('btn-after-elim').addEventListener('click', () => {
    AudioFX.click();
    const victoryCheck = Engine.evaluateVictory();
    if (victoryCheck.gameOver) {
      AudioFX.victory();
      UI.renderVictory(victoryCheck);
      UI.showScreen('screen-victory', 'VICTORY');
    } else {
      State.match.round++;
      UI.renderDiscussion();
      UI.showScreen('screen-discussion', 'DISCUSSION');
    }
  });

  // Victory Screen Actions
  document.getElementById('btn-victory-again').addEventListener('click', () => {
    AudioFX.click();
    UI.renderSetup();
    UI.showScreen('screen-setup', 'GAME SETUP');
  });

  document.getElementById('btn-victory-home').addEventListener('click', () => {
    AudioFX.click();
    UI.showScreen('screen-home');
  });
}

bootstrap();
