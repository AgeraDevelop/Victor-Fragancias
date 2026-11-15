/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/App.tsx
 * QUÉ ES: Componente raíz de la app. Guarda el estado global (carrito,
 *         pestaña activa, modales) y decide qué se renderiza.
 * DÓNDE SE VE: Toda la página (Inicio / Catálogo / Showroom) + modales.
 * QUÉ TOCAR:
 *   - Estado global (carrito en memoria, modales) → bloque "ESTADO GLOBAL".
 *   - Lógica de la bolsa → funciones `handleAddToCart`, `handleUpdateQuantity`,
 *     `handleRemoveFromCart`, `handleClearCart`.
 *   - Pestañas / scroll → `handleNavigate`, `handleScrollToSection`.
 *   - Qué aparece en Inicio → bloque "ROUTER DE PESTAÑAS" (`activeTab`).
 *   - Orden de los modales → bloque "MODALES GLOBALES" al final del return.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PerfumeCarousel } from './components/PerfumeCarousel';
import { CampaignBanners } from './components/CampaignBanners';
import { Catalog } from './components/Catalog';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { SearchModal } from './components/SearchModal';
import { OrderConfirmationModal } from './components/OrderConfirmationModal';
import { SizeChooserModal } from './components/SizeChooserModal';
import { Footer } from './components/Footer';
import { productService } from './services/productService';
import { realtime } from './services/realtimeService';
import { Perfume, CartItem, CheckoutFormData, OrderItem } from './types';

// Límite de unidades para UNA presentación (ml). Cada ml se limita por
// separado; `null`/`undefined` = sin límite definido.
const stockLimitOfSize = (perfume: Perfume, sizeMl: number): number => {
  const size = perfume.sizes.find((s) => s.ml === sizeMl);
  const stock = size?.stock;
  return stock === null || stock === undefined ? Infinity : Math.max(0, stock);
};

