import { Router } from 'express';
import { ProductController } from '../controllers/productController.js';

const router = Router();

// Rutas de lectura para clientes y catálogo
router.get('/', ProductController.getProducts);
router.get('/destacados', ProductController.getFeatured);
router.get('/disponibles', ProductController.getAvailable);
// Imagen almacenada en la base de datos (debe ir antes de '/:id')
router.get('/:id/imagen', ProductController.getProductImage);
router.get('/:id', ProductController.getProductById);

// Rutas de administración (CRUD)
router.post('/', ProductController.createProduct);
router.put('/:id', ProductController.updateProduct);
router.delete('/:id', ProductController.deleteProduct);

// Presentaciones (ml) de un perfume: se agregan sin cambiar el esquema.
// El frontend las agrupa en una sola tarjeta.
router.post('/:id/variantes', ProductController.createVariant);
router.post('/:id/eliminar-variantes', ProductController.deleteVariants);
router.put('/:id/grupo', ProductController.updateGroup);

// Acciones rápidas de administración
router.patch('/:id/toggle-disponible', ProductController.toggleAvailability);
router.patch('/:id/toggle-destacado', ProductController.toggleFeatured);

export default router;
