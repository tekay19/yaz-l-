// A login POST must come from our own confirm page. Without this check a
// form on any site could post an attacker's token and sign the victim in to
// the attacker's account (login CSRF). Browsers send Origin on every POST;
// Referer is the fallback for the rare client that strips it.
export function fromOwnOrigin(req: Request, appUrl: string): boolean {
  const own = new URL(appUrl).origin;
  const origin = req.headers.get('origin');
  if (origin) return origin === own;
  const referer = req.headers.get('referer');
  return !!referer && (referer === own || referer.startsWith(`${own}/`));
}
