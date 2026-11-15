/**
 * Servicio de comunicación Frontend <-> Backend para el catálogo de perfumes
 */

import { Perfume, PerfumeSize, Gender, OlfactoryFamily, Concentration } from '../types';
import { PERFUMES_DATA } from '../data/perfumes';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

export interface BackendProduct {
  id: number;
  nombre: string;
  marca: string;
  categoria_id?: number | null;
  categoria?: { id: number; nombre: string } | null;
  usuario_id?: string | null;
  imagen_url?: string | null;
  /** Indica si la imagen está guardada como bytes en la base de datos. */
  has_db_image?: boolean;
  /** URL externa cruda almacenada en `imagen_url` (sin resolver al endpoint). */
  imagen_externa_url?: string | null;
  genero?: string | null;
  concentracion?: string | null;
  familia_olfativa?: string | null;
  notas_principales?: string | null;
  tamano_ml?: number | null;
  precio: number;
  stock?: number | null;
  destacado?: boolean;
  disponible?: boolean;
  fecha_creacion?: string;
}

export interface BackendCategory {
  id: number;
  nombre: string;
}

export interface ProductFormData {
  nombre: string;
  marca: string;
  categoria_id?: number;
  /** URL externa opcional (si no se sube archivo). */
  imagen_url?: string;
  /** Imagen subida como base64 o data URL; se guarda en la base de datos. */
  imagen_base64?: string | null;
  /** Tipo MIME de la imagen subida (image/jpeg, image/png, ...). */
  imagen_mime?: string | null;
  /** Enviar en `true` para borrar la imagen guardada en la base de datos. */
  remove_imagen?: boolean;
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

/**
 * Convierte un producto del Backend (schema Prisma) al contrato de datos `Perfume` del Frontend
 */
export function backendProductToPerfume(bp: BackendProduct): Perfume {
  // Buscar si ya existía en PERFUMES_DATA para enriquecer notas u opciones si aplica
  const match = PERFUMES_DATA.find(
    (p) =>
      p.name.toLowerCase() === bp.nombre.toLowerCase() ||
      p.id === String(bp.id) ||
      (bp.id && String(bp.id) === p.id)
  );

  const notesList = bp.notas_principales
    ? bp.notas_principales.split(',').map((n) => n.trim()).filter(Boolean)
    : match?.topNotes || ['Aromas Exclusivos'];

  const categoryName = (bp.categoria?.nombre || match?.category || 'Nicho') as 'Nicho' | 'Diseñador';

  return {
    id: String(bp.id),
    name: bp.nombre,
    house: bp.marca,
    gender: (bp.genero || match?.gender || 'Unisex') as Gender,
    category: categoryName === 'Diseñador' ? 'Diseñador' : 'Nicho',
    family: (bp.familia_olfativa || match?.family || 'Amaderada') as OlfactoryFamily,
    concentration: (bp.concentracion || match?.concentration || 'Eau de Parfum') as Concentration,
    description:
      match?.description ||
      `Fragancia de alta distinción creada por ${bp.marca}. Notas olfativas: ${bp.notas_principales || bp.familia_olfativa}.`,
    sizes: [
      {
        ml: bp.tamano_ml || 50,
        priceDOP: Number(bp.precio),
        inStock: bp.disponible ?? true,
      },
      ...(match && match.sizes.length > 1
        ? match.sizes.slice(1).map((s) => ({
            ...s,
            inStock: bp.disponible ?? true,
          }))
        : []),
    ],
    image: bp.imagen_url || match?.image || '/assets/images/hero_luxury_perfume_1793299734093.jpg',
    // Solo cuenta como imagen real si el backend trae una URL del catálogo
    // administrado (imagen en BD o URL externa). El respaldo no cuenta.
    hasImage: Boolean(bp.imagen_url),
    topNotes: notesList.slice(0, 3),
    heartNotes: match?.heartNotes || notesList.slice(1, 4),
    baseNotes: match?.baseNotes || [bp.familia_olfativa || 'Maderas Nobles', 'Ámbar Cálido'],
    longevity: match?.longevity || '12+ horas',
    sillage: match?.sillage || 'Pronunciada',
    bestOccasion: match?.bestOccasion || 'Ocasiones especiales y uso cotidiano de distinción',
    rating: match?.rating || 4.9,
    reviewsCount: match?.reviewsCount || 24,
    isBestseller: bp.destacado ?? match?.isBestseller ?? false,
    isNew: match?.isNew ?? false,
    batchCodeExample: match?.batchCodeExample || `DV-${bp.id}-2026`,
    stock: bp.stock ?? null,
  };
}

// ── Agrupación de presentaciones (ml) ────────────────────────────────────────
// Un perfume con varios ml son varias filas de `productos` que comparten
// nombre + marca. Aquí se agrupan para mostrarse como UNA sola tarjeta.

const groupKeyOf = (bp: BackendProduct): string =>
  `${(bp.nombre || '').trim().toLowerCase()}|${(bp.marca || '').trim().toLowerCase()}`;

/**
 * Agrupa las filas del backend en una entrada por perfume.
 * Respeta el orden de llegada (el backend las entrega de más nueva a más vieja).
 */
export function groupBackendProducts(rows: BackendProduct[]): BackendProduct[][] {
  const map = new Map<string, BackendProduct[]>();
  const order: string[] = [];

  rows.forEach((bp) => {
    const key = groupKeyOf(bp);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(bp);
  });

  return order.map((key) =>
    map
      .get(key)!
      .slice()
      .sort((a, b) => (a.tamano_ml ?? 0) - (b.tamano_ml ?? 0))
  );
}

/**
 * Convierte un grupo de filas (mismo perfume, varios ml) en un único `Perfume`.
 * - `sizes` sale de TODAS las presentaciones (cada una con su stock propio).
 * - `stock` del perfume es la SUMA de las existencias de todas las presentaciones.
 * - La imagen es la de la presentación que la tenga.
 */
export function backendGroupToPerfume(group: BackendProduct[]): Perfume {
  const sorted = group.slice().sort((a, b) => (a.tamano_ml ?? 0) - (b.tamano_ml ?? 0));
  const base = group.find((g) => g.imagen_url) || sorted[0] || group[0];

  // Id estable del perfume = la fila más antigua del grupo.
  const groupId = String(Math.min(...group.map((g) => Number(g.id))));

  const sizes: PerfumeSize[] = sorted.map((g) => ({
    ml: g.tamano_ml || 50,
    priceDOP: Number(g.precio),
    inStock: g.disponible ?? true,
    stock: g.stock ?? null,
    variantId: String(g.id),
  }));

  const stockValues = group
    .map((g) => g.stock)
    .filter((s): s is number => s !== null && s !== undefined);
  const totalStock = stockValues.length > 0 ? stockValues.reduce((a, b) => a + b, 0) : null;

  const single = backendProductToPerfume(base);

  return {
    ...single,
    id: groupId,
    sizes,
    stock: totalStock,
    image: base.imagen_url || single.image,
    hasImage: Boolean(base.imagen_url),
    isBestseller: group.some((g) => g.destacado),
  };
}

// ── Llamadas API ─────────────────────────────────────────────────────────────

export const productService = {
  /**
   * Obtiene todos los productos del backend
   */
  async getProducts(
    filters?: {
      categoria_id?: number;
      destacado?: boolean;
      disponible?: boolean;
      genero?: string;
      search?: string;
    },
    // El catálogo público nunca debe mostrar productos de respaldo que no
    // existan en el Panel Admin; para él, allowFallback va en false.
    options?: { allowFallback?: boolean }
  ): Promise<BackendProduct[]> {
    const allowFallback = options?.allowFallback !== false;
    try {
      const params = new URLSearchParams();
      if (filters?.categoria_id !== undefined) params.append('categoria_id', String(filters.categoria_id));
      if (filters?.destacado !== undefined) params.append('destacado', String(filters.destacado));
      if (filters?.disponible !== undefined) params.append('disponible', String(filters.disponible));
      if (filters?.genero) params.append('genero', filters.genero);
      if (filters?.search) params.append('search', filters.search);

      const url = `${API_BASE_URL}/productos${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch (error) {
      console.warn('Fallo al conectar con el backend en /api/productos. Usando catálogo estático como respaldo.');
      if (!allowFallback) return [];
      // Adaptar PERFUMES_DATA a formato BackendProduct
      return PERFUMES_DATA.map((p, idx) => ({
        id: idx + 1,
        nombre: p.name,
        marca: p.house,
        categoria_id: p.category === 'Diseñador' ? 2 : 1,
        categoria: { id: p.category === 'Diseñador' ? 2 : 1, nombre: p.category },
        imagen_url: p.image,
        genero: p.gender,
        concentracion: p.concentration,
        familia_olfativa: p.family,
        notas_principales: p.topNotes.join(', '),
        tamano_ml: p.sizes[0]?.ml || 50,
        precio: p.sizes[0]?.priceDOP || 15000,
        destacado: p.isBestseller ?? false,
        disponible: true,
      }));
    }
  },

  /**
   * Obtiene productos adaptados al tipo `Perfume` para el catálogo del cliente.
   * Las presentaciones (ml) del mismo perfume se agrupan en una sola tarjeta.
   */
  async getClientPerfumes(onlyAvailable = false): Promise<Perfume[]> {
    const raw = await this.getProducts(
      onlyAvailable ? { disponible: true } : undefined,
      { allowFallback: false }
    );
    const visible = raw.filter((bp) => bp.disponible !== false);
    return groupBackendProducts(visible).map(backendGroupToPerfume);
  },

  /**
   * Obtiene perfumes destacados (favoritos), agrupando sus presentaciones.
   */
  async getFeaturedPerfumes(): Promise<Perfume[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/productos/destacados`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return groupBackendProducts(json.data as BackendProduct[]).map(backendGroupToPerfume);
    } catch {
      return PERFUMES_DATA.filter((p) => p.isBestseller);
    }
  },

  /**
   * Obtiene las categorías
   */
  async getCategories(): Promise<BackendCategory[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/categorias`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch {
      return [
        { id: 1, nombre: 'Nicho' },
        { id: 2, nombre: 'Diseñador' },
      ];
    }
  },

  /**
   * Crea un producto (Panel Administrador)
   */
  async createProduct(data: ProductFormData): Promise<BackendProduct> {
    const res = await fetch(`${API_BASE_URL}/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al crear el perfume');
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Actualiza un producto existente (Panel Administrador)
   */
  async updateProduct(id: number | string, data: Partial<ProductFormData>): Promise<BackendProduct> {
    const res = await fetch(`${API_BASE_URL}/productos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al actualizar el perfume');
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Elimina un producto (Panel Administrador)
   */
  async deleteProduct(id: number | string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/productos/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al eliminar el perfume');
    }
  },

  /**
   * Alterna disponibilidad (disponible / agotado)
   */
  async toggleAvailability(id: number | string): Promise<BackendProduct> {
    const res = await fetch(`${API_BASE_URL}/productos/${id}/toggle-disponible`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al cambiar la disponibilidad');
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Alterna estado destacado / favorito
   */
  async toggleFeatured(id: number | string): Promise<BackendProduct> {
    const res = await fetch(`${API_BASE_URL}/productos/${id}/toggle-destacado`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al alternar destacado');
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Registra una nueva presentación (ml) de un perfume ya existente.
   * Se envían ml, stock y precio (cada ml puede costar distinto); el resto de
   * campos se copia del perfume base.
   */
  async createVariant(
    baseId: number | string,
    data: { tamano_ml: number; stock: number | null; precio?: number | null }
  ): Promise<BackendProduct> {
    const res = await fetch(`${API_BASE_URL}/productos/${baseId}/variantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al agregar la presentación');
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Actualiza los datos compartidos de TODAS las presentaciones de un perfume
   * (nombre, marca, precio, notas, imagen...). El ml y el stock se conservan.
   */
  async updateProductGroup(
    baseId: number | string,
    data: Partial<ProductFormData>
  ): Promise<BackendProduct[]> {
    const res = await fetch(`${API_BASE_URL}/productos/${baseId}/grupo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el perfume');
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Elimina las presentaciones (ml) indicadas de un perfume.
   */
  async deleteVariants(
    baseId: number | string,
    ids: Array<number | string>
  ): Promise<{ deleted: number; remaining: number }> {
    const res = await fetch(`${API_BASE_URL}/productos/${baseId}/eliminar-variantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al eliminar las presentaciones');
    }
    const json = await res.json();
    return json.data;
  },
};
