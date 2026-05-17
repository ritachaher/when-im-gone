import { useEffect, useRef, useState } from 'react';
import { isInitialised, lock, useVault } from './storage/vault';
import { Setup } from './ui/Setup';
import { Lock } from './ui/Lock';
import { Owner } from './ui/Owner';
import { Survivor } from './ui/Survivor';

type Screen = 'boot' | 'setup' | 'lock' | 'owner' | 'survivor';

// Auto-lock thresholds. Idle is the most common case - the user walks
// away from the laptop. Hidden-tab is a separate, shorter timer because
// "tab switched away" is a stronger signal of "not actively using".
const IDLE_LOCK_MS = 15 * 60 * 1000;
const HIDDEN_LOCK_MS = 5 * 60 * 1000;

export function App() {
  const unlocked = useVault((s) => s.unlocked);
  const [screen, setScreen] = useState<Screen>('boot');
  // Auto-lock timers. Refs (not state) so resetting them on every
  // mousemove doesn't trigger a re-render storm.
  const idleTimer = useRef<number | null>(null);
  const hiddenTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const hasJournal = await isInitialised();
      setScreen(hasJournal ? 'lock' : 'setup');
    })();
  }, []);

  useEffect(() => {
    if (unlocked && screen === 'lock') setScreen('owner');
  }, [unlocked]);

  // Idle / hidden-tab auto-lock. Active only while the vault is
  // unlocked - locking again is a no-op so we don't bother running the
  // timers when there's nothing to lock.
  useEffect(() => {
    if (!unlocked) return;

    function doLock() {
      lock();
      setScreen('lock');
    }

    function resetIdle() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(doLock, IDLE_LOCK_MS);
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
        hiddenTimer.current = window.setTimeout(doLock, HIDDEN_LOCK_MS);
      } else if (hiddenTimer.current) {
        clearTimeout(hiddenTimer.current);
        hiddenTimer.current = null;
      }
    }

    const events: Array<keyof DocumentEventMap> = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((e) => document.addEventListener(e, resetIdle, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    resetIdle();

    return () => {
      events.forEach((e) => document.removeEventListener(e, resetIdle));
      document.removeEventListener('visibilitychange', onVisibility);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
    };
  }, [unlocked]);

  if (screen === 'boot') return <div className="centre muted">Loading…</div>;

  if (screen === 'setup') return <Setup onDone={() => setScreen('owner')} />;

  if (screen === 'lock')
    return <Lock onSurvivor={() => setScreen('survivor')} />;

  if (screen === 'owner')
    return (
      <Owner
        onLock={() => {
          lock();
          setScreen('lock');
        }}
      />
    );

  if (screen === 'survivor')
    return <Survivor onBack={() => setScreen('lock')} />;

  return null;
}
