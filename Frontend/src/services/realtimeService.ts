/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/services/realtimeService.ts
 * QUÉ ES: Cliente de eventos en tiempo real (Server-Sent Events / SSE).
 *         Mantiene una conexión abierta y ligera con el backend (/api/events).
 *         Cuando el backend emite:
 *           - 'products_updated' -> La Landing Page / Catálogo actualizan sus productos.
 *           - 'orders_updated'   -> El Panel Admin actualiza la lista de pedidos y badge.
 *         También sincroniza automáticamente cuando el usuario regresa a la pestaña.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

type Listener = () => void;

class RealtimeClient {
  private es: EventSource | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private reconnectTimer: any = null;
  private isConnecting = false;

  private connect() {
    if (typeof window === 'undefined') return;
    if (this.es && (this.es.readyState === EventSource.OPEN || this.es.readyState === EventSource.CONNECTING)) {
      return;
    }

    try {
      this.isConnecting = true;
      this.es = new EventSource(`${API_BASE_URL}/events`);

      this.es.addEventListener('products_updated', () => {
        this.emit('products_updated');
      });

      this.es.addEventListener('orders_updated', () => {
        this.emit('orders_updated');
      });

      this.es.onopen = () => {
        this.isConnecting = false;
      };

      this.es.onerror = () => {
        this.isConnecting = false;
        if (this.es) {
          this.es.close();
          this.es = null;
        }
        clearTimeout(this.reconnectTimer);
        // Reconexión automática exponencial / periódica a los 4s
        this.reconnectTimer = setTimeout(() => this.connect(), 4000);
      };
    } catch (e) {
      this.isConnecting = false;
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 6000);
    }
  }

  private initWindowEvents() {
    if (typeof window === 'undefined') return;
    // Si el usuario cambia de pestaña y vuelve, sincronizamos de inmediato
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!this.es || this.es.readyState === EventSource.CLOSED) {
          this.connect();
        }
        this.emit('products_updated');
        this.emit('orders_updated');
      }
    });
  }

  /**
   * Suscribe un callback a un evento en tiempo real.
   * Retorna una función para cancelar la suscripción.
   */
  on(event: 'products_updated' | 'orders_updated', callback: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (!this.es && !this.isConnecting) {
      this.connect();
      this.initWindowEvents();
    }

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn();
      } catch (err) {
        console.error(`Error en listener de realtime [${event}]:`, err);
      }
    }
  }
}

export const realtime = new RealtimeClient();
