// Shared exponential-backoff throttle for BOTH unlock surfaces (the
// owner Lock screen and the Survivor unlock screen). Keeping it in one
// module means there is no unthrottled path to unlockWithPassword /
// unlockWithRecovery from the UI.
//
// Honest threat model: the counter lives in localStorage, so an attacker
// with DevTools access can clear it. This throttle exists to slow down
// casual/opportunistic guessing (a housemate, a stolen unlocked laptop),
// not a capable attacker - against those, the real defences are the
// PBKDF2-600k work factor and the strength of the password itself.

const FAIL_KEY = 'wig.unlock.fails';
const FAIL_AT_KEY = 'wig.unlock.fails.at';

function readFails(): { count: number; lastAt: number } {
  try {
    return {
      count: Number(localStorage.getItem(FAIL_KEY)) || 0,
      lastAt: Number(localStorage.getItem(FAIL_AT_KEY)) || 0,
    };
  } catch {
    return { count: 0, lastAt: 0 };
  }
}

/** After 3 free tries, wait 2^(n-3) seconds, capped at 5 minutes. */
function backoffMs(count: number): number {
  if (count < 3) return 0;
  const seconds = Math.min(300, Math.pow(2, count - 3));
  return seconds * 1000;
}

/** Milliseconds the caller must still wait, or 0 if an attempt is allowed. */
export function throttleWaitMs(): number {
  const { count, lastAt } = readFails();
  return Math.max(0, backoffMs(count) - (Date.now() - lastAt));
}

/** Record a wrong-secret failure (not infrastructure errors). */
export function recordUnlockFailure(): void {
  try {
    const next = readFails().count + 1;
    localStorage.setItem(FAIL_KEY, String(next));
    localStorage.setItem(FAIL_AT_KEY, String(Date.now()));
  } catch {
    /* ignore - private mode etc. */
  }
}

/** Reset after a successful unlock. */
export function clearUnlockFailures(): void {
  try {
    localStorage.removeItem(FAIL_KEY);
    localStorage.removeItem(FAIL_AT_KEY);
  } catch {
    /* ignore */
  }
}
