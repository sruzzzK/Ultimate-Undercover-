const KEYS = {
  SETTINGS: 'uu_settings_v1',
  NAMES: 'uu_player_names_v1',
  HISTORY: 'uu_word_history_v1',
  SETUP: 'uu_setup_v1'
};

export const Storage = {
  loadSettings(defaults) {
    try {
      const raw = localStorage.getItem(KEYS.SETTINGS);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Unable to persist settings:', e);
    }
  },

  loadNames() {
    try {
      const raw = localStorage.getItem(KEYS.NAMES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveNames(names) {
    try {
      localStorage.setItem(KEYS.NAMES, JSON.stringify(names));
    } catch (e) {
      console.warn('Unable to persist names:', e);
    }
  },

  loadSetup(defaults) {
    try {
      const raw = localStorage.getItem(KEYS.SETUP);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  },

  saveSetup(setup) {
    try {
      localStorage.setItem(KEYS.SETUP, JSON.stringify(setup));
    } catch (e) {
      console.warn('Unable to persist setup:', e);
    }
  },

  loadHistory() {
    try {
      const raw = localStorage.getItem(KEYS.HISTORY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  },

  saveHistory(historySet) {
    try {
      localStorage.setItem(KEYS.HISTORY, JSON.stringify([...historySet]));
    } catch (e) {
      console.warn('Unable to persist word history:', e);
    }
  },

  clearHistory() {
    try {
      localStorage.removeItem(KEYS.HISTORY);
    } catch (e) {
      console.warn('Unable to clear word history:', e);
    }
  }
};
