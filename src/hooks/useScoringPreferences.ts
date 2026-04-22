import { useState } from 'react';
import {
  type ScoringPreferences,
  DEFAULT_SCORING_PREFS,
} from '../lib/topPicksEngine';

export type { ScoringPreferences };

const LS_KEY = 'ph_scoring_prefs_v1';

function loadPrefs(): ScoringPreferences {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SCORING_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SCORING_PREFS;
}

export function useScoringPreferences() {
  const [prefs, setPrefsState] = useState<ScoringPreferences>(loadPrefs);

  function setPrefs(updates: Partial<ScoringPreferences>) {
    setPrefsState((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* non-fatal */ }
      return next;
    });
  }

  function resetPrefs() {
    setPrefsState(DEFAULT_SCORING_PREFS);
    try { localStorage.removeItem(LS_KEY); } catch { /* non-fatal */ }
  }

  return { prefs, setPrefs, resetPrefs };
}
