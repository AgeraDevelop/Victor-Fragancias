# Despliegue en Vercel (frontend) + Render (backend)

Arquitectura:

```
Vercel  →  Frontend estático (React + Vite)  →  dist/
Render  →  API Express + Prisma (Node)       →  /api/*
Supabase → PostgreSQL
```

## 1. Backend en Render

El repo incluye `render.yaml` (Blueprint). En Render:

1. **New → Blueprint** y conecta `AgeraDevelop/Victor-Fragancias`.
2. Render detecta `render.yaml` y crea el servicio `victor-fragancias-api`.
3. Configura las variables que piden valor:
   - `DATABASE_URL`: URI de **Connection Pooler** de Supabase
     (puerto `6543`, añade `?pgbouncer=true&connection_limit=1`).
   - `CORS_ORIGIN`: la URL de Vercel, ej. `https://victor-fragancias.vercel.app`.
   - `JWT_SECRET` se genera solo.
4. Deploy. Comprueba `https://TU-SERVICIO.onrender.com/api/health`.

Comandos que usa el servicio:

| Paso | Comando |
|---|---|
| Build | `npm ci --include=dev && npm run prisma:generate` |
| Start | `npm start` (`tsx backend/src/server.ts`) |
| Health | `/api/health` |

> `--include=dev` es necesario porque `prisma` y `tsx` viven en `devDependencies`.

Si prefieres configurarlo a mano (sin Blueprint): Web Service → Runtime **Node**,
Build Command y Start Command de la tabla, y las mismas variables de entorno.

## 2. Frontend en Vercel

1. **Add New → Project** e importa el repo.
2. Framework Preset: **Other** (Vercel usa `vercel.json`).
3. Variable de entorno:
   - `VITE_API_URL` = `https://TU-SERVICIO.onrender.com/api`
   - (opcional) `VITE_WHATSAPP_NUMBER` = número sin `+` ni espacios.
4. Deploy.

`vercel.json` ya define `buildCommand`, `outputDirectory: dist` y la reescritura
`/admin → /admin.html`.

> Vite inyecta `VITE_*` en tiempo de build: si cambias `VITE_API_URL` hay que
> volver a desplegar.

## 3. Comandos locales de referencia

```bash
npm install            # dependencias
npm run build          # frontend → dist/
npm run prisma:generate
npm start              # API en el puerto PORT (4000 por defecto)
```

## 4. Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `DATABASE_URL` | Render | Postgres de Supabase (pooler 6543) |
| `JWT_SECRET` | Render | Secreto para firmar tokens |
| `CORS_ORIGIN` | Render | URL del frontend |
| `NODE_ENV` | Render | `production` |
| `PORT` | Render | Lo inyecta Render automáticamente |
| `VITE_API_URL` | Vercel | URL pública de la API + `/api` |
| `VITE_WHATSAPP_NUMBER` | Vercel | Opcional |

## 5. Notas

- No subas `backend/.env` ni `.env`: están en `.gitignore`. Configura todo en
  los paneles de Vercel/Render.
- El plan free de Render duerme el servicio tras inactividad; el primer request
  puede tardar ~50 s.
- `dist/` y `node_modules/` están ignorados por git.
