import { defineConfig } from 'vite';

/**
 * The HTML entry lives at /src/ui/index.html (per the project layout), so we
 * rewrite "/" to it in dev + preview and point the production build at it.
 */
const ENTRY = '/src/ui/index.html';

function serveUiIndex() {
  const rewrite = (req, _res, next) => {
    // keep the query string (?room=ABCD invite links)
    const [path, query] = req.url.split('?');
    if (path === '/' || path === '/index.html') req.url = ENTRY + (query ? `?${query}` : '');
    next();
  };
  return {
    name: 'serve-ui-index',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [serveUiIndex()],
  // Models/audio are imported through import.meta.glob, so they get hashed and
  // bundled like any other asset. These make sure Vite treats them as assets.
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.wav', '**/*.mp3'],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200, // three.js alone is ~700 kB
    rollupOptions: {
      input: 'src/ui/index.html',
    },
  },
});
