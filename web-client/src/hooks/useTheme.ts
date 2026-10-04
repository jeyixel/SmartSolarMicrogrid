import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPreference(storageKey: string): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Storage can be blocked (private mode, locked-down browser); fall back to system.
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Light / dark / system theme for one portal.
 *
 * Applies Tailwind's `dark` class to <html> while the calling layout is
 * mounted and removes it on unmount, so the choice made in one portal does
 * not leak into another (e.g. Backoffice stays light). The colors themselves
 * are the CSS variables in index.css.
 */
export function useTheme(storageKey: string) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readPreference(storageKey),
  );
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Follow OS changes live while the preference is "system".
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    return () => root.classList.remove('dark');
  }, [isDark]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // Not persisted, but still applied for this session.
      }
    },
    [storageKey],
  );

  return { preference, setPreference, isDark };
}