// ── ESTADO GLOBAL ───────────────────────────────────────────────────────────
// Pestaña activa, modales y carrito (en memoria). El catálogo público se carga
// siempre desde el backend (solo productos visibles en el Panel Admin).
export default function App() {
  const [activeTab, setActiveTab] = useState<string>('inicio');
  // tabKey sube con cada cambio de tab para forzar remount y disparar la animación CSS
  const [tabKey, setTabKey] = useState(0);
  const [selectedPerfume, setSelectedPerfume] = useState<Perfume | null>(null);
  // Perfume cuyo selector de presentación (ml) está abierto al pulsar "Añadir".
  const [sizeChooserPerfume, setSizeChooserPerfume] = useState<Perfume | null>(null);
  const [cartToast, setCartToast] = useState<{
    perfumeName: string;
    sizeMl: number;
  } | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderId: string;
    total: number;
    formData: CheckoutFormData;
    items: OrderItem[];
  } | null>(null);

  // Catálogo sincronizado con el Backend (solo productos visibles en el Panel Admin)
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [isLoadingPerfumes, setIsLoadingPerfumes] = useState(false);

  const loadPerfumes = async () => {
    try {
      setIsLoadingPerfumes(true);
      const data = await productService.getClientPerfumes(true);
      setPerfumes(data || []);
    } catch (err) {
      console.warn('Backend no disponible, no se pudo cargar el catálogo:', err);
    } finally {
      setIsLoadingPerfumes(false);
    }
  };

  useEffect(() => {
    loadPerfumes();

    // Sincronización en tiempo real: si un administrador edita un perfume,
    // actualiza el precio, cambia el stock o la disponibilidad, la Landing Page
    // y el catálogo se refrescan automáticamente para el cliente.
    const unsubscribe = realtime.on('products_updated', () => {
      loadPerfumes();
    });

    return () => unsubscribe();
  }, []);

  // Al abrir la bolsa, refrescamos el catálogo para trabajar con el stock actual
  // del Panel Admin (y no con una copia vieja en memoria).
  useEffect(() => {
    if (isCartOpen) loadPerfumes();
  }, [isCartOpen]);

  // Carrito en memoria (sin persistencia): vive solo mientras la pestaña esté
  // abierta. Todo lo que se muestra sale del backend.
  const [cart, setCart] = useState<CartItem[]>([]);

  // Mantén el carrito sincronizado con el catálogo administrado: al cargar los
  // perfumes (o al cambiar su stock), actualizamos la "foto" de cada ítem y
  // recortamos la cantidad si supera el stock disponible.
  useEffect(() => {
    if (perfumes.length === 0) return;
    setCart((prevCart) => {
      let changed = false;
      const next = prevCart
        .map((item) => {
          const fresh = perfumes.find((p) => p.id === item.perfume.id);
          if (!fresh) return item;

          const stockLimit = stockLimitOfSize(fresh, item.sizeMl);
          const quantity = Math.min(item.quantity, stockLimit);

          const needsUpdate =
            quantity !== item.quantity ||
            item.perfume.stock !== fresh.stock ||
            item.perfume.image !== fresh.image ||
            item.perfume.name !== fresh.name ||
            JSON.stringify(item.perfume.sizes) !== JSON.stringify(fresh.sizes);

          if (!needsUpdate) return item;

          changed = true;
          return { ...item, quantity, perfume: { ...item.perfume, ...fresh } };
        })
        .filter((item): item is CartItem => item !== null && item.quantity > 0);

      return changed ? next : prevCart;
    });
  }, [perfumes]);

  // Stock real de una presentación (ml), tomado del catálogo actual (fuente de
  // verdad), con respaldo en la copia guardada en el carrito.
  const resolveStockLimit = (perfume: Perfume, sizeMl: number): number => {
    const fresh = perfumes.find((p) => p.id === perfume.id);
    return stockLimitOfSize(fresh ?? perfume, sizeMl);
  };

  // ── CATÁLOGO VISIBLE EN LA LANDING ──────────────────────────────────────────
  // El cliente NUNCA ve cantidades de stock. Además, las presentaciones (ml) que
  // se quedaron en 0 no se muestran (en vez de aparecer como "Agotado"), y un
  // perfume sin ninguna presentación disponible desaparece del catálogo.
  // El stock real se conserva aparte (en `perfumes`) para limitar la bolsa.
  const catalogPerfumes = useMemo(() => {
    return perfumes
      .map((p) => ({
        ...p,
        sizes: p.sizes.filter(
          (s) => s.stock === null || s.stock === undefined || s.stock > 0
        ),
      }))
      .filter((p) => p.sizes.length > 0);
  }, [perfumes]);

  // Cart operations
  const handleAddToCart = (perfume: Perfume, sizeMl: number, quantity: number = 1) => {
    const sizeConfig = perfume.sizes.find((s) => s.ml === sizeMl) || perfume.sizes[0];
    const stockLimit = resolveStockLimit(perfume, sizeMl);
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.perfume.id === perfume.id && item.sizeMl === sizeMl
      );
      if (existingIndex > -1) {
        const next = [...prevCart];
        const currentQty = next[existingIndex].quantity;
        const newQty = Math.min(currentQty + quantity, stockLimit);
        if (newQty === currentQty) return prevCart; // ya se alcanzó el stock disponible
        next[existingIndex] = { ...next[existingIndex], quantity: newQty };
        return next;
      }
      const initialQty = Math.min(quantity, stockLimit);
      if (initialQty <= 0) return prevCart; // sin stock disponible
      return [
        ...prevCart,
        {
          perfume,
          sizeMl,
          priceDOP: sizeConfig.priceDOP,
          quantity: initialQty,
        },
      ];
    });
  };

  // ── AÑADIR RÁPIDO (carrusel y catálogo) ─────────────────────────────────────
  // Si el perfume tiene una sola presentación, se agrega directo. Si tiene
  // varias, se abre el selector para que el cliente elija cuál comprar.
  const handleQuickAdd = (perfume: Perfume) => {
    if (perfume.sizes.length <= 1) {
      const only = perfume.sizes[0];
      if (only) {
        handleAddToCart(perfume, only.ml, 1);
        setCartToast({ perfumeName: perfume.name, sizeMl: only.ml });
        setRecentlyAddedId(perfume.id);
        setTimeout(() => setRecentlyAddedId(null), 2000);
        setTimeout(() => setCartToast(null), 3500);
      }
      return;
    }
    setSizeChooserPerfume(perfume);
  };

  // Confirmación desde el selector: agrega la presentación elegida, muestra
  // mensaje de confirmación en pantalla y cierra el selector.
  const handleSelectSize = (perfume: Perfume, sizeMl: number) => {
    handleAddToCart(perfume, sizeMl, 1);
    setSizeChooserPerfume(null);
    setCartToast({ perfumeName: perfume.name, sizeMl });
    setRecentlyAddedId(perfume.id);
    setTimeout(() => setRecentlyAddedId(null), 2000);
    setTimeout(() => setCartToast(null), 3500);
  };

  const handleUpdateQuantity = (perfumeId: string, sizeMl: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.perfume.id === perfumeId && item.sizeMl === sizeMl) {
            // Nunca permite superar el stock de esa presentación (catálogo actual).
            const newQty = Math.min(item.quantity + delta, resolveStockLimit(item.perfume, item.sizeMl));
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (perfumeId: string, sizeMl: number) => {
    setCart((prev) =>
      prev.filter((item) => !(item.perfume.id === perfumeId && item.sizeMl === sizeMl))
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderPlaced = (orderId: string, total: number, formData: CheckoutFormData) => {
    // Congelamos los perfumes del pedido para el recibo y para registrar el
    // pedido en el backend (lo confirma el Panel Admin).
    const items: OrderItem[] = cart.map((item) => ({
      perfumeId: item.perfume.id,
      variantId:
        item.perfume.sizes.find((s) => s.ml === item.sizeMl)?.variantId ||
        item.perfume.id,
      perfumeName: item.perfume.name,
      house: item.perfume.house,
      image: item.perfume.image,
      sizeMl: item.sizeMl,
      priceDOP: item.priceDOP,
      quantity: item.quantity,
    }));

    setOrderConfirmation({ orderId, total, formData, items });
    setCart([]);
    setIsCartOpen(false);
  };

  const handleSelectPerfumeById = (perfumeId: string) => {
    // Buscamos en el catálogo visible (sin presentaciones agotadas).
    const found = catalogPerfumes.find((p) => p.id === perfumeId);
    if (found) {
      setSelectedPerfume(found);
    }
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    setTabKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Listas dinámicas del inicio: salen únicamente del catálogo administrado
  // en el Panel Admin. `featuredList` = perfumes marcados como destacados.
  // Usamos `catalogPerfumes` para no mostrar presentaciones sin stock.
  const featuredList = catalogPerfumes.filter((p) => p.isBestseller);

  // ── LANDING PAGE PÚBLICA DEL CLIENTE ─────────────────────────────────────
  // Orden visual: Header → contenido según pestaña (Inicio/Catálogo) → Footer → modales.
  // Los clientes NO ven ningún acceso ni botón hacia el panel de administración.
  return (
    <div className="min-h-screen bg-[#050505] text-[#FAF7F0] flex flex-col font-sans selection:bg-[#D4AF37] selection:text-[#050505]">
      {/* Minimalist Top Bar (MaxAroma style: Zone 1 - Zone 2 - Zone 3) */}
      <Header
        activeTab={activeTab}
        onNavigate={handleNavigate}
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onScrollToSection={handleScrollToSection}
      />

      {/* Main Content Router */}
      <main className="flex-1">
        {activeTab === 'inicio' && (
          <div key={`inicio-${tabKey}`} className="page-transition-enter">
            {/* 1. Inicio (Hero): imágenes de los perfumes DESTACADOS del catálogo.
                Si no hay destacados con imagen, el Hero no muestra ninguna imagen.
                Botones: "Ver Catálogo" → pestaña catálogo, "Destacados" → sección destacados. */}
            <Hero
              featuredPerfumes={featuredList}
              onShopClick={() => handleNavigate('catalogo')}
              onExploreFeatured={() => handleScrollToSection('destacados')}
            />

            {/* 2. Fragancias Destacadas: todos los perfumes marcados como destacados,
                con el mismo formato de tarjeta grande y botón "Explorar Fragancia". */}
            {featuredList.length > 0 && (
              <div id="destacados">
                <CampaignBanners
                  perfumes={featuredList}
                  onSelectPerfumeById={handleSelectPerfumeById}
                />
              </div>
            )}

            {/* 3. Carrusel de Catálogo: muestra todo el catálogo.
                "Ver Todo" lleva a la pestaña Catálogo del nav. */}
            {catalogPerfumes.length > 0 && (
              <div id="catalogo-carousel">
                <PerfumeCarousel
                  title="Catálogo"
                  subtitle="Todas Nuestras Fragancias"
                  perfumes={catalogPerfumes}
                  onSelectPerfume={(perfume) => setSelectedPerfume(perfume)}
                  onQuickAdd={handleQuickAdd}
                  onSeeMore={() => handleNavigate('catalogo')}
                  enableScrollReveal={true}
                />
              </div>
            )}


          </div>
        )}

        {activeTab === 'catalogo' && (
          <div key={`catalogo-${tabKey}`} className="page-transition-enter pt-4">
            <Catalog
              perfumes={catalogPerfumes}
              onSelectPerfume={(perfume) => setSelectedPerfume(perfume)}
              onQuickAdd={handleQuickAdd}
              recentlyAddedId={recentlyAddedId}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigate={handleNavigate}
      />

      {/* PDP Modal (FragranceNet Reference 2) */}
      <ProductDetailModal
        perfume={selectedPerfume}
        onClose={() => setSelectedPerfume(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Selector de presentación (ml) al pulsar "Añadir" en tarjetas */}
      <SizeChooserModal
        perfume={sizeChooserPerfume}
        onClose={() => setSizeChooserPerfume(null)}
        onSelect={handleSelectSize}
      />

      {/* Cart & Dominican Checkout Slide-over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onOrderPlaced={handleOrderPlaced}
        onExplore={() => {
          setIsCartOpen(false);
          handleNavigate('catalogo');
        }}
      />

      {/* Instant Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        perfumes={catalogPerfumes}
        onSelectPerfume={(perfume) => setSelectedPerfume(perfume)}
      />

      {/* Order Confirmation */}
      <OrderConfirmationModal
        orderInfo={orderConfirmation}
        onClose={() => setOrderConfirmation(null)}
      />

      {/* Mensaje de confirmación: enviado a la bolsa */}
      {cartToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[70] bg-[#141414] border border-[#D4AF37] text-[#FAF7F0] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 max-w-sm sm:max-w-md"
        >
          <div className="w-8 h-8 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/40 flex items-center justify-center text-[#22c55e] shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider">
              Enviado a la bolsa
            </div>
            <div className="text-xs text-[#FAF7F0] font-medium truncate">
              {cartToast.perfumeName}{' '}
              <span className="text-[#8E8E93]">({cartToast.sizeMl} ml)</span>
            </div>
          </div>
          <button
            onClick={() => {
              setCartToast(null);
              setIsCartOpen(true);
            }}
            className="ml-2 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#FFD76A] text-[#050505] rounded font-semibold text-xs transition-colors shrink-0 cursor-pointer"
          >
            Ver bolsa
          </button>
        </div>
      )}
    </div>
  );
}
