# Arquitectura y organización

## Estructura

```text
dvictor-fragancia/
├── Frontend/
│   ├── index.html
│   ├── metadata.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── scripts/clean.mjs
│   ├── public/assets/
│   │   ├── images/        Imágenes del catálogo, hero y campañas
│   │   ├── logos/         Logos servidos por la web
│   │   ├── Img/           Fotografías originales conservadas
│   │   └── aistudio/      Recursos originales conservados
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types.ts
│       ├── components/
│       ├── data/perfumes.ts
│       └── assets/logos/  Copias originales conservadas
├── backend/              Reservado; sin servidor implementado
├── base-de-datos/
│   └── prisma/           Reservado; sin esquema, cliente ni migraciones
├── documentos/
├── package.json
├── package-lock.json
├── README.md
├── LICENSE
└── .gitignore
```

## Conexiones actuales

1. Los scripts del `package.json` raíz seleccionan `Frontend/vite.config.ts`.
2. Vite usa `Frontend/` como raíz de la aplicación y abre `Frontend/index.html`.
3. La URL `/src/main.tsx` del HTML se resuelve dentro de `Frontend/`; monta
   `App.tsx`, importa los estilos y conecta los componentes mediante imports relativos.
4. `Frontend/src/data/perfumes.ts` proporciona el catálogo estático, las casas y
   las provincias. Es información de demostración usada directamente en el
   navegador, por eso permanece en el frontend; no es una base de datos.
5. `Frontend/public/` sirve las URLs públicas sin incluir el nombre de la carpeta.
   `/assets/images/...` y `/assets/logos/...` funcionan en desarrollo y producción.
6. El alias `@` de Vite apunta a `Frontend/`, en concordancia con `@/*` de
   `Frontend/tsconfig.json`. Por ejemplo, `@/src/types` resuelve los tipos de la app.
7. Los archivos `.env*`, las dependencias y `dist/` permanecen en la raíz del
   repositorio. El comando `lint` selecciona explícitamente el proyecto TypeScript
   del frontend. Tailwind procesa sus componentes y estilos durante el build.
8. El carrito vive solo en memoria durante la sesión: el proyecto no usa
   `localStorage` ni `sessionStorage`. Al recargar la página la bolsa se vacía.

## Backend y base de datos

El backend Express vive en `backend/` (rutas, controladores, repositorios y
utilidades) y Prisma en `base-de-datos/prisma/schema.prisma`. La base de datos
es PostgreSQL en Supabase; el servidor es el único que la consulta y el frontend
consume la API REST en `http://localhost:4000/api`.

### Imágenes de los productos

Las imágenes de los productos se guardan **dentro de la base de datos**, no como
archivos en el frontend. Hay dos formas de cargarlas y **ambas terminan con los
bytes en la BD**:

- **Subir un archivo** desde el equipo → el Admin lo envía como base64
  (`imagen_base64` + `imagen_mime`).
- **Pegar una URL de internet** → el backend la **descarga** (`utils/image.ts` →
  `downloadImage`) y guarda los bytes. Así no hay que descargar el archivo a
  mano, pero la imagen queda alojada en la BD y no depende de la web externa.

#### Procesamiento automático con Sharp

Al subir o descargar una imagen, el backend la procesa con **Sharp** (`utils/image.ts`
→ `processProductImage`) antes de guardarla en la BD:

1. **Auto-orientación**: corrige la rotación según datos EXIF de la cámara/teléfono.
2. **Detección inteligente del tipo de imagen**:
   - **Producto aislado** (fondo sólido o transparente): recorta los márgenes
     vacíos (trim) y centra el frasco dentro de márgenes seguros (840×756 px
     dentro de un lienzo de 1200×900). Así el producto nunca se corta en
     ninguna vista del frontend (4:3 catálogo, 3:4 carrusel, 4:5 modal, 1:1 admin).
   - **Fotografía escénica** (campaña, lifestyle): ajusta proporcionalmente con
     cover o contain según la proporción original.
3. **Conversión a WebP** optimizado (calidad 85), reduciendo el peso
   drásticamente (de ~800 KB JPEG a ~50-150 KB WebP).

#### Thumbnails al vuelo

El endpoint `GET /api/productos/:id/imagen` acepta query params opcionales para
servir versiones redimensionadas sin duplicar datos en la BD:

- `?w=200` → ancho máximo 200 px (mantiene proporción)
- `?h=200` → alto máximo 200 px
- `?w=200&h=200` → ambos máximos (fit: inside)
- Sin params → imagen completa 1200×900

Detalles:

- Columnas en `productos`: `imagen_data` (`bytea` con los bytes) e `imagen_mime`
  (tipo MIME; las nuevas se guardan como `image/webp`).
- `imagen_url` se conserva solo para rutas relativas antiguas; cuando la imagen
  se descarga/sube, queda en `null` porque ya vive en la BD.
- El backend valida tipo (JPG/PNG/WEBP/GIF/AVIF, detectado también por firma
  binaria) y tamaño (máx. 8 MB antes de procesar).
- La imagen se sirve por `GET /api/productos/:id/imagen`. En las respuestas, el
  campo `imagen_url` apunta a ese endpoint cuando el producto tiene imagen en BD
  (`has_db_image: true`).
- Si la URL externa bloquea la descarga (algunos sitios lo hacen), la API
  responde con un mensaje claro y el producto no se modifica.
- El SQL idempotente que agrega las columnas está en
  `base-de-datos/sql/add-producto-imagen.sql`.
