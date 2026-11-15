-- ============================================================
--  PEDIDOS (ÓRDENES) Y SUS ÍTEMS (IDEMPOTENTE)
--  Proyecto: D'Victor Fragancia
--  Ejecutar en: Supabase > SQL Editor (o vía Prisma db execute)
--
--  Guarda los pedidos que los clientes envían por WhatsApp para que el
--  Panel Admin los vea, los confirme con un botón y el stock de cada
--  presentación (ml) baje automáticamente (sin editar nada a mano).
--
--  - `pedidos`      → la cabecera (código, totales, estado...).
--  - `pedido_items` → una fila por perfume/presentación del pedido.
--    `producto_id` apunta a la fila real de `productos` (la presentación
--    concreta) y es lo que permite descontar el stock correcto.
-- ============================================================

-- gen_random_uuid() vive en la extensión pgcrypto.
create extension if not exists "pgcrypto";

create table if not exists public.pedidos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text,
  subtotal           numeric,
  descuento          numeric,
  envio              numeric,
  total              numeric,
  estado             text default 'pendiente',
  origen             text default 'whatsapp',
  fecha_creacion     timestamptz default now(),
  fecha_confirmacion timestamptz
);

create table if not exists public.pedido_items (
  id          bigserial primary key,
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  producto_id bigint references public.productos(id) on delete set null,
  nombre      text,
  marca       text,
  imagen_url  text,
  tamano_ml   smallint,
  precio      numeric,
  cantidad    integer,
  subtotal    numeric
);

create index if not exists idx_pedidos_estado        on public.pedidos (estado);
create index if not exists idx_pedidos_fecha         on public.pedidos (fecha_creacion desc);
create index if not exists idx_pedido_items_pedido   on public.pedido_items (pedido_id);

-- Verificación
select count(*) as pedidos, (select count(*) from public.pedido_items) as items
from public.pedidos;
