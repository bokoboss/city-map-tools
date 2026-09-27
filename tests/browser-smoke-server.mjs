import { createRequire } from 'node:module';
import { createServer as createHttpServer } from 'node:http';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const { createTileServer } = require('./map-tile-server.cjs');
const tileServer = createTileServer();
const shutdownServer = createHttpServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/shutdown') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(204).end();
  setImmediate(() => void shutdown());
});
let previewServer;
let closing;

const listen = (server, port) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => {
    server.removeListener('error', reject);
    resolve();
  });
});

const close = server => new Promise(resolve => {
  if (!server?.listening) return resolve();
  server.close(() => resolve());
});

const shutdown = () => {
  if (closing) return closing;
  closing = Promise.all([
    close(previewServer?.httpServer),
    close(tileServer),
    close(shutdownServer),
  ]);
  return closing;
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  await listen(tileServer, 4175);
  await listen(shutdownServer, 4174);
  previewServer = await preview({
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    logLevel: 'silent',
  });
} catch (error) {
  await shutdown();
  console.error(error);
  process.exitCode = 1;
}
