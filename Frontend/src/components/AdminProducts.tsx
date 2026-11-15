import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Star,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Package,
  Layers,
  Sparkles,
  AlertCircle,
  X,
  ImagePlus,
  Upload,
} from 'lucide-react';
import {
  BackendProduct,
  BackendCategory,
  ProductFormData,
  productService,
  groupBackendProducts,
} from '../services/productService';
import { realtime } from '../services/realtimeService';

interface AdminProductsProps {
  onProductsChanged?: () => void;
}

// Tamaño máximo permitido por imagen subida (en MB).
const MAX_IMAGE_MB = 6;

// Suma de existencias de todas las presentaciones (ml) de un perfume.
const sumStock = (group: BackendProduct[]): number | null => {
  const values = group
    .map((g) => g.stock)
    .filter((s): s is number => s !== null && s !== undefined);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
};

// Presentación "principal" del grupo: la que tiene la imagen (o la primera).
const baseOfGroup = (group: BackendProduct[]): BackendProduct =>
  group.find((g) => g.imagen_url) || group[0];

// Ordena las presentaciones de un grupo por ml ascendente.
const sortByMl = (group: BackendProduct[]): BackendProduct[] =>
  group.slice().sort((a, b) => (a.tamano_ml ?? 0) - (b.tamano_ml ?? 0));

