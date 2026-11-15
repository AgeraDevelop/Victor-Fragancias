/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/components/SizeChooserModal.tsx
 * QUÉ ES: Selector rápido de presentación (ml). Cuando un perfume tiene varias
 *         presentaciones, al pulsar "Añadir" se abre este modal para que el
 *         cliente elija CUÁL desea comprar, mostrando el precio de cada ml.
 * DÓNDE SE VE: Modal global (Inicio / Catálogo) tras pulsar "Añadir".
 * SE RENDERIZA DESDE: App.tsx (<SizeChooserModal ... />).
 * PROPS: perfume (o null), onClose, onSelect(perfume, sizeMl).
 * QUÉ TOCAR:
 *   - Estilo de cada presentación → bloque "Body".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { Perfume } from '../types';

interface SizeChooserModalProps {
  perfume: Perfume | null;
  onClose: () => void;
  onSelect: (perfume: Perfume, sizeMl: number) => void;
}

export const SizeChooserModal: React.FC<SizeChooserModalProps> = ({
  perfume,
  onClose,
  onSelect,
}) => {
  // Cerrar con la tecla Escape mientras el modal está abierto.
  useEffect(() => {
    if (!perfume) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [perfume, onClose]);

  if (!perfume) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Cabecera: imagen + casa + nombre */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#222]">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={perfume.image}
              alt={perfume.name}
              className="w-12 h-12 rounded object-cover border border-[#262626] shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold block">
                {perfume.house}
              </span>
              <h2 className="font-serif text-lg text-[#FAF7F0] font-normal leading-tight truncate">
                {perfume.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E8E93] hover:text-[#FAF7F0] bg-[#1a1a1a] rounded-full border border-[#333] transition-colors shrink-0"
            aria-label="Cerrar selector de presentación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo: una opción por presentación (ml) con su precio */}
        <div className="p-5">
          <p className="text-xs text-[#B8B8B8] mb-3">
            Este perfume tiene varias presentaciones. ¿Cuál deseas comprar?
          </p>

          <div className="space-y-2">
            {perfume.sizes
              .filter(
                (s) => s.stock === null || s.stock === undefined || s.stock > 0
              )
              .map((s) => (
                <button
                  key={s.ml}
                  onClick={() => onSelect(perfume, s.ml)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-lg border text-left transition-all bg-[#111111] border-[#262626] hover:border-[#D4AF37] hover:bg-[#141414] cursor-pointer"
                >
                  <div>
                    <span className="text-sm font-semibold text-[#FAF7F0] block">
                      {s.ml} ml
                    </span>
                    <span className="text-[10px] text-[#888] block">
                      {(s.ml / 29.57).toFixed(1)} fl. oz.
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold tabular-nums text-[#D4AF37]">
                      RD$ {s.priceDOP.toLocaleString()}
                    </span>
                    <ShoppingBag className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
