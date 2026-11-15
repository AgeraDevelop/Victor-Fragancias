/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/components/ProductDetailModal.tsx
 * QUÉ ES: Ficha completa del perfume (PDP): galería, tallas,
 *         cantidad, botón de bolsa y pirámide de notas.
 * DÓNDE SE VE: Modal que se abre al pulsar cualquier perfume.
 * SE RENDERIZA DESDE: App.tsx (<ProductDetailModal ... />).
 * PROPS: perfume (o null), onClose, onAddToCart.
 * QUÉ TOCAR:
 *   - Tallas → map de `perfume.sizes`.
 *   - Cantidad → estado `quantity`.
 *   - Notas aromáticas → bloques "Top / Heart / Base Notes".
 *
 * Los hooks se ejecutan antes del retorno condicional para conservar su orden.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, Truck, Check, ShieldCheck } from 'lucide-react';
import { Perfume, PerfumeSize } from '../types';

interface ProductDetailModalProps {
  perfume: Perfume | null;
  onClose: () => void;
  onAddToCart: (perfume: Perfume, sizeMl: number, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  perfume,
  onClose,
  onAddToCart,
}) => {
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAddedFeedback, setIsAddedFeedback] = useState(false);

  // Al cambiar de perfume, reiniciamos la presentación y la cantidad.
  useEffect(() => {
    setSelectedSizeIndex(0);
    setQuantity(1);
  }, [perfume?.id]);

  // Al cambiar de presentación, la cantidad vuelve a 1 (cada ml tiene su stock).
  useEffect(() => {
    setQuantity(1);
  }, [selectedSizeIndex]);

  if (!perfume) return null;

  const currentSize: PerfumeSize = perfume.sizes[selectedSizeIndex] || perfume.sizes[0];

  // Stock disponible de LA PRESENTACIÓN seleccionada (null = sin límite).
  const sizeStock = currentSize?.stock;
  const stockLimit =
    sizeStock === null || sizeStock === undefined ? Infinity : Math.max(0, sizeStock);
  const outOfStock = stockLimit <= 0;
  const atMaxStock = quantity >= stockLimit;

  const handleAddToCart = () => {
    onAddToCart(perfume, currentSize.ml, quantity);
    setIsAddedFeedback(true);
    setTimeout(() => setIsAddedFeedback(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
    >
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      <div className="relative bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl max-w-5xl w-full max-h-[94vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-[#B8B8B8] hover:text-[#FAF7F0] bg-[#1a1a1a] rounded-full border border-[#333] transition-colors"
          aria-label="Cerrar ventana de producto"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Breadcrumb Bar (FragranceNet style: Reference 2) */}
        <div className="px-6 py-3 border-b border-[#222] bg-[#080808] text-[11px] font-sans text-[#888] flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
          <button onClick={onClose} className="hover:text-[#D4AF37]">
            INICIO
          </button>
          <span>/</span>
          <span className="hover:text-[#D4AF37]">FRAGANCIAS</span>
          <span>/</span>
          <span className="uppercase text-[#B8B8B8]">{perfume.house}</span>
          <span>/</span>
          <span className="text-[#FAF7F0] font-medium uppercase">{perfume.name}</span>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Column: FragranceNet Style Gallery */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="relative w-full aspect-[4/5] bg-[#080808] rounded-lg border border-[#222] overflow-hidden flex items-center justify-center p-4">
              <img
                src={perfume.image}
                alt={perfume.name}
                className="w-full h-full object-cover rounded-md"
                referrerPolicy="no-referrer"
              />

              <span className="absolute bottom-3 right-3 text-[10px] uppercase font-sans tracking-wider px-2 py-0.5 bg-[#050505]/90 text-[#D4AF37] border border-[#D4AF37]/40 rounded">
                {perfume.gender}
              </span>
            </div>

            {/* Authenticity Certificate Box */}
            <div className="mt-4 w-full p-3 bg-[#080808] border border-[#222] rounded text-xs text-[#B8B8B8] flex items-center">
              <span className="flex items-center gap-1.5 text-[#D4AF37] font-semibold text-[11px]">
                <ShieldCheck className="w-4 h-4" />
                100% Original
              </span>
            </div>
          </div>

          {/* Right Column: Pricing, Size Selection & Purchase (Reference 2) */}
          <div className="md:col-span-7 flex flex-col justify-between">
            <div>
              {/* Brand House */}
              <span className="text-xs uppercase tracking-[0.25em] font-sans font-bold text-[#D4AF37] block mb-1">
                {perfume.house}
              </span>

              {/* Fragrance Full Title */}
              <h1 className="font-serif text-2xl sm:text-3xl text-[#FAF7F0] font-normal leading-tight mb-1">
                {perfume.name}
              </h1>

              {/* Subtitle / Concentration */}
              <p className="text-xs text-[#B8B8B8] font-sans mb-3">
                {perfume.concentration} · {currentSize.ml} ml (Presentación Oficial en Caja)
              </p>

              {/* Size Option Boxes (FragranceNet Reference 2: 2x2 grid of presentations) */}
              <div className="mb-6">
                <label className="block text-[11px] uppercase tracking-wider font-sans text-[#D4AF37] font-semibold mb-2">
                  Selecciona tu Presentación:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {perfume.sizes.map((s, idx) => {
                    return (
                      <button
                        key={s.ml}
                        onClick={() => setSelectedSizeIndex(idx)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          selectedSizeIndex === idx
                            ? 'bg-[#141414] border-[#D4AF37] ring-1 ring-[#D4AF37]'
                            : 'bg-[#080808] border-[#222] hover:border-[#444]'
                        }`}
                      >
                        <span className="text-xs font-semibold text-[#FAF7F0] block">
                          {s.ml} ml
                        </span>
                        <span className="text-[10px] text-[#888] block">
                          {(s.ml / 29.57).toFixed(1)} fl. oz.
                        </span>
                        <span className="font-mono text-xs font-bold text-[#D4AF37] mt-1 block tabular-nums">
                          RD$ {s.priceDOP.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stepper + Primary Add to Bag Button */}
              <div className="space-y-3 mb-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                  {/* Stepper */}
                  <div className="flex items-center bg-[#080808] border border-[#2a2a2a] rounded px-3 py-2 text-xs">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="text-[#888] hover:text-[#FAF7F0] px-1 text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="px-3 font-mono text-[#FAF7F0] tabular-nums font-semibold">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(q + 1, stockLimit))}
                      disabled={atMaxStock}
                      title={atMaxStock ? 'No hay más disponibles' : 'Agregar una unidad'}
                      className={`px-1 text-sm font-bold ${
                        atMaxStock ? 'text-[#444] cursor-not-allowed' : 'text-[#888] hover:text-[#FAF7F0]'
                      }`}
                    >
                      +
                    </button>
                  </div>

                  {/* Primary Add to Bag CTA */}
                  <button
                    onClick={handleAddToCart}
                    disabled={outOfStock}
                    className={`flex-1 py-3.5 px-6 rounded font-sans text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                      outOfStock
                        ? 'bg-[#2a2a2a] text-[#777] cursor-not-allowed'
                        : isAddedFeedback
                          ? 'bg-[#22c55e] text-white cursor-pointer'
                          : 'bg-[#D4AF37] hover:bg-[#FFD76A] text-[#050505] shadow-[0_4px_16px_rgba(212,175,55,0.3)] cursor-pointer'
                    }`}
                  >
                    {outOfStock ? (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>NO DISPONIBLE</span>
                      </>
                    ) : isAddedFeedback ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>¡Agregado a la Bolsa!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>AÑADIR A LA BOLSA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Free Shipping & Payments Banner (Reference 2) */}
              <div className="p-3 bg-[#080808] border border-[#222] rounded text-xs text-[#B8B8B8] space-y-1">
                <div className="flex items-center gap-2 text-[#FAF7F0] font-semibold text-[11px]">
                  <Truck className="w-4 h-4 text-[#D4AF37]" />
                  <span>ENVÍO EXPRESS</span>
                </div>
                <p className="text-[10px] text-[#888]">
                  Paga contra entrega en Santo Domingo o vía transferencia.
                </p>
              </div>

              {/* Visual Olfactory Notes Section (Reference 2: FragranceNet Top / Heart / Base Notes with badges) */}
              <div className="mt-6 pt-5 border-t border-[#222] space-y-3">
                <span className="text-[11px] uppercase tracking-wider font-sans text-[#D4AF37] font-semibold block">
                  Pirámide de Notas Aromáticas:
                </span>

                {/* Top Notes */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                  <span className="w-28 uppercase text-[10px] tracking-wider text-[#888] font-semibold shrink-0">
                    NOTAS DE SALIDA:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {perfume.topNotes.map((note, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-[#141414] border border-[#2a2a2a] text-[#FAF7F0] text-[11px] flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#FFD76A]" />
                        <span>{note}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Heart Notes */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                  <span className="w-28 uppercase text-[10px] tracking-wider text-[#888] font-semibold shrink-0">
                    NOTAS DE CORAZÓN:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {perfume.heartNotes.map((note, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-[#141414] border border-[#2a2a2a] text-[#FAF7F0] text-[11px] flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                        <span>{note}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Base Notes */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                  <span className="w-28 uppercase text-[10px] tracking-wider text-[#888] font-semibold shrink-0">
                    NOTAS DE FONDO:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {perfume.baseNotes.map((note, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-[#141414] border border-[#2a2a2a] text-[#FAF7F0] text-[11px] flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#888]" />
                        <span>{note}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
