/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/services/orderService.ts
 * QUÉ ES: Comunicación con el backend para los PEDIDOS.
 *         El cliente crea el pedido al enviarlo por WhatsApp; el Panel Admin
 *         los lista y los confirma (lo que descuenta el stock solo).
 * DÓNDE SE USA: CartDrawer (crear), OrderConfirmationModal (crear) y
 *               AdminOrders (listar / confirmar / cancelar).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Order, OrderItem } from '../types';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

export interface CreateOrderPayload {
  codigo?: string;
  items: OrderItem[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  shippingCost?: number;
  total: number;
  couponCode?: string;
  /** Origen del pedido (por ahora siempre 'whatsapp'). */
  origin?: string;
}

/** Normaliza un pedido del backend al contrato `Order` del frontend. */
function normalizeOrder(raw: any): Order {
  return {
    id: String(raw?.id ?? ''),
    codigo: raw?.codigo ?? undefined,
    items: Array.isArray(raw?.items)
      ? raw.items.map((it: any) => ({
          perfumeId: String(it.perfumeId ?? ''),
          variantId: it.variantId != null ? String(it.variantId) : undefined,
          perfumeName: it.perfumeName ?? '',
          house: it.house ?? '',
          image: it.image ?? '',
          sizeMl: Number(it.sizeMl ?? 0),
          priceDOP: Number(it.priceDOP ?? 0),
          quantity: Number(it.quantity ?? 0),
          subtotal: Number(it.subtotal ?? 0),
        }))
      : [],
    subtotal: Number(raw?.subtotal ?? 0),
    discountPercent: Number(raw?.discountPercent ?? 0),
    discountAmount: Number(raw?.discountAmount ?? 0),
    shippingCost: Number(raw?.shippingCost ?? 0),
    total: Number(raw?.total ?? 0),
    couponCode: raw?.couponCode ?? undefined,
    status: raw?.status ?? 'pendiente',
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    confirmedAt: raw?.confirmedAt ?? null,
  };
}

export const orderService = {
  /**
   * Registra un pedido nuevo (estado `pendiente`) para que aparezca en el
   * Panel Admin. Se llama al enviar el pedido por WhatsApp.
   */
  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo registrar el pedido.');
    }
    const json = await res.json();
    return normalizeOrder(json.data);
  },

  /** Lista todos los pedidos (más recientes primero). */
  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE_URL}/pedidos`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudieron cargar los pedidos.');
    }
    const json = await res.json();
    return (json.data || []).map(normalizeOrder);
  },

  /** Confirma un pedido: el backend descuenta el stock automáticamente. */
  async confirmOrder(id: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/pedidos/${id}/confirmar`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo confirmar el pedido.');
    }
    const json = await res.json();
    return normalizeOrder(json.data);
  },

  /** Cancela un pedido (no modifica el stock). */
  async cancelOrder(id: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/pedidos/${id}/cancelar`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo cancelar el pedido.');
    }
    const json = await res.json();
    return normalizeOrder(json.data);
  },
};
