/** A pending recipient token may cross sign-in only in this tab, for at most ten minutes. */
const KEY = 'climateplus.pending-invitation.v1';
const valid = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
const fromHash = (hash) => {
  const value = new URLSearchParams(String(hash).replace(/^#/, '')).get('join');
  return valid(value) ? value : '';
};
export function tabStorage(browser) {
  try {
    return browser.sessionStorage;
  } catch {
    return null;
  }
}
export function rememberInvitation(hash, storage, now = Date.now()) {
  const token = fromHash(hash);
  if (!token || !storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ token, expiresAt: now + 600000 }));
    return true;
  } catch {
    return false;
  }
}
export function readInvitation(hash, storage, now = Date.now()) {
  const direct = fromHash(hash);
  let saved;
  try {
    saved = JSON.parse(storage?.getItem(KEY) || 'null');
  } catch {
    saved = null;
  }
  if (direct) return direct;
  return valid(saved?.token) &&
    Number.isFinite(saved?.expiresAt) &&
    saved.expiresAt > now &&
    saved.expiresAt <= now + 600000
    ? saved.token
    : '';
}
export function consumeInvitation(hash, storage, now = Date.now()) {
  const token = readInvitation(hash, storage, now);
  try {
    storage?.removeItem(KEY);
  } catch {
    /* Storage can be blocked; a direct fragment remains usable. */
  }
  return token;
}
