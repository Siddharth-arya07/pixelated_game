/**
 * Password gate for the whole site (browser's built-in login box).
 * Any username; the password is the SITE_PASSWORD secret:
 *   npx wrangler pages secret put SITE_PASSWORD --project-name three-am-nostalgia
 * Without the secret set, the site stays locked (fails closed).
 * Multiplayer sockets (/parties/*) skip the gate: the page that opens them is already behind it.
 */
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/parties/')) return next();
  const want = env.SITE_PASSWORD;
  if (!want) return new Response('Locked: the site password has not been set yet.', { status: 503 });
  const auth = request.headers.get('Authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    let pass = '';
    try {
      pass = atob(auth.slice(6)).split(':').slice(1).join(':');
    } catch {}
    if (pass === want) return next();
  }
  return new Response('3:00 a.m. — password, please.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="3:00 a.m.", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}
