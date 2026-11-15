import { Request, Response } from 'express';
import { ProductRepository } from '../repositories/productRepository.js';
import { parseImagePayload, downloadImage } from '../utils/image.js';
import { realtimeHub } from '../utils/realtime.js';

export class ProductController {
  /**
   * Añade a la respuesta la URL pública de la imagen.
   * - Si el producto tiene imagen guardada en la BD → apunta al endpoint
   *   /api/productos/:id/imagen.
   * - Si no, usa la URL externa almacenada (imagen_url).
   * También expone `imagen_externa_url` (valor crudo) y `has_db_image`.
   */
  private static decorate(product: any, req: Request) {
    if (!product) return product;
    const hasDbImage = Boolean(product.imagen_mime);
    const external = product.imagen_url || null;
    const resolved = hasDbImage
      ? `${req.protocol}://${req.get('host')}/api/productos/${product.id}/imagen`
      : external;

    return {
      ...product,
      imagen_url: resolved,
      imagen_externa_url: external,
      has_db_image: hasDbImage,
    };
  }

  /**
   * Resuelve la imagen a guardar a partir del body.
   *
   * Prioridad:
   *   1. Archivo subido (imagen_base64) → se guardan sus bytes.
   *   2. URL externa (imagen_url) → el backend la DESCARGA y guarda sus bytes.
   *   3. remove_imagen = true → se borra la imagen.
   *
   * En los casos 1 y 2 la imagen termina guardada en la base de datos, por lo
   * que se limpia `imagen_url` (ya no se depende de la web externa).
   * Lanza un Error con mensaje legible si la imagen no es válida.
   */
  private static async resolveImage(body: any): Promise<{
    imagen_data?: Uint8Array | null;
    imagen_mime?: string | null;
    imagen_url?: string | null;
  }> {
    // 1) Archivo subido desde el equipo (tiene prioridad).
    const base64 = body?.imagen_base64;
    if (typeof base64 === 'string' && base64.trim() !== '') {
      const parsed = parseImagePayload(base64, body?.imagen_mime);
      if (parsed) {
        return { imagen_data: parsed.data, imagen_mime: parsed.mime, imagen_url: null };
      }
    }

    // 2) URL externa: se descarga y se guarda en la base de datos.
    const url = typeof body?.imagen_url === 'string' ? body.imagen_url.trim() : '';
    if (url) {
      if (/^https?:\/\//i.test(url)) {
        const parsed = await downloadImage(url);
        return { imagen_data: parsed.data, imagen_mime: parsed.mime, imagen_url: null };
      }
      // Ruta relativa antigua (no descargable): se conserva como texto.
      return { imagen_url: url };
    }

    // 3) Quitar la imagen.
    if (body?.remove_imagen === true) {
      return { imagen_data: null, imagen_mime: null, imagen_url: null };
    }

    return {};
  }

