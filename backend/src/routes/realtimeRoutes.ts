/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: backend/src/routes/realtimeRoutes.ts
 * QUÉ ES: Endpoint SSE (/api/events) para tiempo real.
 *         Navegadores conectan con new EventSource('/api/events').
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from 'express';
import { realtimeHub } from '../utils/realtime.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  // Cabeceras estándar para Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  // Saludo inicial de conexión establecida
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, time: Date.now() })}\n\n`);

  realtimeHub.subscribe(res);

  // Ping keep-alive cada 25 segundos para evitar timeouts de red o proxies
  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

export default router;