export const AdminProducts: React.FC<AdminProductsProps> = ({ onProductsChanged }) => {
  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [categories, setCategories] = useState<BackendCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'low_stock' | 'featured'>('all');

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BackendProduct | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal para agregar una presentación (ml) a un perfume existente
  const [variantGroup, setVariantGroup] = useState<BackendProduct[] | null>(null);
  const [variantForm, setVariantForm] = useState<{
    tamano_ml: number;
    stock: number | null;
    precio: number | null;
  }>({
    tamano_ml: 100,
    stock: null,
    precio: null,
  });
  const [isSavingVariant, setIsSavingVariant] = useState(false);

  // Modal para eliminar presentaciones (ml): se eligen cuáles borrar
  const [deleteGroup, setDeleteGroup] = useState<BackendProduct[] | null>(null);
  const [deleteSelection, setDeleteSelection] = useState<Set<number>>(new Set());

  // Modal para editar el stock Y el precio de UNA presentación (ml)
  const [stockTarget, setStockTarget] = useState<BackendProduct | null>(null);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [priceValue, setPriceValue] = useState<number | null>(null);

  // Form State
  const initialFormState: ProductFormData = {
    nombre: '',
    marca: '',
    categoria_id: 1,
    precio: 0,
    tamano_ml: 0,
    stock: null,
    genero: 'Unisex',
    concentracion: 'Eau de Parfum',
    familia_olfativa: 'Amaderada',
    notas_principales: '',
    imagen_url: '',
    imagen_base64: null,
    imagen_mime: null,
    remove_imagen: false,
    destacado: false,
    disponible: true,
  };

  const [formData, setFormData] = useState<ProductFormData>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Imagen subida desde el equipo (se guarda como bytes en la base de datos).
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        productService.getProducts(),
        productService.getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (error) {
      console.error('Error al cargar datos administrativos:', error);
      showToast('Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Sincronización en tiempo real: si un pedido confirma y baja el stock,
    // o se edita un perfume, el catálogo del admin se actualiza automáticamente.
    const unsubscribe = realtime.on('products_updated', () => {
      loadData();
    });

    return () => unsubscribe();
  }, []);

  const notifyChange = () => {
    if (onProductsChanged) onProductsChanged();
  };

  // ── Acciones CRUD ──────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setImagePreview(null);
    setImageError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (prod: BackendProduct) => {
    setEditingProduct(prod);
    setFormData({
      nombre: prod.nombre,
      marca: prod.marca,
      categoria_id: prod.categoria_id ? Number(prod.categoria_id) : 1,
      precio: Number(prod.precio),
      tamano_ml: prod.tamano_ml || 50,
      stock: prod.stock ?? null,
      genero: prod.genero || 'Unisex',
      concentracion: prod.concentracion || 'Eau de Parfum',
      familia_olfativa: prod.familia_olfativa || 'Amaderada',
      notas_principales: prod.notas_principales || '',
      imagen_url: prod.imagen_externa_url || '',
      imagen_base64: null,
      imagen_mime: null,
      remove_imagen: false,
      destacado: prod.destacado ?? false,
      disponible: prod.disponible ?? true,
    });
    setImagePreview(prod.imagen_url || null);
    setImageError(null);
    setIsFormOpen(true);
  };

  // ── Manejo de la imagen subida ──────────────────────────────────────────────
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('El archivo debe ser una imagen (JPG, PNG, WEBP...).');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setImageError(`La imagen no puede superar ${MAX_IMAGE_MB} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setImageError(null);
      setImagePreview(dataUrl);
      setFormData((prev) => ({
        ...prev,
        imagen_base64: dataUrl,
        imagen_mime: file.type,
        remove_imagen: false,
      }));
    };
    reader.onerror = () => setImageError('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
    // Permite volver a elegir el mismo archivo si se desea.
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageError(null);
    setFormData((prev) => ({
      ...prev,
      imagen_base64: null,
      imagen_mime: null,
      remove_imagen: true,
      imagen_url: '',
    }));
  };

  // Al pegar una URL, se cancela cualquier "Quitar imagen" previo y se usa la
  // URL como vista previa. El backend la descargará y la guardará en la BD.
  const handleUrlChange = (value: string) => {
    setImageError(null);
    setFormData((prev) => ({
      ...prev,
      imagen_url: value,
      imagen_base64: null,
      imagen_mime: null,
      remove_imagen: false,
    }));
    setImagePreview(value.trim() ? value.trim() : null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.marca.trim()) {
      alert('Por favor completa el nombre y la marca del perfume.');
      return;
    }
    if (!editingProduct) {
      if (!formData.precio || formData.precio <= 0) {
        alert('Indica un precio válido para el perfume.');
        return;
      }
      if (!formData.tamano_ml || formData.tamano_ml <= 0) {
        alert('Indica un tamaño (ml) válido para el perfume.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        // Editar engloba TODO el perfume: los datos compartidos se aplican a
        // todas las presentaciones (ml) del grupo.
        await productService.updateProductGroup(editingProduct.id, formData);
        showToast(`Perfume "${formData.nombre}" actualizado.`);
      } else {
        await productService.createProduct(formData);
        showToast(`Perfume "${formData.nombre}" agregado con éxito.`);
      }
      setIsFormOpen(false);
      await loadData();
      notifyChange();
    } catch (err: any) {
      alert(err.message || 'Error al guardar el perfume');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Presentaciones (ml) ────────────────────────────────────────────────────
  const handleOpenAddVariant = (group: BackendProduct[]) => {
    const maxMl = sortByMl(group).reduce((m, g) => Math.max(m, g.tamano_ml || 0), 0);
    const base = baseOfGroup(group);
    setVariantGroup(group);
    setVariantForm({
      tamano_ml: maxMl > 0 ? maxMl + 50 : 100,
      stock: null,
      // El precio arranca con el de la presentación base; el admin lo ajusta.
      precio: base?.precio != null ? Number(base.precio) : null,
    });
  };

  const handleSaveVariant = async () => {
    if (!variantGroup) return;
    const base = baseOfGroup(variantGroup);
    const ml = Number(variantForm.tamano_ml);
    if (!ml || ml <= 0) {
      alert('Indica un tamaño en ml válido.');
      return;
    }
    if (variantGroup.some((g) => Number(g.tamano_ml) === ml)) {
      alert(`Este perfume ya tiene una presentación de ${ml} ml.`);
      return;
    }
    if (variantForm.precio === null || variantForm.precio < 0 || isNaN(variantForm.precio)) {
      alert('Indica un precio válido para esta presentación.');
      return;
    }
    setIsSavingVariant(true);
    try {
      await productService.createVariant(base.id, {
        tamano_ml: ml,
        stock: variantForm.stock,
        precio: variantForm.precio,
      });
      showToast(`Presentación de ${ml} ml agregada a "${base.nombre}".`);
      setVariantGroup(null);
      await loadData();
      notifyChange();
    } catch (err: any) {
      alert(err.message || 'Error al agregar la presentación');
    } finally {
      setIsSavingVariant(false);
    }
  };

  const handleOpenDeleteGroup = (group: BackendProduct[]) => {
    setDeleteGroup(group);
    // Por defecto se marcan todas (equivale a eliminar el perfume completo).
    setDeleteSelection(new Set(group.map((g) => Number(g.id))));
  };

  const toggleDeleteSelection = (id: number) => {
    setDeleteSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deleteGroup) return;
    const ids = Array.from(deleteSelection);
    if (ids.length === 0) {
      alert('Selecciona al menos una presentación para eliminar.');
      return;
    }
    const base = baseOfGroup(deleteGroup);
    try {
      await productService.deleteVariants(base.id, ids);
      showToast(
        ids.length === deleteGroup.length
          ? `Perfume "${base.nombre}" eliminado del catálogo.`
          : `Se eliminaron ${ids.length} presentación(es) de "${base.nombre}".`
      );
      setDeleteGroup(null);
      await loadData();
      notifyChange();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar las presentaciones');
    }
  };

  const handleOpenStock = (prod: BackendProduct) => {
    setStockTarget(prod);
    setStockValue(prod.stock ?? null);
    setPriceValue(prod.precio != null ? Number(prod.precio) : null);
  };

  const handleSaveStock = async () => {
    if (!stockTarget) return;
    if (priceValue === null || priceValue < 0 || isNaN(priceValue)) {
      alert('Indica un precio válido para esta presentación.');
      return;
    }
    try {
      await productService.updateProduct(stockTarget.id, { stock: stockValue, precio: priceValue });
      showToast(`Presentación de ${stockTarget.tamano_ml || 50} ml actualizada.`);
      setStockTarget(null);
      await loadData();
      notifyChange();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar la presentación');
    }
  };

  // ── Datos compartidos del grupo (aplican a todas las presentaciones) ───────
  const handleToggleAvailability = async (group: BackendProduct[]) => {
    const base = baseOfGroup(group);
    const newValue = !group.some((p) => p.disponible);
    try {
      await Promise.all(
        group.map((g) => productService.updateProduct(g.id, { disponible: newValue }))
      );
      showToast(`"${base.nombre}" ahora está ${newValue ? 'Disponible' : 'Oculto'}`);
      await loadData();
      notifyChange();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar disponibilidad');
    }
  };

  const handleToggleFeatured = async (group: BackendProduct[]) => {
    const base = baseOfGroup(group);
    const newValue = !group.some((p) => p.destacado);
    try {
      await Promise.all(
        group.map((g) => productService.updateProduct(g.id, { destacado: newValue }))
      );
      showToast(`"${base.nombre}" ${newValue ? 'destacado en favoritos' : 'retirado de favoritos'}`);
      await loadData();
      notifyChange();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar destacado');
    }
  };

  // ── Agrupación y filtrado ──────────────────────────────────────────────────
  // Cada perfume puede tener varias presentaciones (ml): se muestran juntas en
  // UNA sola tarjeta. El grupo se identifica por nombre + marca.
  const groups = groupBackendProducts(products);

  const filteredGroups = groups.filter((group) => {
    const base = baseOfGroup(group);
    const haystack = `${base.nombre} ${base.marca} ${base.familia_olfativa || ''}`.toLowerCase();
    const matchSearch = haystack.includes(search.toLowerCase());

    const matchCategory =
      selectedCategory === 'all' ||
      group.some(
        (g) =>
          (g.categoria && g.categoria.nombre.toLowerCase() === selectedCategory.toLowerCase()) ||
          String(g.categoria_id) === selectedCategory
      );

    let matchStatus = true;
    if (statusFilter === 'available') matchStatus = group.some((g) => g.disponible === true);
    if (statusFilter === 'low_stock') {
      // Bajo stock = la suma de todas las presentaciones es menor a 2.
      const total = sumStock(group);
      matchStatus = total !== null && total < 2;
    }
    if (statusFilter === 'featured') matchStatus = group.some((g) => g.destacado === true);

    return matchSearch && matchCategory && matchStatus;
  });

  // Métricas (se cuentan perfumes, no presentaciones)
  const totalCount = groups.length;
  const availableCount = groups.filter((g) => g.some((p) => p.disponible)).length;
  const featuredCount = groups.filter((g) => g.some((p) => p.destacado)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141414] border border-[#D4AF37] text-[#FAF7F0] px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] uppercase tracking-widest mb-1">
            <Package className="w-4 h-4" />
            <span>Panel de Administración D’ Victor</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#FAF7F0] font-normal tracking-wide">
            Gestión del Catálogo de Perfumes
          </h1>
          <p className="text-xs text-[#8E8E93] mt-1">
            Administra los perfumes visibles en la tienda: disponibilidad, favoritos destacados, precios e inventario.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Recargar datos del servidor"
            className="p-2.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-md text-[#B8B8B8] hover:text-[#FAF7F0] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B38F24] hover:from-[#FFD76A] hover:to-[#D4AF37] text-[#050505] rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-300 shadow-[0_4px_14px_rgba(212,175,55,0.25)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Perfume</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 my-6">
        <div className="bg-[#111111] border border-[#262626] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#8E8E93] mb-1">
            <span>Total Catálogo</span>
            <Layers className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FAF7F0]">{totalCount}</div>
          <span className="text-[10px] text-[#8E8E93]">Fragancias registradas</span>
        </div>

        <div className="bg-[#111111] border border-[#262626] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#8E8E93] mb-1">
            <span>En Disponibilidad</span>
            <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#22c55e]">{availableCount}</div>
          <span className="text-[10px] text-[#8E8E93]">Listos para compra inmediata</span>
        </div>

        <div className="bg-[#111111] border border-[#262626] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#8E8E93] mb-1">
            <span>Favoritos Destacados</span>
            <Star className="w-4 h-4 text-[#D4AF37] fill-[#D4AF37]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#D4AF37]">{featuredCount}</div>
          <span className="text-[10px] text-[#8E8E93]">Visibles en carrusel principal</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111111] border border-[#262626] rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, marca o aroma..."
            className="w-full pl-9 pr-4 py-2 bg-[#080808] border border-[#262626] rounded-md text-xs text-[#FAF7F0] placeholder-[#8E8E93] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Categoría */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#080808] border border-[#262626] text-xs text-[#FAF7F0] px-3 py-2 rounded-md focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="all">Todas las Categorías</option>
            <option value="Nicho">Nicho</option>
            <option value="Diseñador">Diseñador</option>
          </select>

          {/* Estado */}
          <div className="flex rounded-md bg-[#080808] border border-[#262626] p-0.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded transition-colors ${
                statusFilter === 'all' ? 'bg-[#D4AF37] text-[#050505] font-semibold' : 'text-[#B8B8B8] hover:text-[#FAF7F0]'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('available')}
              className={`px-3 py-1.5 rounded transition-colors ${
                statusFilter === 'available' ? 'bg-[#D4AF37] text-[#050505] font-semibold' : 'text-[#B8B8B8] hover:text-[#FAF7F0]'
              }`}
            >
              Disponibles
            </button>
            <button
              onClick={() => setStatusFilter('featured')}
              className={`px-3 py-1.5 rounded transition-colors ${
                statusFilter === 'featured' ? 'bg-[#D4AF37] text-[#050505] font-semibold' : 'text-[#B8B8B8] hover:text-[#FAF7F0]'
              }`}
            >
              Favoritos
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1.5 rounded transition-colors ${
                statusFilter === 'low_stock' ? 'bg-[#D4AF37] text-[#050505] font-semibold' : 'text-[#B8B8B8] hover:text-[#FAF7F0]'
              }`}
            >
              Bajo Stock
            </button>
          </div>
        </div>
      </div>

      {/* Product Cards Grid */}
      {isLoading ? (
        <div className="bg-[#111111] border border-[#262626] rounded-xl py-16 text-center text-[#8E8E93]">
          <div className="flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37]" />
            <span>Cargando catálogo desde el backend...</span>
          </div>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-[#111111] border border-[#262626] rounded-xl py-16 text-center text-[#8E8E93]">
          No se encontraron perfumes con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredGroups.map((group) => {
            const base = baseOfGroup(group);
            const sizes = sortByMl(group);
            const totalStock = sumStock(group);
            const isLowStock = totalStock !== null && totalStock < 2;
            const isFeatured = group.some((p) => p.destacado);
            const isAvailable = group.some((p) => p.disponible);

            return (
              <article
                key={base.id}
                className="group bg-[#111111] border border-[#262626] hover:border-[#D4AF37]/50 rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
              >
                {/* Imagen cuadrada */}
                <div className="relative aspect-square bg-[#0c0c0c] overflow-hidden">
                  {base.imagen_url ? (
                    <img
                      src={base.imagen_url}
                      alt={base.nombre}
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#333]">
                      <ImagePlus className="w-8 h-8" />
                    </div>
                  )}

                  {/* Badges superiores */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                    {isFeatured && (
                      <span className="text-[9px] tracking-[0.14em] uppercase font-sans font-semibold px-2 py-0.5 bg-[#D4AF37] text-[#050505] rounded">
                        Destacado
                      </span>
                    )}
                    {isLowStock && (
                      <span className="text-[9px] tracking-[0.14em] uppercase font-sans font-semibold px-2 py-0.5 bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 rounded">
                        Bajo stock
                      </span>
                    )}
                  </div>

                  {/* Acciones rápidas */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenAddVariant(group)}
                      title="Agregar otra presentación (ml)"
                      className="p-1.5 rounded-md bg-[#050505]/80 text-[#B8B8B8] hover:text-[#22c55e] border border-[#262626] transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(base)}
                      title="Editar perfume (todas las presentaciones)"
                      className="p-1.5 rounded-md bg-[#050505]/80 text-[#B8B8B8] hover:text-[#D4AF37] border border-[#262626] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteGroup(group)}
                      title="Eliminar presentaciones"
                      className="p-1.5 rounded-md bg-[#050505]/80 text-[#B8B8B8] hover:text-[#ef4444] border border-[#262626] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Disponibilidad */}
                  <button
                    onClick={() => handleToggleAvailability(group)}
                    title="Cambiar disponibilidad"
                    className={`absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-all backdrop-blur-sm ${
                      isAvailable
                        ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40'
                        : 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40'
                    }`}
                  >
                    {isAvailable ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Disponible</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>Oculto</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Contenido */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-sans font-semibold text-[#D4AF37] truncate">
                        {base.marca}
                      </span>
                      <span className="text-[10px] text-[#8E8E93] font-mono shrink-0">
                        {base.concentracion || 'Eau de Parfum'}
                      </span>
                    </div>
                    <h3 className="font-serif text-base text-[#FAF7F0] font-medium leading-snug line-clamp-2">
                      {base.nombre}
                    </h3>
                    <div className="text-[10px] text-[#8E8E93] flex items-center gap-1.5 mt-1 flex-wrap">
                      <span>{base.categoria?.nombre || 'Nicho'}</span>
                      <span>·</span>
                      <span>{base.familia_olfativa || 'Amaderada'}</span>
                    </div>
                  </div>

                  {/* Presentaciones (ml): clic para editar el stock de una */}
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#8E8E93] font-bold block mb-1">
                      Presentaciones (ml)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((s) => {
                        const sLow =
                          s.stock !== null && s.stock !== undefined && Number(s.stock) < 2;
                        return (
                          <button
                            key={s.id}
                            onClick={() => handleOpenStock(s)}
                            title="Editar el stock y el precio de esta presentación"
                            className={`text-left text-[11px] px-3 py-1.5 rounded border font-mono leading-snug transition-colors cursor-pointer ${
                              sLow
                                ? 'border-[#ef4444]/40 hover:bg-[#ef4444]/10'
                                : 'border-[#262626] hover:border-[#D4AF37]/50'
                            }`}
                          >
                            <span
                              className={`block ${sLow ? 'text-[#ef4444]' : 'text-[#FAF7F0]'}`}
                            >
                              {s.tamano_ml || 50} ml
                            </span>
                            <span className="block text-[#D4AF37]">
                              RD$ {Number(s.precio).toLocaleString()}
                            </span>
                            <span className="block text-[#8E8E93]">stock {s.stock ?? '—'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleFeatured(group)}
                    title={isFeatured ? 'Quitar de destacados' : 'Marcar como destacado'}
                    className={`mt-auto w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border transition-colors cursor-pointer ${
                      isFeatured
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40 hover:bg-[#D4AF37]/25'
                        : 'bg-[#080808] text-[#8E8E93] border-[#262626] hover:text-[#D4AF37] hover:border-[#D4AF37]/40'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-[#D4AF37]' : ''}`} />
                    <span>{isFeatured ? 'Destacado' : 'Marcar destacado'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── MODAL DE CREAR / EDITAR PERFUME ─────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#111111] border border-[#262626] rounded-xl max-w-2xl w-full p-6 shadow-2xl my-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#262626] mb-5">
              <h2 className="font-serif text-xl text-[#FAF7F0] font-normal">
                {editingProduct ? 'Editar Perfume' : 'Agregar Nuevo Perfume'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-[#8E8E93] hover:text-[#FAF7F0] p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                    Nombre del Perfume *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej. Tabac Doré Niche Millésime"
                    className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Marca */}
                <div>
                  <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                    Casa Perfumera / Marca *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="Ej. Bortnikoff Parfums"
                    className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Categoría */}
                <div>
                  <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.categoria_id}
                    onChange={(e) => setFormData({ ...formData, categoria_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value={1}>Nicho</option>
                    <option value={2}>Diseñador</option>
                  </select>
                </div>

                {/* Precio, presentación (ml) y stock: SOLO al crear. Al editar,
                    el precio y el stock de cada ml se editan desde su etiqueta. */}
                {!editingProduct && (
                  <>
                    <div>
                      <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                        Precio (RD$) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={100}
                        value={formData.precio || ''}
                        onChange={(e) => setFormData({ ...formData, precio: Number(e.target.value) })}
                        placeholder="Ej. 15000"
                        className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                        Tamaño (ml)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.tamano_ml || ''}
                        onChange={(e) => setFormData({ ...formData, tamano_ml: Number(e.target.value) })}
                        placeholder="Ej. 100"
                        className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formData.stock ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormData({ ...formData, stock: v === '' ? null : Number(v) });
                        }}
                        placeholder="Ej. 10"
                        className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </>
                )}
              </div>

              {editingProduct && (
                <p className="text-[10px] text-[#8E8E93] -mt-2">
                  Los datos (marca, notas, categoría, imagen...) aplican a TODAS las
                  presentaciones (ml). El <span className="text-[#D4AF37]">precio</span> y el{' '}
                  <span className="text-[#D4AF37]">stock</span> de cada presentación se editan
                  haciendo clic en su etiqueta ml en la tarjeta.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Género */}
                <div>
                  <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                    Género
                  </label>
                  <select
                    value={formData.genero}
                    onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Unisex">Unisex</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                  </select>
                </div>

                {/* Concentración */}
                <div>
                  <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                    Concentración
                  </label>
                  <select
                    value={formData.concentracion}
                    onChange={(e) => setFormData({ ...formData, concentracion: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Extrait de Parfum">Extrait de Parfum</option>
                    <option value="Eau de Parfum">Eau de Parfum</option>
                    <option value="Parfum">Parfum</option>
                    <option value="Eau de Toilette">Eau de Toilette</option>
                  </select>
                </div>

                {/* Familia Olfativa */}
                <div>
                  <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                    Familia Olfativa
                  </label>
                  <select
                    value={formData.familia_olfativa}
                    onChange={(e) => setFormData({ ...formData, familia_olfativa: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Amaderada">Amaderada</option>
                    <option value="Oriental / Ámbar">Oriental / Ámbar</option>
                    <option value="Floral">Floral</option>
                    <option value="Cítrica / Fresca">Cítrica / Fresca</option>
                    <option value="Gourmand / Especiada">Gourmand / Especiada</option>
                    <option value="Cuero / Chipre">Cuero / Chipre</option>
                  </select>
                </div>
              </div>

              {/* Notas principales */}
              <div>
                <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                  Notas Principales (Separadas por comas)
                </label>
                <input
                  type="text"
                  value={formData.notas_principales}
                  onChange={(e) => setFormData({ ...formData, notas_principales: e.target.value })}
                  placeholder="Ej. Tabaco rubio, Vainilla de Tahití, Cacao, Oud Tailandés"
                  className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Imagen del Perfume: se sube y se guarda en la base de datos */}
              <div>
                <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                  Imagen del Perfume
                </label>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {/* Vista previa */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-[#080808] border border-[#262626] shrink-0 flex items-center justify-center">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-[#444]" />
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-[#080808] border border-[#D4AF37]/40 hover:border-[#D4AF37] rounded text-xs text-[#FAF7F0] cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{imagePreview ? 'Cambiar imagen' : 'Subir imagen desde el equipo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>

                    <p className="text-[10px] text-[#8E8E93]">
                      Se guarda en la base de datos · máx. {MAX_IMAGE_MB} MB · JPG, PNG, WEBP.
                    </p>

                    {imageError && <p className="text-[10px] text-[#ef4444]">{imageError}</p>}

                    {(imagePreview || editingProduct?.has_db_image) && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-[10px] text-[#ef4444] hover:underline"
                      >
                        Quitar imagen
                      </button>
                    )}
                  </div>
                </div>

                {/* URL externa opcional: el backend la descarga y la guarda en la BD */}
                <input
                  type="text"
                  value={formData.imagen_url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="O pega una URL de internet (se descargará y guardará en la BD)"
                  className="mt-2 w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Switches: Destacado & Disponible */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded bg-[#080808] border border-[#262626] flex-1">
                  <input
                    type="checkbox"
                    checked={formData.destacado}
                    onChange={(e) => setFormData({ ...formData, destacado: e.target.checked })}
                    className="accent-[#D4AF37] w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#FAF7F0] block">Marcar como Destacado (Favorito)</span>
                    <span className="text-[10px] text-[#8E8E93]">Se mostrará en la sección de favoritos del cliente</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded bg-[#080808] border border-[#262626] flex-1">
                  <input
                    type="checkbox"
                    checked={formData.disponible}
                    onChange={(e) => setFormData({ ...formData, disponible: e.target.checked })}
                    className="accent-[#22c55e] w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#FAF7F0] block">Disponible para la Venta</span>
                    <span className="text-[10px] text-[#8E8E93]">Activa la opción de agregar a la bolsa</span>
                  </div>
                </label>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs text-[#B8B8B8] hover:text-[#FAF7F0] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-gradient-to-r from-[#D4AF37] to-[#B38F24] hover:from-[#FFD76A] hover:to-[#D4AF37] text-[#050505] rounded text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-[0_2px_10px_rgba(212,175,55,0.2)]"
                >
                  {isSubmitting ? 'Guardando...' : editingProduct ? 'Actualizar Perfume' : 'Crear Perfume'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL AGREGAR PRESENTACIÓN (ml) ─────────────────────────────────── */}
      {variantGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#262626] mb-5">
              <h2 className="font-serif text-xl text-[#FAF7F0] font-normal">
                Agregar presentación
              </h2>
              <button
                onClick={() => setVariantGroup(null)}
                className="text-[#8E8E93] hover:text-[#FAF7F0] p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8E8E93] mb-4">
              Nuevo tamaño de{' '}
              <span className="text-[#D4AF37]">{baseOfGroup(variantGroup).nombre}</span>. Se
              copian marca, notas y categoría del perfume actual. Cada presentación tiene su
              propio precio y stock.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                  Tamaño (ml) *
                </label>
                <input
                  type="number"
                  min={1}
                  autoFocus
                  value={variantForm.tamano_ml}
                  onChange={(e) =>
                    setVariantForm({ ...variantForm, tamano_ml: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                  Precio (RD$) *
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={variantForm.precio ?? ''}
                  onChange={(e) =>
                    setVariantForm({
                      ...variantForm,
                      precio: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                  Stock
                </label>
                <input
                  type="number"
                  min={0}
                  value={variantForm.stock ?? ''}
                  onChange={(e) =>
                    setVariantForm({
                      ...variantForm,
                      stock: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Ej. 10"
                  className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-5 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setVariantGroup(null)}
                className="px-4 py-2 text-xs text-[#B8B8B8] hover:text-[#FAF7F0] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveVariant}
                disabled={isSavingVariant}
                className="px-6 py-2 bg-gradient-to-r from-[#D4AF37] to-[#B38F24] hover:from-[#FFD76A] hover:to-[#D4AF37] text-[#050505] rounded text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingVariant ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR PRESENTACIONES (ml) ──────────────────────────────── */}
      {deleteGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#ef4444]/40 rounded-xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-[#ef4444]/15 border border-[#ef4444]/40 text-[#ef4444] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg text-[#FAF7F0] mb-2 font-normal text-center">
              Eliminar de "{baseOfGroup(deleteGroup).nombre}"
            </h3>
            <p className="text-xs text-[#8E8E93] mb-4 text-center">
              Marca las presentaciones (ml) que quieres eliminar. Las que dejes sin marcar se
              conservan. Si eliminas todas, el perfume sale del catálogo.
            </p>

            <div className="space-y-2 mb-6">
              {sortByMl(deleteGroup).map((s) => {
                const checked = deleteSelection.has(Number(s.id));
                return (
                  <label
                    key={s.id}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded border cursor-pointer transition-colors ${
                      checked
                        ? 'border-[#ef4444]/50 bg-[#ef4444]/10'
                        : 'border-[#262626] bg-[#080808]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDeleteSelection(Number(s.id))}
                        className="accent-[#ef4444] w-4 h-4"
                      />
                      <span className="text-xs text-[#FAF7F0] font-mono">
                        {s.tamano_ml || 50} ml
                      </span>
                    </span>
                    <span className="text-[10px] text-[#8E8E93] font-mono">
                      Stock: {s.stock ?? '—'}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteGroup(null)}
                className="px-4 py-2 text-xs text-[#B8B8B8] hover:text-[#FAF7F0] border border-[#262626] rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteGroup}
                className="px-5 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-semibold rounded uppercase tracking-wider transition-colors cursor-pointer"
              >
                {deleteSelection.size === deleteGroup.length
                  ? 'Sí, eliminar todo'
                  : `Eliminar ${deleteSelection.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR PRESENTACIÓN (ml): stock y precio ──────────────────── */}
      {stockTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#262626] mb-5">
              <h2 className="font-serif text-lg text-[#FAF7F0] font-normal">
                Editar presentación
              </h2>
              <button
                onClick={() => setStockTarget(null)}
                className="text-[#8E8E93] hover:text-[#FAF7F0] p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8E8E93] mb-4">
              Presentación de{' '}
              <span className="text-[#D4AF37] font-mono">{stockTarget.tamano_ml || 50} ml</span>{' '}
              de <span className="text-[#D4AF37]">{stockTarget.nombre}</span>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                  Precio (RD$)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  autoFocus
                  value={priceValue ?? ''}
                  onChange={(e) =>
                    setPriceValue(e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider mb-1">
                  Stock
                </label>
                <input
                  type="number"
                  min={0}
                  value={stockValue ?? ''}
                  onChange={(e) =>
                    setStockValue(e.target.value === '' ? null : Number(e.target.value))
                  }
                  placeholder="Ej. 10"
                  className="w-full px-3 py-2 bg-[#080808] border border-[#262626] rounded text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-5 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setStockTarget(null)}
                className="px-4 py-2 text-xs text-[#B8B8B8] hover:text-[#FAF7F0] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveStock}
                className="px-6 py-2 bg-gradient-to-r from-[#D4AF37] to-[#B38F24] hover:from-[#FFD76A] hover:to-[#D4AF37] text-[#050505] rounded text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
