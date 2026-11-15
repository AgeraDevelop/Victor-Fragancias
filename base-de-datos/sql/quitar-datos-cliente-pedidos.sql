-- ============================================================
--  ELIMINAR DATOS INNECESARIOS DE CLIENTE/PAGO EN PEDIDOS
--  Proyecto: D'Victor Fragancia
--  Ejecutar en: Supabase > SQL Editor
--
--  Los pedidos se envían por WhatsApp (los datos de cliente,
--  teléfono, dirección y método de pago se tratan directamente
--  por WhatsApp, no se guardan en la base de datos).
-- ============================================================

ALTER TABLE public.pedidos
  DROP COLUMN IF EXISTS cliente_nombre,
  DROP COLUMN IF EXISTS cliente_telefono,
  DROP COLUMN IF EXISTS cliente_email,
  DROP COLUMN IF EXISTS provincia,
  DROP COLUMN IF EXISTS sector,
  DROP COLUMN IF EXISTS direccion,
  DROP COLUMN IF EXISTS tipo_entrega,
  DROP COLUMN IF EXISTS metodo_pago,
  DROP COLUMN IF EXISTS notas,
  DROP COLUMN IF EXISTS usuario_id;
