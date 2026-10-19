/** Multiplayer: pass room connections (WebSocket) straight to the rooms worker. */
export function onRequest({ request, env }) {
  return env.ROOMS.fetch(request);
}
