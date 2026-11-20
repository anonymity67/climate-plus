export function isNoticeCurrent(confirmedAt, now = Date.now()) {
  if (typeof confirmedAt !== 'string' || !Number.isFinite(now)) return false;
  const issued = Date.parse(confirmedAt);
  return Number.isFinite(issued) && now >= issued && now - issued < 86400000;
}
