import { prisma, isDatabaseReady } from '../config/prisma.js';
import { INITIAL_PRODUCTS, SEED_CATEGORIES, SeedProduct } from '../data/seedData.js';
import { serializeItem } from '../utils/serializer.js';

export interface ProductInput {
  nombre: string;
  marca: string;
  categoria_id?: number | bigint;
  imagen_url?: string;
  /** Tipo MIME de la imagen subida (ej. image/jpeg). null = sin imagen en BD. */
  imagen_mime?: string | null;
  /** Bytes de la imagen subida, guardados en la propia base de datos. */
  imagen_data?: Uint8Array | null;
  genero?: string;
  concentracion?: string;
  familia_olfativa?: string;
  notas_principales?: string;
  tamano_ml?: number;
  precio: number;
  stock?: number | null;
  destacado?: boolean;
  disponible?: boolean;
}

export interface ProductFilters {
  categoria_id?: number;
  destacado?: boolean;
  disponible?: boolean;
  genero?: string;
  search?: string;
}

// Estado en memoria para desarrollo / fallback sin base de datos activa
let localIdCounter = 1;
let localCategories = [...SEED_CATEGORIES];
let localProducts = INITIAL_PRODUCTS.map((p, idx) => {
  const cat = localCategories.find((c) => c.nombre === p.categoriaNombre) || localCategories[0];
  return {
    id: idx + 1,
    categoria_id: cat.id,
    usuario_id: null,
    nombre: p.nombre,
    marca: p.marca,
    imagen_url: p.imagen_url,
    genero: p.genero,
    concentracion: p.concentracion,
    familia_olfativa: p.familia_olfativa,
    notas_principales: p.notas_principales,
    tamano_ml: p.tamano_ml,
    precio: p.precio,
    stock: (p as any).stock ?? null,
    destacado: p.destacado,
    disponible: p.disponible,
    fecha_creacion: new Date().toISOString(),
    categoria: { id: cat.id, nombre: cat.nombre },
  };
});
localIdCounter = localProducts.length + 1;

