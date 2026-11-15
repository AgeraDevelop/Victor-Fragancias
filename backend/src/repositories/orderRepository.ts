/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: backend/src/repositories/orderRepository.ts
 * QUÉ ES: Acceso a datos de los PEDIDOS enviados por WhatsApp.
 *         Crear, listar, confirmar (descontando stock) y cancelar.
 * DÓNDE SE USA: backend/src/controllers/orderController.ts
 * QUÉ TOCAR:
 *   - Cambiar cómo se descuenta el stock → `confirm`.
 *   - Agregar campos al pedido → `OrderInput` + `create`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma, isDatabaseReady } from '../config/prisma.js';
import { serializeItem } from '../utils/serializer.js';

export interface OrderItemInput {
  /** Id de la fila real de `productos` (la presentación ml concreta). */
  producto_id?: number | bigint | null;
  nombre: string;
  marca?: string | null;
  imagen_url?: string | null;
  tamano_ml?: number | null;
  precio: number;
  cantidad: number;
}

export interface OrderInput {
  codigo?: string | null;
  subtotal?: number;
  descuento?: number;
  envio?: number;
  total?: number;
  origen?: string | null;
  items: OrderItemInput[];
}

/** Convierte a entero positivo o devuelve null. */
const toBigIntOrNull = (value: unknown): bigint | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.trunc(n));
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export class OrderRepository {
  /**
   * Crea un pedido con sus ítems. El pedido nace en estado `pendiente`.
   * El código lo genera el frontend para poder relacionarlo con el mensaje
   * de WhatsApp; si no llega, se genera uno aquí.
   */
  static async create(data: OrderInput) {
    if (!isDatabaseReady()) {
      throw new Error(
        'La base de datos no está disponible; el pedido no se pudo registrar.'
      );
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      throw new Error('El pedido no tiene perfumes.');
    }

    const codigo =
      data.codigo && String(data.codigo).trim() !== ''
        ? String(data.codigo).trim()
        : `DV-${Date.now().toString().slice(-6)}-${Math.floor(
            Math.random() * 900 + 100
          )}`;

    const created = await prisma.pedido.create({
      data: {
        codigo,
        subtotal: toNumber(data.subtotal),
        descuento: toNumber(data.descuento),
        envio: toNumber(data.envio),
        total: toNumber(data.total),
        estado: 'pendiente',
        origen: data.origen || 'whatsapp',
        items: {
          create: items.map((item) => {
            const precio = toNumber(item.precio);
            const cantidad = Math.max(1, Math.trunc(toNumber(item.cantidad, 1)));
            return {
              producto_id: toBigIntOrNull(item.producto_id),
              nombre: item.nombre || 'Perfume',
              marca: item.marca || null,
              imagen_url: item.imagen_url || null,
              tamano_ml:
                item.tamano_ml !== null && item.tamano_ml !== undefined
                  ? Math.trunc(Number(item.tamano_ml))
                  : null,
              precio,
              cantidad,
              subtotal: precio * cantidad,
            };
          }),
        },
      },
      include: { items: true },
    });

    return serializeItem(created);
  }

  /** Lista todos los pedidos (más recientes primero). */
  static async findAll() {
    if (!isDatabaseReady()) {
      throw new Error('La base de datos no está disponible.');
    }
    const orders = await prisma.pedido.findMany({
      include: { items: true },
      orderBy: { fecha_creacion: 'desc' },
    });
    return serializeItem(orders);
  }

  static async findById(id: string) {
    if (!isDatabaseReady()) {
      throw new Error('La base de datos no está disponible.');
    }
    const order = await prisma.pedido.findUnique({
      where: { id },
      include: { items: true },
    });
    return order ? serializeItem(order) : null;
  }

  /**
   * Confirma un pedido y DESCUENTA el stock de cada presentación (ml).
   *
   * Reglas:
   *   - `stock = null` → sin límite: no se descuenta.
   *   - `stock` numérico → se resta la cantidad pedida, nunca por debajo de 0.
   *   - Es idempotente: si el pedido ya estaba confirmado, no vuelve a restar.
   *
   * Todo ocurre en una transacción para que no queden descuadres.
   */
  static async confirm(id: string) {
    if (!isDatabaseReady()) {
      throw new Error('La base de datos no está disponible.');
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.pedido.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new Error('Pedido no encontrado.');

      // Ya confirmado: no descontar dos veces.
      if (order.estado === 'confirmado') {
        return serializeItem(order);
      }

      for (const item of order.items) {
        if (!item.producto_id) continue;
        const product = await tx.producto.findUnique({
          where: { id: item.producto_id },
          select: { id: true, stock: true },
        });
        if (!product) continue;
        // stock null = sin límite definido → no se descuenta.
        if (product.stock === null || product.stock === undefined) continue;

        const nuevo = Math.max(0, product.stock - (item.cantidad || 0));
        await tx.producto.update({
          where: { id: product.id },
          data: { stock: nuevo },
        });
      }

      const updated = await tx.pedido.update({
        where: { id },
        data: { estado: 'confirmado', fecha_confirmacion: new Date() },
        include: { items: true },
      });

      return serializeItem(updated);
    });
  }

  /** Marca un pedido como cancelado (no toca el stock). */
  static async cancel(id: string) {
    if (!isDatabaseReady()) {
      throw new Error('La base de datos no está disponible.');
    }
    const updated = await prisma.pedido.update({
      where: { id },
      data: { estado: 'cancelado' },
      include: { items: true },
    });
    return serializeItem(updated);
  }
}
