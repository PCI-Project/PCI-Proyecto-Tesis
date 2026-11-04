import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const overpassProxy = {
  '/api/overpass/private': {
    target: 'https://overpass.private.coffee',
    changeOrigin: true,
    rewrite: () => '/api/interpreter',
  },
  '/api/overpass/main': {
    target: 'https://overpass-api.de',
    changeOrigin: true,
    rewrite: () => '/api/interpreter',
  },
  '/api/overpass/maps': {
    target: 'https://maps.mail.ru',
    changeOrigin: true,
    rewrite: () => '/osm/tools/overpass/api/interpreter',
  },
  '/api/osm/map': {
    target: 'https://api.openstreetmap.org',
    changeOrigin: true,
    rewrite: pathName => pathName.replace('/api/osm/map', '/api/0.6/map'),
  },
};

export default defineConfig(() => {
    return {
      server: {
        port: 3500,
        host: '0.0.0.0',
        proxy: overpassProxy,
      },
      preview: { proxy: overpassProxy },
      plugins: [react()],
      // MapLibre 6 carga su worker (maplibre-gl-worker.mjs) junto al módulo principal; el optimizador de
      // dependencias de Vite no lo copia y en desarrollo el mapa queda sin teselas ni geometrías.
      optimizeDeps: { exclude: ['maplibre-gl'] },
      base: 'http://www.asphaltpcipro.company/',
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      }
    };
});