export class ProductRepository {
  /**
   * Obtiene todos los productos con filtros opcionales
   */
  static async findAll(filters: ProductFilters = {}) {
    if (isDatabaseReady()) {
      const where: any = {};

      if (filters.categoria_id !== undefined) {
        where.categoria_id = BigInt(filters.categoria_id);
      }
      if (filters.destacado !== undefined) {
        where.destacado = filters.destacado;
      }
      if (filters.disponible !== undefined) {
        where.disponible = filters.disponible;
      }
      if (filters.genero) {
        where.genero = filters.genero;
      }
      if (filters.search) {
        where.OR = [
          { nombre: { contains: filters.search, mode: 'insensitive' } },
          { marca: { contains: filters.search, mode: 'insensitive' } },
          { familia_olfativa: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const products = await prisma.producto.findMany({
        where,
        // No traemos los bytes de la imagen en los listados (rendimiento);
        // `imagen_mime` basta para saber si el producto tiene imagen en BD.
        omit: { imagen_data: true },
        include: {
          categoria: true,
        },
        orderBy: {
          id: 'desc',
        },
      });

      return serializeItem(products);
    }

    // Modo local / fallback
    let list = [...localProducts];

    if (filters.categoria_id !== undefined) {
      list = list.filter((p) => Number(p.categoria_id) === Number(filters.categoria_id));
    }
    if (filters.destacado !== undefined) {
      list = list.filter((p) => p.destacado === filters.destacado);
    }
    if (filters.disponible !== undefined) {
      list = list.filter((p) => p.disponible === filters.disponible);
    }
    if (filters.genero) {
      list = list.filter((p) => p.genero?.toLowerCase() === filters.genero?.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.nombre?.toLowerCase().includes(q) ||
          p.marca?.toLowerCase().includes(q) ||
          p.familia_olfativa?.toLowerCase().includes(q) ||
          p.notas_principales?.toLowerCase().includes(q)
      );
    }

    return serializeItem(list);
  }

  /**
   * Obtiene los productos destacados (favoritos)
   */
  static async findFeatured() {
    return this.findAll({ destacado: true });
  }

  /**
   * Obtiene los productos disponibles en inventario
   */
  static async findAvailable() {
    return this.findAll({ disponible: true });
  }

  /**
   * Busca un producto por ID
   */
  static async findById(id: number | bigint) {
    if (isDatabaseReady()) {
      const product = await prisma.producto.findUnique({
        where: { id: BigInt(id) },
        omit: { imagen_data: true },
        include: { categoria: true },
      });
      return product ? serializeItem(product) : null;
    }

    const found = localProducts.find((p) => Number(p.id) === Number(id));
    return found ? serializeItem(found) : null;
  }

  /**
   * Crea un nuevo producto
   */
  static async create(data: ProductInput) {
    if (isDatabaseReady()) {
      const created = await prisma.producto.create({
        data: {
          nombre: data.nombre,
          marca: data.marca,
          categoria_id: data.categoria_id ? BigInt(data.categoria_id) : null,
          imagen_url: data.imagen_url || null,
          imagen_mime: data.imagen_mime ?? null,
          imagen_data: (data.imagen_data ?? null) as any,
          genero: data.genero || 'Unisex',
          concentracion: data.concentracion || 'Eau de Parfum',
          familia_olfativa: data.familia_olfativa || 'Amaderada',
          notas_principales: data.notas_principales || '',
          tamano_ml: data.tamano_ml || 50,
          precio: data.precio,
          stock: data.stock !== undefined ? data.stock : null,
          destacado: data.destacado ?? false,
          disponible: data.disponible ?? true,
        },
        omit: { imagen_data: true },
        include: { categoria: true },
      });
      return serializeItem(created);
    }

    const catId = data.categoria_id ? Number(data.categoria_id) : 1;
    const cat = localCategories.find((c) => c.id === catId) || localCategories[0];
    const newProduct = {
      id: localIdCounter++,
      categoria_id: cat.id,
      usuario_id: null,
      nombre: data.nombre,
      marca: data.marca,
      imagen_url: data.imagen_url || null,
      imagen_mime: data.imagen_mime ?? null,
      imagen_data: data.imagen_data ?? null,
      genero: data.genero || 'Unisex',
      concentracion: data.concentracion || 'Eau de Parfum',
      familia_olfativa: data.familia_olfativa || 'Amaderada',
      notas_principales: data.notas_principales || '',
      tamano_ml: data.tamano_ml || 50,
      precio: Number(data.precio),
      stock: data.stock !== undefined ? data.stock : null,
      destacado: data.destacado ?? false,
      disponible: data.disponible ?? true,
      fecha_creacion: new Date().toISOString(),
      categoria: { id: cat.id, nombre: cat.nombre },
    };

    localProducts.unshift(newProduct as any);
    return serializeItem(newProduct);
  }

  /**
   * Actualiza un producto existente
   */
  static async update(id: number | bigint, data: Partial<ProductInput>) {
    if (isDatabaseReady()) {
      const updateData: any = {};
      if (data.nombre !== undefined) updateData.nombre = data.nombre;
      if (data.marca !== undefined) updateData.marca = data.marca;
      if (data.categoria_id !== undefined) updateData.categoria_id = data.categoria_id ? BigInt(data.categoria_id) : null;
      if (data.imagen_url !== undefined) updateData.imagen_url = data.imagen_url;
      if (data.imagen_mime !== undefined) updateData.imagen_mime = data.imagen_mime;
      if (data.imagen_data !== undefined) updateData.imagen_data = data.imagen_data;
      if (data.genero !== undefined) updateData.genero = data.genero;
      if (data.concentracion !== undefined) updateData.concentracion = data.concentracion;
      if (data.familia_olfativa !== undefined) updateData.familia_olfativa = data.familia_olfativa;
      if (data.notas_principales !== undefined) updateData.notas_principales = data.notas_principales;
      if (data.tamano_ml !== undefined) updateData.tamano_ml = data.tamano_ml;
      if (data.precio !== undefined) updateData.precio = data.precio;
      if (data.stock !== undefined) updateData.stock = data.stock;
      if (data.destacado !== undefined) updateData.destacado = data.destacado;
      if (data.disponible !== undefined) updateData.disponible = data.disponible;

      const updated = await prisma.producto.update({
        where: { id: BigInt(id) },
        data: updateData,
        omit: { imagen_data: true },
        include: { categoria: true },
      });
      return serializeItem(updated);
    }

    const index = localProducts.findIndex((p) => Number(p.id) === Number(id));
    if (index === -1) return null;

    const current = localProducts[index];
    const catId = data.categoria_id !== undefined ? Number(data.categoria_id) : current.categoria_id;
    const cat = localCategories.find((c) => c.id === catId) || current.categoria;

    const updated = {
      ...current,
      ...data,
      precio: data.precio !== undefined ? Number(data.precio) : current.precio,
      stock: data.stock !== undefined ? data.stock : (current as any).stock ?? null,
      categoria_id: catId,
      categoria: cat,
    };

    localProducts[index] = updated;
    return serializeItem(updated);
  }

  /**
   * Elimina un producto por ID
   */
  static async delete(id: number | bigint) {
    if (isDatabaseReady()) {
      const deleted = await prisma.producto.delete({
        where: { id: BigInt(id) },
        omit: { imagen_data: true },
      });
      return serializeItem(deleted);
    }

    const index = localProducts.findIndex((p) => Number(p.id) === Number(id));
    if (index === -1) return null;

    const [deleted] = localProducts.splice(index, 1);
    return serializeItem(deleted);
  }

  /**
   * Alterna el estado de disponibilidad
   */
  static async toggleAvailability(id: number | bigint) {
    const current = await this.findById(id);
    if (!current) return null;
    return this.update(id, { disponible: !current.disponible });
  }

  /**
   * Alterna el estado de destacado (favorito)
   */
  static async toggleFeatured(id: number | bigint) {
    const current = await this.findById(id);
    if (!current) return null;
    return this.update(id, { destacado: !current.destacado });
  }

  /**
   * Obtiene la imagen almacenada en la base de datos para un producto.
   * Solo trae los campos de imagen (no el resto del producto).
   */
  static async findImage(id: number | bigint) {
    if (isDatabaseReady()) {
      const row = await prisma.producto.findUnique({
        where: { id: BigInt(id) },
        select: { imagen_data: true, imagen_mime: true, imagen_url: true },
      });
      return row;
    }

    const found = localProducts.find((p) => Number(p.id) === Number(id));
    if (!found) return null;
    return {
      imagen_data: (found as any).imagen_data ?? null,
      imagen_mime: (found as any).imagen_mime ?? null,
      imagen_url: found.imagen_url,
    };
  }

  /**
   * Devuelve todas las presentaciones (ml) de un perfume.
   *
   * No hay columnas nuevas: un perfume con varios ml son varias filas de
   * `productos` que comparten `nombre` + `marca`. Esa pareja es la clave de
   * agrupación.
   */
  static async findGroup(nombre: string, marca: string) {
    if (isDatabaseReady()) {
      const rows = await prisma.producto.findMany({
        where: { nombre, marca },
        omit: { imagen_data: true },
        include: { categoria: true },
        orderBy: { tamano_ml: 'asc' },
      });
      return serializeItem(rows);
    }

    return serializeItem(
      localProducts
        .filter((p) => p.nombre === nombre && p.marca === marca)
        .sort((a, b) => (a.tamano_ml || 0) - (b.tamano_ml || 0))
    );
  }

  /**
   * Registra una nueva presentación (ml) de un perfume ya existente.
   * Copia los campos compartidos del producto base y define los PROPIOS de la
   * presentación: `tamano_ml`, `stock` y `precio` (cada ml puede costar
   * distinto). Si no se manda precio, se usa el del producto base.
   * No crea columnas ni tablas: es otra fila en `productos`.
   * Devuelve `null` si el producto base no existe y lanza Error si ese ml ya
   * está registrado.
   */
  static async createVariant(
    baseId: number | bigint,
    variant: { tamano_ml: number; stock: number | null; precio?: number | null }
  ) {
    if (isDatabaseReady()) {
      const base = await prisma.producto.findUnique({
        where: { id: BigInt(baseId) },
        omit: { imagen_data: true },
      });
      if (!base) return null;

      const duplicate = await prisma.producto.findFirst({
        where: { nombre: base.nombre, marca: base.marca, tamano_ml: variant.tamano_ml },
        select: { id: true },
      });
      if (duplicate) {
        throw new Error(`Este perfume ya tiene una presentación de ${variant.tamano_ml} ml.`);
      }

      const created = await prisma.producto.create({
        data: {
          nombre: base.nombre,
          marca: base.marca,
          categoria_id: base.categoria_id,
          usuario_id: base.usuario_id,
          // La imagen es única por perfume: vive solo en una presentación.
          imagen_url: null,
          imagen_mime: null,
          imagen_data: null,
          genero: base.genero,
          concentracion: base.concentracion,
          familia_olfativa: base.familia_olfativa,
          notas_principales: base.notas_principales,
          tamano_ml: variant.tamano_ml,
          precio: variant.precio ?? base.precio,
          stock: variant.stock,
          destacado: base.destacado,
          disponible: base.disponible,
        },
        omit: { imagen_data: true },
        include: { categoria: true },
      });
      return serializeItem(created);
    }

    // Modo local / fallback
    const base = localProducts.find((p) => Number(p.id) === Number(baseId));
    if (!base) return null;

    const duplicate = localProducts.find(
      (p) =>
        p.nombre === base.nombre &&
        p.marca === base.marca &&
        Number(p.tamano_ml) === variant.tamano_ml
    );
    if (duplicate) {
      throw new Error(`Este perfume ya tiene una presentación de ${variant.tamano_ml} ml.`);
    }

    const created = {
      id: localIdCounter++,
      categoria_id: base.categoria_id,
      usuario_id: null,
      nombre: base.nombre,
      marca: base.marca,
      imagen_url: null,
      imagen_mime: null,
      imagen_data: null,
      genero: base.genero,
      concentracion: base.concentracion,
      familia_olfativa: base.familia_olfativa,
      notas_principales: base.notas_principales,
      tamano_ml: variant.tamano_ml,
      precio: variant.precio ?? base.precio,
      stock: variant.stock,
      destacado: base.destacado,
      disponible: base.disponible,
      fecha_creacion: new Date().toISOString(),
      categoria: base.categoria,
    };

    localProducts.unshift(created as any);
    return serializeItem(created);
  }

  /**
   * Actualiza los datos COMPARTIDOS de todas las presentaciones de un perfume
   * (nombre, marca, notas, categoría, destacado, disponible...). El `tamano_ml`,
   * el `stock` y el `precio` de cada presentación se conservan intactos.
   *
   * La imagen es única por perfume: si `imageFields` trae datos (el admin la
   * cambió), se aplica a UNA presentación y se limpia en las demás. Si va
   * vacío, no se toca ninguna imagen.
   */
  static async updateGroup(
    baseId: number | bigint,
    shared: Partial<ProductInput>,
    imageFields: {
      imagen_data?: Uint8Array | null;
      imagen_mime?: string | null;
      imagen_url?: string | null;
    }
  ) {
    const applyImage = Object.keys(imageFields).length > 0;

    if (isDatabaseReady()) {
      const base = await prisma.producto.findUnique({
        where: { id: BigInt(baseId) },
        omit: { imagen_data: true },
      });
      if (!base) return null;

      const group = await prisma.producto.findMany({
        where: { nombre: base.nombre, marca: base.marca },
        omit: { imagen_data: true },
        include: { categoria: true },
        orderBy: { tamano_ml: 'asc' },
      });
      const ids = group.map((p) => p.id);

      const sharedData: any = {};
      if (shared.nombre !== undefined) sharedData.nombre = shared.nombre;
      if (shared.marca !== undefined) sharedData.marca = shared.marca;
      if (shared.categoria_id !== undefined) {
        sharedData.categoria_id = shared.categoria_id ? BigInt(shared.categoria_id) : null;
      }
      if (shared.genero !== undefined) sharedData.genero = shared.genero;
      if (shared.concentracion !== undefined) sharedData.concentracion = shared.concentracion;
      if (shared.familia_olfativa !== undefined) sharedData.familia_olfativa = shared.familia_olfativa;
      if (shared.notas_principales !== undefined) sharedData.notas_principales = shared.notas_principales;
      // `precio`, `tamano_ml` y `stock` son PROPIOS de cada presentación (ml):
      // no se tocan aquí para no perder el precio/stock individual.
      if (shared.destacado !== undefined) sharedData.destacado = shared.destacado;
      if (shared.disponible !== undefined) sharedData.disponible = shared.disponible;

      if (Object.keys(sharedData).length > 0) {
        await prisma.producto.updateMany({ where: { id: { in: ids } }, data: sharedData });
      }

      if (applyImage) {
        const target = group.find((p) => p.imagen_mime || p.imagen_url) || group[0];
        await prisma.producto.update({
          where: { id: target.id },
          data: {
            imagen_data: (imageFields.imagen_data ?? null) as any,
            imagen_mime: imageFields.imagen_mime ?? null,
            imagen_url: imageFields.imagen_url ?? null,
          },
        });
        const others = ids.filter((v) => v !== target.id);
        if (others.length > 0) {
          await prisma.producto.updateMany({
            where: { id: { in: others } },
            data: { imagen_data: null, imagen_mime: null, imagen_url: null },
          });
        }
      }

      const refreshed = await prisma.producto.findMany({
        where: { id: { in: ids } },
        omit: { imagen_data: true },
        include: { categoria: true },
        orderBy: { tamano_ml: 'asc' },
      });
      return serializeItem(refreshed);
    }

    // Modo local / fallback
    const base = localProducts.find((p) => Number(p.id) === Number(baseId));
    if (!base) return null;

    const group = localProducts.filter(
      (p) => p.nombre === base.nombre && p.marca === base.marca
    );

    group.forEach((p: any) => {
      if (shared.nombre !== undefined) p.nombre = shared.nombre;
      if (shared.marca !== undefined) p.marca = shared.marca;
      if (shared.categoria_id !== undefined) {
        p.categoria_id = shared.categoria_id ? Number(shared.categoria_id) : null;
      }
      if (shared.genero !== undefined) p.genero = shared.genero;
      if (shared.concentracion !== undefined) p.concentracion = shared.concentracion;
      if (shared.familia_olfativa !== undefined) p.familia_olfativa = shared.familia_olfativa;
      if (shared.notas_principales !== undefined) p.notas_principales = shared.notas_principales;
      // Precio, ml y stock son propios de cada presentación: no se comparten.
      if (shared.destacado !== undefined) p.destacado = shared.destacado;
      if (shared.disponible !== undefined) p.disponible = shared.disponible;
    });

    if (applyImage) {
      const target = group.find((p: any) => p.imagen_mime || p.imagen_url) || group[0];
      group.forEach((p: any) => {
        if (p === target) {
          p.imagen_data = imageFields.imagen_data ?? null;
          p.imagen_mime = imageFields.imagen_mime ?? null;
          p.imagen_url = imageFields.imagen_url ?? null;
        } else {
          p.imagen_data = null;
          p.imagen_mime = null;
          p.imagen_url = null;
        }
      });
    }

    return serializeItem(group);
  }

  /**
   * Elimina una o varias presentaciones (ml) de un perfume.
   *
   * Si la imagen del perfume vive en una fila que se va a eliminar y quedan
   * otras presentaciones, la transfiere a una que se conserva para no perderla.
   * Devuelve `{ deleted, remaining }` o `null` si el producto no existe.
   */
  static async deleteVariants(baseId: number | bigint, ids: Array<number | bigint>) {
    const idSet = new Set(ids.map((v) => Number(v)));

    if (isDatabaseReady()) {
      const base = await prisma.producto.findUnique({
        where: { id: BigInt(baseId) },
        omit: { imagen_data: true },
      });
      if (!base) return null;

      const group = await prisma.producto.findMany({
        where: { nombre: base.nombre, marca: base.marca },
        omit: { imagen_data: true },
      });

      const toDelete = group.filter((p) => idSet.has(Number(p.id)));
      if (toDelete.length === 0) {
        throw new Error('No se seleccionó ninguna presentación para eliminar.');
      }
      const remaining = group.filter((p) => !idSet.has(Number(p.id)));

      if (remaining.length > 0 && !remaining.some((p) => p.imagen_mime)) {
        const holder = toDelete.find((p) => p.imagen_mime);
        if (holder) {
          const src = await prisma.producto.findUnique({
            where: { id: holder.id },
            select: { imagen_data: true, imagen_mime: true },
          });
          await prisma.producto.update({
            where: { id: remaining[0].id },
            data: {
              imagen_data: (src?.imagen_data ?? null) as any,
              imagen_mime: src?.imagen_mime ?? null,
              imagen_url: null,
            },
          });
        }
      }

      const result = await prisma.producto.deleteMany({
        where: { id: { in: toDelete.map((p) => p.id) } },
      });
      return { deleted: result.count, remaining: remaining.length };
    }

    // Modo local / fallback
    const base = localProducts.find((p) => Number(p.id) === Number(baseId));
    if (!base) return null;

    const group = localProducts.filter(
      (p) => p.nombre === base.nombre && p.marca === base.marca
    );
    const toDelete = group.filter((p) => idSet.has(Number(p.id)));
    if (toDelete.length === 0) {
      throw new Error('No se seleccionó ninguna presentación para eliminar.');
    }
    const remaining = group.filter((p) => !idSet.has(Number(p.id)));

    if (remaining.length > 0 && !remaining.some((p: any) => p.imagen_mime)) {
      const holder: any = toDelete.find((p: any) => p.imagen_mime);
      if (holder) {
        (remaining[0] as any).imagen_data = holder.imagen_data;
        (remaining[0] as any).imagen_mime = holder.imagen_mime;
        (remaining[0] as any).imagen_url = null;
      }
    }

    localProducts = localProducts.filter((p) => !idSet.has(Number(p.id)));
    return { deleted: toDelete.length, remaining: remaining.length };
  }

  /**
   * Lista todas las categorías
   */
  static async findCategories() {
    if (isDatabaseReady()) {
      const categories = await prisma.categoria.findMany({
        orderBy: { id: 'asc' },
      });
      return serializeItem(categories);
    }
    return serializeItem(localCategories);
  }
}
