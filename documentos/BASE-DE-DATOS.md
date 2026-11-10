# Esquema corregido de Supabase

El archivo que corresponde a la solicitud actual es
[`supabase-esquema.sql`](../base-de-datos/supabase-esquema.sql).
Contiene diez tablas activas, sus relaciones, permisos, políticas RLS y una
vista `catalogo_frontend` con los nombres de campos del frontend.

## Instalación

1. Usar un proyecto Supabase sin las tablas de esta tienda.
2. Copiar el archivo completo al SQL Editor y ejecutarlo una sola vez.
3. Importar el catálogo conservando los identificadores del frontend en
   `productos.slug`, las rutas de imágenes y el orden de las presentaciones.

Es una instalación inicial, no una migración. Si ya ejecutaste otro esquema,
necesitas una migración específica para conservar los datos existentes.
No ejecutes todos los archivos SQL de esta carpeta consecutivamente.

`supabase_schema.sql` y `tienda_perfumes_supabase.sql` son versiones anteriores:
mantienen pedidos y cupones activos y no sustituyen al archivo corregido.
`supabase_seeds.sql` fue preparado para `tienda_perfumes_supabase.sql`; no se
incluye en esta instalación ni se garantiza que reproduzca el catálogo actual.
Se conservan estos archivos existentes sin modificarlos.

## Pedidos y cupones

Las tablas `cupones`, `pedidos` e `items_pedido`, junto con sus índices,
secuencias, permisos, políticas y cupones iniciales, están dentro de un único
comentario al final del archivo corregido. No se crean al ejecutarlo completo.

Cuando se implemente esta funcionalidad, copiar el contenido entre
`INICIO_MODULO_FUTURO` y `FIN_MODULO_FUTURO` al SQL Editor y ejecutarlo una vez,
sin los delimitadores `/*` y `*/`. El bloque incluye `begin` y `commit`.
Esto habilita las tablas; el backend todavía deberá validar precios, stock,
descuentos y pagos, y crear el pedido con sus artículos en una transacción.

## Alcance y verificación

El frontend sigue usando su catálogo local y localStorage. Este archivo no
implementa su conexión con Supabase ni añade Prisma al proyecto.
La vista facilita la futura integración y distingue productos nuevos de los
más vendidos; los promedios solo incluyen reseñas aprobadas.

El esquema y el bloque futuro se probaron en PostgreSQL temporal mediante
PGlite, simulando los roles y las funciones de autenticación de Supabase.
Se verificaron también aislamiento de carritos, permisos de perfiles y
visibilidad del catálogo. No se ejecutó el archivo en una base de datos real.
