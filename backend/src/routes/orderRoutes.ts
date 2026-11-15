import { Router } from 'express';
import { OrderController } from '../controllers/orderController.js';

const router = Router();

// Pedidos enviados desde la tienda (normalmente por WhatsApp).
router.get('/', OrderController.getOrders);
router.post('/', OrderController.createOrder);

// Confirmar descuenta el stock automáticamente; cancelar no lo toca.
router.patch('/:id/confirmar', OrderController.confirmOrder);
router.patch('/:id/cancelar', OrderController.cancelOrder);

export default router;
