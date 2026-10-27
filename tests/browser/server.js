import { preview } from 'vite';

// Run the production preview in the test runner so teardown does not need to
// kill a shell/process tree on Windows.
export default async function startServer() {
  const server = await preview({ preview: { host: '127.0.0.1', port: 5189, strictPort: true } });
  return () => new Promise((resolve, reject) => {
    server.httpServer.close(error => error ? reject(error) : resolve());
    server.httpServer.closeAllConnections();
  });
}
