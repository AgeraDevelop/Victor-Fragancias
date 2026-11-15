-- ============================================================
--  RESET DE USUARIOS + SUPERADMIN (IDEMPOTENTE)
--  Proyecto: D'Victor Fragancia
--  Ejecutar en: Supabase > SQL Editor
--
--  Usuario resultante:  admin
--  Contrasena:          dvictor2026
--
--  IMPORTANTE: la contrasena se guarda con scrypt (salt:hash),
--  no con bcrypt/crypt() de Postgres. Por eso el hash va fijo.
--  Si cambias la contrasena, generala con:
--    node -e "const c=require('crypto');const p=process.argv[1];const s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync(p,s,64).toString('hex'))" "NUEVA_CLAVE"
-- ============================================================

begin;

-- 1) Quitar referencias de productos para no romper la FK
update public.productos
set usuario_id = null
where usuario_id is not null;

-- 2) Borrar TODOS los usuarios de la aplicacion
delete from public.usuarios;

-- 3) Asegurar los roles (SuperAdmin = 1, Administrador = 2)
insert into public.roles (id, nombre, descripcion)
values
  (1, 'SuperAdmin',    'Dueno de la tienda con control total del sistema y gestion de usuarios'),
  (2, 'Administrador', 'Administrador con acceso a catalogo y productos')
on conflict (id) do update
  set nombre      = excluded.nombre,
      descripcion = excluded.descripcion;

select setval(
  pg_get_serial_sequence('public.roles', 'id'),
  greatest((select coalesce(max(id), 1) from public.roles), 1)
);

-- 4) Crear el usuario SuperAdmin (password: dvictor2026)
insert into public.usuarios (nombre, email, password_hash, rol_id, activo)
values (
  'Victor (Dueno)',
  'admin',
  '7b6125f6d4da8faa137b92f87e29d143:e097b474ef9494027d0e7fd3d84adbc6696e6238d84fe90d715902c8380154bfa3cdc79030382da54d66059f0ba32c866e3b447c5f43ecb3eb95de78e7f8e554',
  1,
  true
);

commit;

-- ============================================================
--  VERIFICACION
-- ============================================================
select u.id, u.nombre, u.email, r.nombre as rol, u.activo, u.fecha_creacion
from public.usuarios u
left join public.roles r on r.id = u.rol_id
order by u.fecha_creacion;

select count(*) as total_usuarios from public.usuarios;
