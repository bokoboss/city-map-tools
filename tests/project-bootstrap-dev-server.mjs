import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';

const appServer = await createViteServer({
  server: { host: '127.0.0.1', port: 4336, strictPort: true },
  logLevel: 'silent',
});
const shutdownServer = createHttpServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/shutdown') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(204).end();
  setImmediate(() => void shutdown());
});
let closing;

const close = server => new Promise(resolve => {
  if (!server?.listening) return resolve();
  server.close(() => resolve());
});

const shutdown = () => {
  if (closing) return closing;
  closing = Promise.all([appServer.close(), close(shutdownServer)]);
  return closing;
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  await appServer.listen();
  await new Promise((resolve, reject) => {
    shutdownServer.once('error', reject);
    shutdownServer.listen(4337, '127.0.0.1', () => {
      shutdownServer.removeListener('error', reject);
      resolve();
    });
  });
} catch (error) {
  await shutdown();
  console.error(error);
  process.exitCode = 1;
}
