// An id from a URL or a cookie, checked before it reaches a uuid column:
// Postgres rejects a malformed one with an error, which would surface as a 500.
export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
