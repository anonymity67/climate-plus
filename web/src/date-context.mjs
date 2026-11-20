const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  calendar: 'iso8601',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Bangladesh calendar day for an instant: Date, epoch milliseconds, or ISO timestamp with zone. */
export function bangladeshDate(now = Date.now()) {
  if (typeof now === 'string') {
    // Never let a bare date or a timestamp without a zone depend on the host timezone.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(now))
      throw Error('Provide a valid instant with an explicit timezone.');
    const day = new Date(now.slice(0, 10) + 'T00:00:00Z');
    if (
      !Number.isFinite(+day) ||
      day.toISOString().slice(0, 10) !== now.slice(0, 10) ||
      Number(now.slice(11, 13)) > 23
    )
      throw Error('Provide a valid instant.');
  } else if (!(now instanceof Date) && typeof now !== 'number') {
    throw Error('Provide a valid instant.');
  }
  const instant = new Date(now);
  if (!Number.isFinite(+instant) || instant.getUTCFullYear() < 1 || instant.getUTCFullYear() > 9999)
    throw Error('Provide a valid instant.');
  const parts = Object.fromEntries(
    calendar.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  const result = `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw Error('Provide a valid instant.');
  return result;
}
