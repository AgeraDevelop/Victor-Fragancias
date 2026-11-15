-- ============================================================
--  IMAGEN DE PRODUCTOS EN LA BASE DE DATOS (IDEMPOTENTE)
--  Proyecto: D'Victor Fragancia
--  Ejecutar en: Supabase > SQL Editor (o vía Prisma db execute)
--
--  Guarda la imagen subida desde el Panel Admin como bytes (bytea)
--  directamente en la tabla `productos`, más su tipo MIME.
--  La imagen se sirve por:  GET /api/productos/:id/imagen
-- ============================================================

alter table public.productos
  add column if not exists imagen_mime text;

alter table public.productos
  add column if not exists imagen_data bytea;

-- Verificación
select id, nombre, imagen_mime,
       case when imagen_data is null then 0 else octet_length(imagen_data) end as imagen_bytes
from public.productos
order by id;
