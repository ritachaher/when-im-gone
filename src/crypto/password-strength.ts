// Password-strength helpers used at setup time.
//
// We do two things:
//   1. Local rule check (length, character classes, symbol).
//   2. k-anonymity lookup against Have I Been Pwned. Only the first
//      5 hex chars of SHA-1(password) leave the device - neither the
//      password nor the full hash. HIBP returns ~500 candidate
//      suffixes; we look for an exact match in-process.
//
// HIBP is an opt-in network call. If the network is unavailable we
// allow the password through with a soft warning rather than blocking
// setup - being unable to talk to a third party shouldn't lock people
// out of their own journal.

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export type LocalRules = {
  len: boolean;       // ≥ 8 chars
  letter: boolean;    // any letter
  number: boolean;    // any digit
  symbol: boolean;    // any non-alphanum
  mixed: boolean;     // both upper & lower
};

export function checkLocalRules(pw: string): LocalRules {
  return {
    len: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
    mixed: /[A-Z]/.test(pw) && /[a-z]/.test(pw),
  };
}

export function localRulesPass(r: LocalRules): boolean {
  return r.len && r.letter && r.number && r.symbol && r.mixed;
}

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export type BreachCheckResult =
  | { status: 'safe' }
  | { status: 'breached'; count: number }
  | { status: 'unknown'; reason: string };

/**
 * k-anonymity HIBP check. Returns 'breached' with the appearance count
 * if the password is in the public breach corpus, 'safe' if not, or
 * 'unknown' if we couldn't reach HIBP (network down, CSP blocked, etc).
 *
 * Callers should treat 'unknown' as a soft warning, not a blocker.
 */
export async function checkBreached(pw: string): Promise<BreachCheckResult> {
  try {
    const hash = await sha1Hex(pw);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(HIBP_RANGE_URL + prefix, {
      // HIBP rejects requests with custom non-CORS headers; default fetch
      // is fine. No credentials, no cookies, no padding header (we don't
      // need additional anonymity beyond k-anonymity here).
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) {
      return { status: 'unknown', reason: `hibp_http_${res.status}` };
    }
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [tail, countStr] = line.trim().split(':');
      if (tail === suffix) {
        return { status: 'breached', count: Number(countStr) || 1 };
      }
    }
    return { status: 'safe' };
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
    return { status: 'unknown', reason: name || 'fetch_failed' };
  }
}