  /**
   * GET /api/productos
   * Obtiene la lista de perfumes con soporte para filtros
   */
  static async getProducts(req: Request, res: Response) {
    try {
      const { categoria_id, destacado, disponible, genero, search } = req.query;

      const filters: any = {};
      if (categoria_id) filters.categoria_id = parseInt(categoria_id as string, 10);
      if (destacado !== undefined) filters.destacado = destacado === 'true';
      if (disponible !== undefined) filters.disponible = disponible === 'true';
      if (genero) filters.genero = genero as string;
      if (search) filters.search = search as string;

      const products = await ProductRepository.findAll(filters);
      res.json({
        success: true,
        count: products.length,
        data: products.map((p: any) => ProductController.decorate(p, req)),
      });
    } catch (error: any) {
      console.error('Error al obtener productos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los productos',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/productos/destacados
   * Obtiene perfumes favoritos/destacados para el cliente
   */
  static async getFeatured(req: Request, res: Response) {
    try {
      const products = await ProductRepository.findFeatured();
      res.json({
        success: true,
        count: products.length,
        data: products.map((p: any) => ProductController.decorate(p, req)),
      });
    } catch (error: any) {
      console.error('Error al obtener productos destacados:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los productos destacados',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/productos/disponibles
   * Obtiene perfumes con disponibilidad inmediata
   */
  static async getAvailable(req: Request, res: Response) {
    try {
      const products = await ProductRepository.findAvailable();
      res.json({
        success: true,
        count: products.length,
        data: products.map((p: any) => ProductController.decorate(p, req)),
      });
    } catch (error: any) {
      console.error('Error al obtener productos disponibles:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los productos disponibles',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/productos/:id
   * Obtiene un perfume por su identificador
   */
  static async getProductById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'El ID proporcionado no es válido',
        });
      }

      const product = await ProductRepository.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado',
        });
      }

      res.json({
        success: true,
        data: ProductController.decorate(product, req),
      });
    } catch (error: any) {
      console.error('Error al obtener el producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el producto',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/productos/:id/imagen
   * Sirve la imagen guardada en la base de datos para un producto.
   */
  static async getProductImage(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID no válido' });
      }

      const row: any = await ProductRepository.findImage(id);
      if (!row) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }

      const raw = row.imagen_data;
      if (!raw || raw.length === 0) {
        // Sin imagen en la BD: si hay una URL externa, redirigimos a ella.
        if (row.imagen_url) return res.redirect(row.imagen_url);
        return res.status(404).json({ success: false, message: 'El producto no tiene imagen' });
      }

      const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      res.setHeader('Content-Type', row.imagen_mime || 'image/jpeg');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (error: any) {
      console.error('Error al servir la imagen del producto:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener la imagen',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/productos
   * Crea un nuevo perfume (Panel Administrador)
   */
  static async createProduct(req: Request, res: Response) {
    try {
      const {
        nombre,
        marca,
        categoria_id,
        imagen_url,
        genero,
        concentracion,
        familia_olfativa,
        notas_principales,
        tamano_ml,
        precio,
        stock,
        destacado,
        disponible,
      } = req.body;

      if (!nombre || !marca || precio === undefined || precio === null) {
        return res.status(400).json({
          success: false,
          message: 'Los campos nombre, marca y precio son requeridos.',
        });
      }

      // Imagen del perfume: archivo subido o URL externa (se guarda en la BD).
      let imageFields: {
        imagen_data?: Uint8Array | null;
        imagen_mime?: string | null;
        imagen_url?: string | null;
      } = {};
      try {
        imageFields = await ProductController.resolveImage(req.body);
      } catch (imgErr: any) {
        return res.status(400).json({ success: false, message: imgErr.message });
      }

      const newProduct = await ProductRepository.create({
        nombre,
        marca,
        categoria_id: categoria_id ? parseInt(categoria_id, 10) : undefined,
        imagen_url,
        genero,
        concentracion,
        familia_olfativa,
        notas_principales,
        tamano_ml: tamano_ml ? parseInt(tamano_ml, 10) : undefined,
        precio: parseFloat(precio),
        stock: stock !== undefined && stock !== null && stock !== '' ? parseInt(stock, 10) : null,
        destacado: destacado !== undefined ? Boolean(destacado) : false,
        disponible: disponible !== undefined ? Boolean(disponible) : true,
        ...imageFields,
      });

      res.status(201).json({
        success: true,
        message: 'Perfume creado exitosamente',
        data: ProductController.decorate(newProduct, req),
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al crear el perfume:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar el producto',
        error: error.message,
      });
    }
  }

  /**
   * PUT /api/productos/:id
   * Actualiza los datos de un perfume existente (Panel Administrador)
   */
  static async updateProduct(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'El ID no es válido',
        });
      }

      const existing = await ProductRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado para actualizar',
        });
      }

      const body = { ...req.body };
      if (body.categoria_id !== undefined && body.categoria_id !== null && body.categoria_id !== '') {
        body.categoria_id = parseInt(body.categoria_id, 10);
      }
      if (body.tamano_ml !== undefined && body.tamano_ml !== null && body.tamano_ml !== '') {
        body.tamano_ml = parseInt(body.tamano_ml, 10);
      }
      if (body.precio !== undefined && body.precio !== null && body.precio !== '') {
        body.precio = parseFloat(body.precio);
      }
      if (body.stock !== undefined) {
        body.stock = body.stock === null || body.stock === '' ? null : parseInt(body.stock, 10);
      }

      // Imagen del perfume (reemplaza, descarga desde URL o quita la actual).
      try {
        Object.assign(body, await ProductController.resolveImage(req.body));
      } catch (imgErr: any) {
        return res.status(400).json({ success: false, message: imgErr.message });
      }

      const updated = await ProductRepository.update(id, body);
      res.json({
        success: true,
        message: 'Perfume actualizado exitosamente',
        data: ProductController.decorate(updated, req),
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al actualizar producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar el producto',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/productos/:id
   * Elimina un perfume (Panel Administrador)
   */
  static async deleteProduct(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'El ID no es válido',
        });
      }

