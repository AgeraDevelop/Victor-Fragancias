/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/components/Header.tsx
 * QUÉ ES: Barra superior fija. Logo, menú de navegación, buscador,
 *         indicador de moneda, bolsa y menú móvil.
 * DÓNDE SE VE: Arriba de todas las páginas (sticky).
 * SE RENDERIZA DESDE: App.tsx (<Header ... />).
 * PROPS: activeTab, onNavigate, cartCount, onOpenCart, onOpenSearch,
 *        onOpenBrandSystem, onOpenQuiz, onScrollToSection.
 * QUÉ TOCAR:
 *   - Enlaces del menú de escritorio → "Zone 2".
 *   - Botones de buscar / bolsa → "Zone 3".
 *   - Menú móvil → bloque "Mobile Drawer Navigation".
 *   - Para agregar una pestaña nueva, añade el botón y su caso en
 *     `handleNavClick`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import { ShoppingBag, Search, Menu, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  onOpenSearch: () => void;
  onOpenBrandSystem?: () => void;
  onOpenQuiz?: () => void;
  onScrollToSection?: (sectionId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNavigate,
  cartCount,
  onOpenCart,
  onOpenSearch,
  onOpenBrandSystem,
  onOpenQuiz,
  onScrollToSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (sectionOrTab: string) => {
    if (sectionOrTab === 'catalogo') {
      onNavigate(sectionOrTab);
    } else if (onScrollToSection && sectionOrTab === 'destacados') {
      if (activeTab !== 'inicio') {
        onNavigate('inicio');
        setTimeout(() => onScrollToSection(sectionOrTab), 150);
      } else {
        onScrollToSection(sectionOrTab);
      }
    } else {
      onNavigate('inicio');
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-md border-b border-[#1f1f1f]">
      {/* Main Top Bar (MaxAroma Style: Logo — Nav — Search & Bag) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Logo */}
        <button
          onClick={() => handleNavClick('inicio')}
          className="flex items-center text-left whitespace-nowrap shrink-0 group focus:outline-none cursor-pointer"
          aria-label="D’ Victor Fragancias Inicio"
        >
          <BrandLogo variant="horizontal" size="md" />
        </button>

        {/* Zone 2: Clean Minimalist Nav Links (MaxAroma reference 1) */}
        <nav className="hidden lg:flex items-center gap-6 text-[11px] uppercase tracking-[0.18em] font-medium font-sans">
          <button
            onClick={() => handleNavClick('inicio')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === 'inicio' ? 'text-[#D4AF37]' : 'text-[#B8B8B8] hover:text-[#FAF7F0]'
            }`}
          >
            Inicio
          </button>
          <button
            onClick={() => handleNavClick('catalogo')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === 'catalogo' ? 'text-[#D4AF37]' : 'text-[#B8B8B8] hover:text-[#FAF7F0]'
            }`}
          >
            Catálogo
          </button>
          <button
            onClick={() => handleNavClick('destacados')}
            className="whitespace-nowrap shrink-0 text-[#B8B8B8] hover:text-[#FAF7F0] transition-colors py-1"
          >
            Destacados
          </button>
        </nav>

        {/* Zone 3: Search Bar & Bag */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Quick Search Button / Input */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-[#111] hover:bg-[#191919] border border-[#2a2a2a] rounded-md text-xs text-[#888] hover:text-[#FAF7F0] transition-colors cursor-pointer"
            aria-label="Buscar fragancias"
          >
            <Search className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="hidden sm:inline text-[11px]">Buscar fragancia...</span>
          </button>

          {/* Shopping Bag Button (MaxAroma style) */}
          <button
            onClick={onOpenCart}
            className="btn-impact flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-[#D4AF37] hover:bg-[#FFD76A] text-[#050505] rounded-md font-sans text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shrink-0"
            aria-label="Abrir carrito"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Bolsa</span>
            <span className="bg-[#050505] text-[#FAF7F0] text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums">
              {cartCount}
            </span>
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-[#FAF7F0] hover:text-[#D4AF37] transition-colors"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0a0a0a] border-b border-[#222] px-6 py-4 space-y-3 font-sans text-xs uppercase tracking-wider">
          <button
            onClick={() => handleNavClick('inicio')}
            className="block w-full text-left py-1.5 text-[#FAF7F0]"
          >
            Inicio
          </button>
          <button
            onClick={() => handleNavClick('catalogo')}
            className="block w-full text-left py-1.5 text-[#FAF7F0]"
          >
            Catálogo Completo
          </button>
          <button
            onClick={() => handleNavClick('destacados')}
            className="block w-full text-left py-1.5 text-[#B8B8B8]"
          >
            Destacados
          </button>
        </div>
      )}
    </header>
  );
};
