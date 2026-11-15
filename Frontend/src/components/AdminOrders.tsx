/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/components/AdminOrders.tsx
 * QUÉ ES: Panel de PEDIDOS del administrador.
 *         Muestra los pedidos que los clientes enviaron por WhatsApp (con sus
 *         perfumes) y permite CONFIRMARLOS con un botón: al confirmar, el
 *         backend descuenta el stock solo (no hay que editar nada a mano).
 * DÓNDE SE VE: Pestaña "Pedidos" del Panel Admin (/admin).
 * SE RENDERIZA DESDE: AdminPage.tsx (<AdminOrders ... />).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { realtime } from '../services/realtimeService';

interface AdminOrdersProps {
  /** Se llama tras confirmar (baja stock) para que el catálogo se refresque. */
  onProductsChanged?: () => void;
  /** Notifica cuántos pedidos quedan pendientes (para el badge de la pestaña). */
  onPendingCountChange?: (count: number) => void;
}

type FilterKey = 'pendientes' | 'confirmados' | 'todos';

const STATUS_STYLES: Record<string, string> = {
  pendiente: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  confirmado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  pagado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  enviado: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  entregado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  cancelado: 'bg-red-500/15 text-red-400 border-red-500/40',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  pagado: 'Pagado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};


export const AdminOrders: React.FC<AdminOrdersProps> = ({
  onProductsChanged,
  onPendingCountChange,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('pendientes');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cancelPromptOrderId, setCancelPromptOrderId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await orderService.getOrders();
      setOrders(data);
      onPendingCountChange?.(data.filter((o) => o.status === 'pendiente').length);
    } catch (error: any) {
      console.error('Error al cargar los pedidos:', error);
      showToast('No se pudieron cargar los pedidos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Sincronización en tiempo real: si un cliente envía un pedido por WhatsApp,
    // se muestra en tiempo real sin tener que recargar la página.
    const unsubscribe = realtime.on('orders_updated', () => {
      loadOrders();
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async (order: Order) => {
    setWorkingId(order.id);
    try {
      await orderService.confirmOrder(order.id);
      showToast(`Pedido ${order.codigo || ''} confirmado. El stock se actualizó.`);
      await loadOrders();
      onProductsChanged?.();
    } catch (error: any) {
      alert(error.message || 'No se pudo confirmar el pedido.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleExecuteCancel = async (order: Order) => {
    setWorkingId(order.id);
    try {
      await orderService.cancelOrder(order.id);
      showToast(`Pedido ${order.codigo || ''} cancelado.`);
      setCancelPromptOrderId(null);
      await loadOrders();
    } catch (error: any) {
      showToast(error.message || 'No se pudo cancelar el pedido.');
    } finally {
      setWorkingId(null);
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'pendiente').length;
  const confirmedCount = orders.filter(
    (o) => o.status === 'confirmado' || o.status === 'pagado' || o.status === 'entregado'
  ).length;

  const filteredOrders = orders.filter((o) => {
    if (filter === 'pendientes') return o.status === 'pendiente';
    if (filter === 'confirmados')
      return o.status === 'confirmado' || o.status === 'pagado' || o.status === 'entregado';
    return true;
  });

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'pendientes', label: 'Pendientes', count: pendingCount },
    { key: 'confirmados', label: 'Confirmados', count: confirmedCount },
    { key: 'todos', label: 'Todos', count: orders.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141414] border border-[#D4AF37] text-[#FAF7F0] px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] uppercase tracking-widest mb-1">
            <ClipboardList className="w-4 h-4" />
            <span>Panel de Administración D’ Victor</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#FAF7F0] font-normal tracking-wide">
            Pedidos de la Tienda
          </h1>
          <p className="text-xs text-[#8E8E93] mt-1">
            Pedidos enviados por WhatsApp. Al pulsar <strong className="text-[#D4AF37]">Confirmar</strong> el stock de cada presentación baja automáticamente.
          </p>
        </div>

        <button
          onClick={loadOrders}
          title="Recargar pedidos"
          className="self-start md:self-auto p-2.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-md text-[#B8B8B8] hover:text-[#FAF7F0] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 py-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium border transition-all cursor-pointer ${
              filter === f.key
                ? 'bg-[#D4AF37]/10 border-[#D4AF37]/50 text-[#D4AF37]'
                : 'bg-[#141414] border-[#262626] text-[#999] hover:text-[#FAF7F0]'
            }`}
          >
            <span>{f.label}</span>
            <span className="font-mono text-[10px] bg-black/40 border border-white/10 rounded-full px-1.5 py-0.5">
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-20 text-center text-[#8E8E93] text-sm">
          <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-[#D4AF37]" />
          Cargando pedidos...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-20 text-center">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-[#333]" />
          <p className="font-serif text-lg text-[#FAF7F0]">No hay pedidos aquí</p>
          <p className="text-xs text-[#8E8E93] mt-1">
            Cuando un cliente envíe un pedido por WhatsApp, aparecerá en esta lista.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const isPending = order.status === 'pendiente';
            const isWorking = workingId === order.id;
            const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;

            return (
              <div
                key={order.id}
                className="bg-[#0d0d0d] border border-[#262626] rounded-xl overflow-hidden"
              >
                {/* Card header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#111111] border-b border-[#1f1f1f]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div>
                      <div className="font-mono text-sm text-[#FAF7F0] font-semibold">
                        {order.codigo || `#${order.id.slice(0, 8)}`}
                      </div>
                      <div className="text-[11px] text-[#8E8E93]">
                        {formatDate(order.createdAt)}
                        {order.confirmedAt ? ` · Confirmado: ${formatDate(order.confirmedAt)}` : ''}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusStyle}`}
                  >
                    {isPending ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5">
                  {/* Items */}
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
                      Perfumes del pedido
                    </div>
                    <div className="space-y-1.5">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${order.id}-${idx}`}
                          className="flex items-center gap-3 p-2 bg-[#080808] border border-[#1f1f1f] rounded-lg"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.perfumeName}
                              className="w-10 h-10 object-cover rounded bg-[#111] border border-[#262626] shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-[#111] border border-[#262626] shrink-0 flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-[#444]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[#FAF7F0] truncate">
                              {item.perfumeName}
                            </div>
                            <div className="text-[11px] text-[#8E8E93]">
                              {item.house ? `${item.house} · ` : ''}
                              {item.sizeMl} ml
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono text-[#FAF7F0] tabular-nums">
                              {item.quantity} × RD$ {item.priceDOP.toLocaleString()}
                            </div>
                            <div className="text-[11px] font-mono text-[#D4AF37] tabular-nums">
                              RD$ {(item.subtotal ?? item.priceDOP * item.quantity).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totals + actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[#1f1f1f]">
                      <div className="text-sm">
                        <span className="text-[#8E8E93] text-xs mr-2">Total del pedido</span>
                        <span className="font-mono text-lg font-bold text-[#D4AF37] tabular-nums">
                          RD$ {order.total.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <>
                            {cancelPromptOrderId === order.id ? (
                              <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-red-950/40 border border-red-700/60 rounded-lg text-xs animate-in fade-in duration-150">
                                <span className="text-red-200">
                                  ¿Cancelar el pedido <strong className="text-white">{order.codigo || ''}</strong>? No se modificará el stock.
                                </span>
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <button
                                    onClick={() => handleExecuteCancel(order)}
                                    disabled={isWorking}
                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {isWorking ? 'Cancelando...' : 'Sí, cancelar'}
                                  </button>
                                  <button
                                    onClick={() => setCancelPromptOrderId(null)}
                                    disabled={isWorking}
                                    className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#262626] text-[#B8B8B8] hover:text-[#FAF7F0] border border-[#333] rounded text-[11px] transition-colors cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setCancelPromptOrderId(order.id)}
                                disabled={isWorking}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-950/20 hover:bg-red-950/50 text-red-400 border border-red-900/40 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancelar
                              </button>
                            )}

                            {cancelPromptOrderId !== order.id && (
                              <button
                                onClick={() => handleConfirm(order)}
                                disabled={isWorking}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#B38F24] hover:from-[#FFD76A] hover:to-[#D4AF37] text-[#050505] rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-300 shadow-[0_4px_14px_rgba(212,175,55,0.25)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {isWorking ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Confirmar y bajar stock
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-[#8E8E93] italic">
                            {order.status === 'cancelado'
                              ? 'Pedido cancelado'
                              : 'Stock ya descontado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