      const existing = await ProductRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado para eliminar',
        });
      }

      const deleted = await ProductRepository.delete(id);
      res.json({
        success: true,
        message: 'Perfume eliminado exitosamente del catálogo',
        data: deleted,
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al eliminar producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar el producto',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/productos/:id/variantes
   * Registra una nueva presentación (ml) de un perfume ya existente.
   * Solo recibe `tamano_ml` y `stock`: el resto de campos (precio, notas,
   * categoría, imagen...) se copian del perfume base. No crea una tarjeta
   * nueva: el frontend agrupa los ml en una sola tarjeta.
   */
  static async createVariant(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'El ID no es válido' });
      }

      const ml = parseInt(req.body?.tamano_ml, 10);
      if (!ml || ml <= 0) {
        return res.status(400).json({ success: false, message: 'Indica un tamaño en ml válido.' });
      }

      const { stock, precio } = req.body;
      const parsedPrecio =
        precio !== undefined && precio !== null && precio !== '' ? parseFloat(precio) : null;
      if (parsedPrecio !== null && (isNaN(parsedPrecio) || parsedPrecio < 0)) {
        return res.status(400).json({ success: false, message: 'Indica un precio válido.' });
      }

      const created = await ProductRepository.createVariant(id, {
        tamano_ml: ml,
        stock: stock !== undefined && stock !== null && stock !== '' ? parseInt(stock, 10) : null,
        precio: parsedPrecio,
      });

      if (!created) {
        return res.status(404).json({ success: false, message: 'Perfume no encontrado' });
      }

      res.status(201).json({
        success: true,
        message: `Presentación de ${ml} ml agregada exitosamente`,
        data: ProductController.decorate(created, req),
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al crear presentación:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error al agregar la presentación',
      });
    }
  }

  /**
   * PUT /api/productos/:id/grupo
   * Actualiza los datos compartidos de TODAS las presentaciones (ml) de un
   * perfume: nombre, marca, precio, notas, categoría, imagen, etc.
   * El ml y el stock de cada presentación se conservan.
   */
  static async updateGroup(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'El ID no es válido' });
      }

      const existing = await ProductRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado para actualizar',
        });
      }

      const body = { ...req.body };
      if (body.categoria_id !== undefined && body.categoria_id !== null && body.categoria_id !== '') {
        body.categoria_id = parseInt(body.categoria_id, 10);
      }
      if (body.precio !== undefined && body.precio !== null && body.precio !== '') {
        body.precio = parseFloat(body.precio);
      }

      // La imagen solo se toca si el admin la cambió (archivo, URL o quitar).
      let imageFields: {
        imagen_data?: Uint8Array | null;
        imagen_mime?: string | null;
        imagen_url?: string | null;
      } = {};
      try {
        imageFields = await ProductController.resolveImage(req.body);
      } catch (imgErr: any) {
        return res.status(400).json({ success: false, message: imgErr.message });
      }

      const updated = await ProductRepository.updateGroup(id, body, imageFields);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Perfume no encontrado' });
      }

      res.json({
        success: true,
        message: 'Perfume actualizado exitosamente',
        data: Array.isArray(updated) ? updated.map((p) => ProductController.decorate(p, req)) : updated,
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al actualizar el grupo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar el producto',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/productos/:id/eliminar-variantes
   * Elimina las presentaciones (ml) indicadas en `ids`. Si la imagen del
   * perfume vive en una presentación que se borra y quedan otras, se transfiere
   * para no perderla.
   */
  static async deleteVariants(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'El ID no es válido' });
      }

      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = rawIds
        .map((v: any) => parseInt(v, 10))
        .filter((v: number) => !isNaN(v));
      if (ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Selecciona al menos una presentación para eliminar.',
        });
      }

      const result = await ProductRepository.deleteVariants(id, ids);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Perfume no encontrado' });
      }

      res.json({
        success: true,
        message:
          result.remaining > 0
            ? `Se eliminaron ${result.deleted} presentación(es) del perfume.`
            : 'Perfume eliminado exitosamente del catálogo',
        data: result,
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al eliminar presentaciones:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error al eliminar las presentaciones',
      });
    }
  }

  /**
   * PATCH /api/productos/:id/toggle-disponible
   * Alterna rápidamente el estado disponible / agotado
   */
  static async toggleAvailability(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID no válido' });
      }

      const updated = await ProductRepository.toggleAvailability(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }

      res.json({
        success: true,
        message: `Estado de disponibilidad cambiado a: ${updated.disponible ? 'Disponible' : 'Agotado'}`,
        data: updated,
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al alternar disponibilidad:', error);
      res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
  }

  /**
   * PATCH /api/productos/:id/toggle-destacado
   * Alterna rápidamente el estado destacado (favorito)
   */
  static async toggleFeatured(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID no válido' });
      }

      const updated = await ProductRepository.toggleFeatured(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }

      res.json({
        success: true,
        message: `Producto ${updated.destacado ? 'marcado como Destacado/Favorito' : 'retirado de Destacados'}`,
        data: updated,
      });

      realtimeHub.broadcast('products_updated');
    } catch (error: any) {
      console.error('Error al alternar destacado:', error);
      res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
  }
}
