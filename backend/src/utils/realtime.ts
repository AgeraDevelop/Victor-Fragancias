/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: backend/src/utils/realtime.ts
 * QUÉ ES: Hub de eventos en tiempo real (Server-Sent Events / SSE).
 *         Permite notificar a los navegadores conectados cuando:
 *           - 'products_updated': Un admin cambia precio, stock, visibilidad, etc.
 *             -> La landing page y el catálogo se refrescan solos.
 *           - 'orders_updated': Un cliente envía un pedido por WhatsApp o un
 *             admin lo confirma/cancela.
 *             -> El Panel Admin muestra el nuevo pedido y el badge al instante.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Response } from 'express';

export type RealtimeEvent = 'products_updated' | 'orders_updated';

class RealtimeHub {
  private clients: Set<Response> = new Set();

  /** Registra una conexión SSE del navegador. */
  subscribe(res: Response) {
    this.clients.add(res);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Emite un evento a todos los navegadores conectados (tienda y panel admin).
   */
  broadcast(event: RealtimeEvent, data: any = {}) {
    const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, timestamp: Date.now() })}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  /** Cantidad de clientes conectados en tiempo real. */
  get activeClients(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();
