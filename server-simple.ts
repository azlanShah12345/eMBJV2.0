import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Simple Vite Server listening on http://0.0.0.0:${PORT}`);
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

startServer().catch(console.error);
