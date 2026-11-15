/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: backend/src/controllers/orderController.ts
 * QUÉ ES: Endpoints HTTP de los pedidos (los que llegan por WhatsApp).
 * DÓNDE SE USA: backend/src/routes/orderRoutes.ts
 * RUTAS:
 *   GET    /api/pedidos              → lista todos los pedidos
 *   POST   /api/pedidos              → registra un pedido nuevo (pendiente)
 *   PATCH  /api/pedidos/:id/confirmar → confirma y descuenta stock
 *   PATCH  /api/pedidos/:id/cancelar  → cancela el pedido
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express';
import { OrderRepository } from '../repositories/orderRepository.js';
import { realtimeHub } from '../utils/realtime.js';

export class OrderController {
  /**
   * Normaliza un pedido de la base de datos al contrato que consume el
   * frontend (nombres en camelCase, números ya convertidos).
   */
  private static toApiOrder(order: any) {
    if (!order) return order;
    return {
      id: order.id,
      codigo: order.codigo,
      items: (order.items || []).map((it: any) => ({
        perfumeId: it.producto_id != null ? String(it.producto_id) : '',
        variantId: it.producto_id != null ? String(it.producto_id) : '',
        perfumeName: it.nombre ?? '',
        house: it.marca ?? '',
        image: it.imagen_url ?? '',
        sizeMl: it.tamano_ml ?? null,
        priceDOP: Number(it.precio ?? 0),
        quantity: it.cantidad ?? 0,
        subtotal: Number(it.subtotal ?? 0),
      })),
      subtotal: Number(order.subtotal ?? 0),
      discountAmount: Number(order.descuento ?? 0),
      shippingCost: Number(order.envio ?? 0),
      total: Number(order.total ?? 0),
      status: order.estado ?? 'pendiente',
      origin: order.origen ?? 'whatsapp',
      createdAt: order.fecha_creacion ?? null,
      confirmedAt: order.fecha_confirmacion ?? null,
    };
  }

  /**
   * POST /api/pedidos
   * Registra un pedido enviado desde la tienda (normalmente por WhatsApp).
   */
  static async createOrder(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const rawItems = Array.isArray(body.items) ? body.items : [];

      const order = await OrderRepository.create({
        codigo: body.codigo,
        subtotal: body.subtotal,
        descuento: body.discountAmount,
        envio: body.shippingCost,
        total: body.total,
        origen: body.origin,
        items: rawItems.map((it: any) => ({
          producto_id:
            it.variantId ?? it.producto_id ?? it.productId ?? it.perfumeId ?? null,
          nombre: it.perfumeName ?? it.nombre ?? 'Perfume',
          marca: it.house ?? it.marca ?? null,
          imagen_url: it.image ?? it.imagen_url ?? null,
          tamano_ml: it.sizeMl ?? it.tamano_ml ?? null,
          precio: it.priceDOP ?? it.precio ?? 0,
          cantidad: it.quantity ?? it.cantidad ?? 1,
        })),
      });

      res.status(201).json({
        success: true,
        message: 'Pedido registrado correctamente.',
        data: OrderController.toApiOrder(order),
      });

      // Notifica al Panel Admin en tiempo real
      realtimeHub.broadcast('orders_updated');
    } catch (error: any) {
      console.error('Error al registrar el pedido:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al registrar el pedido.',
      });
    }
  }

  /**
   * GET /api/pedidos
   * Lista los pedidos para el Panel Admin (más recientes primero).
   */
  static async getOrders(_req: Request, res: Response) {
    try {
      const orders = await OrderRepository.findAll();
      res.json({
        success: true,
        count: orders.length,
        data: orders.map((o: any) => OrderController.toApiOrder(o)),
      });
    } catch (error: any) {
      console.error('Error al obtener los pedidos:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los pedidos.',
      });
    }
  }

  /**
   * PATCH /api/pedidos/:id/confirmar
   * Confirma el pedido y descuenta el stock de cada presentación (ml).
   */
  static async confirmOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await OrderRepository.confirm(id);
      res.json({
        success: true,
        message: 'Pedido confirmado. El stock se actualizó automáticamente.',
        data: OrderController.toApiOrder(order),
      });

      // Notifica al Panel Admin (pedido confirmado) y a la Tienda (stock actualizado)
      realtimeHub.broadcast('orders_updated');
      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al confirmar el pedido:', error);
      const notFound = /no encontrado/i.test(error.message || '');
      res.status(notFound ? 404 : 500).json({
        success: false,
        message: error.message || 'Error al confirmar el pedido.',
      });
    }
  }

  /**
   * PATCH /api/pedidos/:id/cancelar
   * Cancela el pedido (no modifica el stock).
   */
  static async cancelOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await OrderRepository.cancel(id);
      res.json({
        success: true,
        message: 'Pedido cancelado.',
        data: OrderController.toApiOrder(order),
      });

      // Notifica al Panel Admin en tiempo real
      realtimeHub.broadcast('orders_updated');
    } catch (error: any) {
      console.error('Error al cancelar el pedido:', error);
      const notFound = /no encontrado|record to update/i.test(error.message || '');
      res.status(notFound ? 404 : 500).json({
        success: false,
        message: error.message || 'Error al cancelar el pedido.',
      });
    }
  }
}
