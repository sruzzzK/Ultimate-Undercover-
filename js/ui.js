import { State } from './state.js';
import { Engine } from './engine.js';
import { AudioFX } from './audio.js';

let activeTimerInterval = null;

export const UI = {
  applyThemeAndPrefs() {
    document.documentElement.setAttribute(
      'data-theme',
      State.settings.darkTheme ? 'dark' : 'light'
    );
    document.body.classList.toggle('no-animations', !State.settings.animations);
    AudioFX.enabled = State.settings.sound;

    // Sync settings inputs
    document.getElementById('set-dark-theme').checked = State.settings.darkTheme;
    document.getElementById('set-sound').checked = State.settings.sound;
    document.getElementById('set-animations').checked = State.settings.animations;
    document.getElementById('set-uc-win-rule').value = State.settings.ucWinRule;
    document.getElementById('set-tie-rule').value = State.settings.tieRule;
    document.getElementById('set-disc-timer').value = String(State.settings.discTimer);
    document.getElementById('set-vote-timer').value = String(State.settings.voteTimer);
    document.getElementById('set-recycle-words').checked = State.settings.recycleWords;
  },

  showScreen(screenId, title = '') {
    this.stopTimer();
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    const topBar = document.getElementById('top-bar');
    if (screenId === 'screen-home') {
      topBar.classList.add('hidden');
      this.renderHomeStats();
    } else {
      topBar.classList.remove('hidden');
      document.getElementById('top-bar-title').textContent = title;
    }
  },

  toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(el._tid);
    el._tid = setTimeout(() => el.classList.add('hidden'), 2800);
  },

  renderHomeStats() {
    const total = State.wordBank.length;
    const unplayed = State.wordBank.filter((w) => !State.usedPairIds.has(w.id)).length;
    document.getElementById('stat-total-words').textContent = total.toLocaleString();
    document.getElementById('stat-categories').textContent = State.categories.length;
    document.getElementById('stat-unplayed').textContent = unplayed.toLocaleString();
    document.getElementById('history-used-count').textContent = State.usedPairIds.size.toLocaleString();
  },

  renderSetup() {
    const { playerCount, undercoverCount, mrWhiteCount, randomRoles, difficulty, selectedCategories } = State.setup;

    document.getElementById('val-player-count').textContent = playerCount;
    document.getElementById('setup-player-badge').textContent = `${playerCount} Players`;
    document.getElementById('chk-random-roles').checked = randomRoles;

    const rolesPanel = document.getElementById('manual-roles-panel');
    rolesPanel.classList.toggle('disabled', randomRoles);

    const validation = Engine.validateRoles(playerCount, undercoverCount, mrWhiteCount);
    document.getElementById('val-uc-count').textContent = randomRoles ? '?' : undercoverCount;
    document.getElementById('val-mw-count').textContent = randomRoles ? '?' : mrWhiteCount;
    document.getElementById('val-civilians-count').textContent = randomRoles
      ? '?'
      : Math.max(0, playerCount - undercoverCount - mrWhiteCount);

    const valMsg = document.getElementById('role-validation-msg');
    const startBtn = document.getElementById('btn-start-match');

    if (!randomRoles && !validation.valid) {
      valMsg.textContent = validation.message;
      valMsg.classList.remove('hidden');
      startBtn.disabled = true;
    } else {
      valMsg.classList.add('hidden');
      startBtn.disabled = false;
    }

    // Difficulty buttons
    document.querySelectorAll('#difficulty-selector .seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === difficulty);
    });

    // Category chips
    const chipsContainer = document.getElementById('category-chips');
    chipsContainer.innerHTML = '';
    const allSelected = selectedCategories.length === 0;

    for (const cat of State.categories) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (allSelected || selectedCategories.includes(cat) ? ' selected' : '');
      chip.textContent = cat;
      chip.dataset.cat = cat;
      chipsContainer.appendChild(chip);
    }

    // Pool count badge
    const pool = Engine.getFilteredPool();
    document.getElementById('pool-count-badge').textContent = `${pool.length.toLocaleString()} pairs`;

    // Player Name Inputs
    const namesList = document.getElementById('player-names-list');
    namesList.innerHTML = '';
    for (let i = 0; i < playerCount; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'name-input-wrap';

      const idxSpan = document.createElement('span');
      idxSpan.className = 'name-index';
      idxSpan.textContent = `#${i + 1}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'name-input';
      input.maxLength = 18;
      input.placeholder = `Player ${i + 1}`;
      input.value = State.savedNames[i] || '';
      input.dataset.index = i;

      wrap.append(idxSpan, input);
      namesList.appendChild(wrap);
    }
  },

  renderDistributionStep() {
    const match = State.match;
    const player = match.players[match.distIndex];

    document.getElementById('dist-current-num').textContent = match.distIndex + 1;
    document.getElementById('dist-total-num').textContent = match.players.length;

    // Show pass card, strictly hide secret card first
    document.getElementById('dist-pass-card').classList.remove('hidden');
    document.getElementById('dist-secret-card').classList.add('hidden');

    document.getElementById('dist-avatar').textContent = player.name.slice(0, 2).toUpperCase();
    document.getElementById('dist-player-name').textContent = player.name;
  },

  revealCurrentPlayerSecret() {
    const player = State.match.players[State.match.distIndex];
    document.getElementById('dist-pass-card').classList.add('hidden');
    document.getElementById('dist-secret-card').classList.remove('hidden');

    document.getElementById('secret-owner-label').textContent = player.name;
    const badge = document.getElementById('secret-role-badge');
    const wordEl = document.getElementById('secret-word-display');
    const hintEl = document.getElementById('secret-instruction');

    if (player.role === 'MR_WHITE') {
      badge.textContent = 'YOU ARE MR. WHITE';
      badge.classList.add('mrwhite');
      wordEl.textContent = 'NO WORD';
      hintEl.textContent =
        'Listen carefully to everyone else, blend in, and deduce their secret word!';
    } else {
      badge.textContent = 'YOUR SECRET WORD';
      badge.classList.remove('mrwhite');
      wordEl.textContent = player.word;
      hintEl.textContent =
        'Give a subtle one-phrase clue. Do not make it too obvious for Mr. White!';
    }
  },

  renderDiscussion() {
    const match = State.match;
    document.getElementById('round-number').textContent = match.round;

    const alivePlayers = match.speakingOrder
      .map((id) => match.players.find((p) => p.id === id))
      .filter((p) => p && p.alive);

    document.getElementById('alive-count-badge').textContent = `${alivePlayers.length} Alive`;

    const list = document.getElementById('speaking-order-list');
    list.innerHTML = '';
    alivePlayers.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'speaking-item';
      li.innerHTML = `<span class="order-num">${idx + 1}</span><strong>${this.escapeHTML(p.name)}</strong>`;
      list.appendChild(li);
    });

    this.startTimer(
      State.settings.discTimer,
      'discussion-timer-box',
      'discussion-timer-val',
      () => this.toast('Discussion time is up! Proceed to voting.')
    );
  },

  renderVotingTurn() {
    const { voting } = State.match;
    const voter = State.match.players.find(
      (p) => p.id === voting.eligibleVoters[voting.voterIndex]
    );

    document.getElementById('voting-title').textContent =
      voting.isRevote ? 'Tie-Breaker Revote' : `Vote (${voting.voterIndex + 1}/${voting.eligibleVoters.length})`;
    document.getElementById('current-voter-name').textContent = voter.name;

    const grid = document.getElementById('voting-candidates-grid');
    grid.innerHTML = '';
    voting.selectedTarget = null;
    document.getElementById('btn-confirm-vote').disabled = true;

    for (const cid of voting.candidates) {
      const candidate = State.match.players.find((p) => p.id === cid);
      const isSelf = candidate.id === voter.id;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'candidate-card' + (isSelf ? ' self-disabled' : '');
      card.disabled = isSelf;
      card.dataset.id = candidate.id;
      card.innerHTML = `
        <div class="avatar-circle" style="width:46px;height:46px;font-size:1rem;">
          ${this.escapeHTML(candidate.name.slice(0, 2).toUpperCase())}
        </div>
        <strong>${this.escapeHTML(candidate.name)}</strong>
        <small style="color:var(--text-secondary)">${isSelf ? 'Cannot vote self' : 'Tap to suspect'}</small>
      `;
      grid.appendChild(card);
    }

    if (voting.voterIndex === 0) {
      this.startTimer(
        State.settings.voteTimer,
        'voting-timer-box',
        'voting-timer-val',
        () => this.toast('Voting timer expired!')
      );
    }
  },

  renderElimination(player, wasTieRandom = false) {
    document.getElementById('elim-player-name').textContent = player.name;
    const tag = document.getElementById('elim-role-tag');
    const desc = document.getElementById('elim-flavor-text');
    const mwBox = document.getElementById('mr-white-guess-box');
    const contBtn = document.getElementById('btn-after-elim');

    const roleLabels = {
      CIVILIAN: 'CIVILIAN',
      UNDERCOVER: 'UNDERCOVER',
      MR_WHITE: 'MR. WHITE'
    };
    tag.textContent = roleLabels[player.role];

    if (player.role === 'MR_WHITE') {
      desc.textContent = wasTieRandom
        ? 'Eliminated via sudden-death tie-breaker! Mr. White gets one final guess.'
        : 'Mr. White was caught—but has one chance to steal the game!';
      mwBox.classList.remove('hidden');
      contBtn.classList.add('hidden');
      document.getElementById('input-mw-guess').value = '';
    } else {
      desc.textContent =
        player.role === 'UNDERCOVER'
          ? 'Great deduction! An Undercover agent has been eliminated.'
          : 'Oh no! An innocent Civilian was voted out.';
      mwBox.classList.add('hidden');
      contBtn.classList.remove('hidden');
    }
  },

  renderVictory(result) {
    const match = State.match;
    document.getElementById('victory-winner-title').textContent = result.title;
    document.getElementById('victory-reason').textContent = result.reason;
    document.getElementById('final-civ-word').textContent = match.wordPair.civ;
    document.getElementById('final-uc-word').textContent = match.wordPair.uc;
    document.getElementById('final-pair-meta').textContent =
      `${match.wordPair.cat} • ${match.wordPair.diff.toUpperCase()}`;

    const list = document.getElementById('final-roles-list');
    list.innerHTML = '';
    const badges = {
      CIVILIAN: '<span class="badge badge-civ">CIVILIAN</span>',
      UNDERCOVER: '<span class="badge badge-uc">UNDERCOVER</span>',
      MR_WHITE: '<span class="badge badge-mw">MR. WHITE</span>'
    };

    for (const p of match.players) {
      const li = document.createElement('li');
      li.className = 'final-role-row';
      li.innerHTML = `
        <span><strong>${this.escapeHTML(p.name)}</strong> ${p.alive ? '' : '💀'}</span>
        ${badges[p.role]}
      `;
      list.appendChild(li);
    }
  },

  startTimer(seconds, boxId, valId, onExpire) {
    this.stopTimer();
    const box = document.getElementById(boxId);
    const val = document.getElementById(valId);

    if (!seconds || seconds <= 0) {
      box.classList.add('hidden');
      return;
    }

    let remaining = seconds;
    box.classList.remove('hidden');
    const format = (s) =>
      `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    val.textContent = format(remaining);

    activeTimerInterval = setInterval(() => {
      remaining--;
      val.textContent = format(Math.max(0, remaining));
      if (remaining <= 5 && remaining > 0) AudioFX.tick();
      if (remaining <= 0) {
        this.stopTimer();
        if (onExpire) onExpire();
      }
    }, 1000);
  },

  stopTimer() {
    if (activeTimerInterval) {
      clearInterval(activeTimerInterval);
      activeTimerInterval = null;
    }
  },

  escapeHTML(str) {
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
};
