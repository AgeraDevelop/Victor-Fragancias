/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/components/CampaignBanners.tsx
 * QUÉ ES: Sección "Fragancias Destacadas". Muestra TODOS los perfumes destacados
 *         (los que el Panel Admin marca como favoritos) usando el mismo formato
 *         de tarjeta grande con el botón "Explorar Fragancia". Se arma
 *         dinámicamente con el prop `perfumes`; si no hay, no se renderiza nada.
 * DÓNDE SE VE: Inicio → bloque "Fragancias Destacadas".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { Perfume } from '../types';
import { Reveal } from './Reveal';

interface CampaignBannersProps {
  perfumes: Perfume[];
  onSelectPerfumeById: (perfumeId: string) => void;
}

const FALLBACK_IMAGE = '/assets/images/hero_luxury_perfume_1793299734093.jpg';

const notesLine = (perfume: Perfume) =>
  perfume.topNotes.slice(0, 3).join(' · ') || perfume.family;

export const CampaignBanners: React.FC<CampaignBannersProps> = ({
  perfumes,
  onSelectPerfumeById,
}) => {
  // Sin perfumes destacados no hay nada que mostrar.
  if (!perfumes || perfumes.length === 0) return null;

  return (
    <div className="space-y-10 py-8 bg-[#050505]">
      {/* Divider con shimmer dorado animado */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="gold-shimmer-line" />
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado de sección */}
        <Reveal className="text-center mb-8">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-sans font-semibold">
            Campañas Exclusivas
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#FAF7F0] mt-2 font-normal">
            Fragancias <span className="italic">Destacadas</span>
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {perfumes.map((perfume, index) => (
            <Reveal
              key={perfume.id}
              direction={index % 2 === 0 ? 'left' : 'right'}
              delay={0.1 + (index % 2) * 0.1}
            >
              <div
                onClick={() => onSelectPerfumeById(perfume.id)}
                className="hover-gold-glow group relative aspect-[4/3] sm:aspect-[16/11] rounded-lg overflow-hidden cursor-pointer bg-[#0c0c0c] border border-[#222] hover:border-[#D4AF37]/50 shadow-xl"
              >
                <img
                  src={perfume.image || FALLBACK_IMAGE}
                  alt={`${perfume.house} ${perfume.name}`}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-center flex flex-col items-center">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] font-sans font-semibold text-[#D4AF37] mb-1.5">
                    {perfume.category === 'Nicho' ? 'Alta Perfumería de Autor' : 'Descubrir Novedades'}
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#FAF7F0] font-normal leading-tight">
                    {perfume.house.toUpperCase()}: <span className="italic">{perfume.name}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-[#F5E6B3] font-sans mt-1.5 max-w-sm font-light">
                    {notesLine(perfume)}
                  </p>
                  <div className="mt-4">
                    <span className="btn-impact inline-block px-5 py-2 border border-[#D4AF37]/60 group-hover:border-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-[#050505] text-[#FAF7F0] text-xs font-sans tracking-widest uppercase transition-all duration-300">
                      Explorar Fragancia
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
};
