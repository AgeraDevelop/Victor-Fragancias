/**
 * Utilidades para procesar e integrar imágenes de productos utilizando Sharp.
 *
 * Funciones clave:
 *   1. Estandariza las dimensiones a 1200x900 (proporción 4:3 del catálogo).
 *   2. Reacomoda la imagen centrando el producto y aplicando márgenes seguros
 *      (padding) para que las tapas, frascos y bordes nunca se corten al
 *      mostrarse en tarjetas 4:3 (catálogo), 1:1 (admin), 4:5 (modal) o 3:4 (carrusel).
 *   3. Recorta márgenes irregulares y unifica el fondo (preserva transparencia si es PNG/WebP).
 *   4. Optimiza en formato WebP (calidad 85), reduciendo el peso de MBs a KBs
 *      para mejorar la velocidad de carga y no saturar la base de datos Postgres (bytea).
 */

import sharp from 'sharp';

// Dimensiones estándar del sistema (proporción 4:3 de las tarjetas del catálogo)
export const TARGET_IMAGE_WIDTH = 1200;
export const TARGET_IMAGE_HEIGHT = 900;

// Márgenes seguros para el frasco / producto dentro del lienzo de 1200x900:
// - Ancho máx: 840 px (70%) → deja 180 px a cada lado (protege vistas 1:1, 4:5 y 3:4)
// - Alto máx: 756 px (84%) → deja 72 px arriba y abajo (protege tapas y bases de frascos)
export const MAX_INNER_WIDTH = 840;
export const MAX_INNER_HEIGHT = 756;

// Tamaño máximo aceptado por imagen entrante (en bytes, antes de optimizar).
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Tiempo máximo para descargar una imagen desde una URL externa.
const DOWNLOAD_TIMEOUT_MS = 15000;

// Tipos MIME permitidos (whitelist).
export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export interface ParsedImage {
  data: Uint8Array;
  mime: string;
}

function normalizeMime(mime?: string): string {
  const m = (mime || '').trim().toLowerCase();
  return m === 'image/jpg' ? 'image/jpeg' : m;
}

/**
 * Detecta el tipo real de la imagen leyendo sus "magic bytes" (firma binaria).
 */
export function sniffImageMime(data: Uint8Array): string | null {
  if (!data || data.length < 4) return null;

  // PNG: 89 50 4E 47
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF: "GIF8"
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return 'image/gif';
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    data.length >= 12 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    return 'image/webp';
  }
  // AVIF: "ftyp" + marca "avif"/"avis"
  if (
    data.length >= 12 &&
    data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70
  ) {
    const brand = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }

  return null;
}

/**
 * Procesa la imagen con Sharp:
 * - Corrige orientación según EXIF (.rotate()).
 * - Si es un producto con fondo uniforme o transparente, recorta márgenes vacíos (trim)
 *   y reacomoda el producto centrado dentro de márgenes seguros.
 * - Si es una fotografía compleja de fondo completo, la ajusta proporcionalmente.
 * - Convierte a WebP optimizado (calidad 85).
 */
export async function processProductImage(
  data: Uint8Array | Buffer,
  declaredMime?: string
): Promise<ParsedImage> {
  const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error('La imagen recibida está vacía.');
  }

  if (inputBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `La imagen supera el tamaño máximo permitido (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`
    );
  }

  const detectedMime = sniffImageMime(inputBuffer) || normalizeMime(declaredMime) || 'image/jpeg';
  if (!ALLOWED_IMAGE_MIME.includes(detectedMime as any)) {
    throw new Error(
      `Tipo de imagen no permitido (${detectedMime}). Usa JPG, PNG, WEBP, GIF o AVIF.`
    );
  }

  try {
    // 1. Auto-orientar según EXIF
    const baseSharp = sharp(inputBuffer).rotate();
    const meta = await baseSharp.metadata();

    const origW = meta.width || TARGET_IMAGE_WIDTH;
    const origH = meta.height || TARGET_IMAGE_HEIGHT;
    const hasAlpha = Boolean(meta.hasAlpha);

    // 2. Muestreo de bordes y esquinas para detectar el color de fondo
    const { data: rawData, info: rawInfo } = await baseSharp
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = rawInfo.width;
    const h = rawInfo.height;
    const ch = rawInfo.channels;

    const getPixel = (px: number, py: number) => {
      const idx = (py * w + px) * ch;
      return {
        r: rawData[idx],
        g: rawData[idx + 1],
        b: rawData[idx + 2],
        a: hasAlpha && ch >= 4 ? rawData[idx + 3] : 255,
      };
    };

    const corners = [
      getPixel(0, 0),
      getPixel(w - 1, 0),
      getPixel(0, h - 1),
      getPixel(w - 1, h - 1),
    ];

    const allCornersTransparent = hasAlpha && corners.every((c) => c.a < 30);

    const colorDist = (
      c1: { r: number; g: number; b: number },
      c2: { r: number; g: number; b: number }
    ) =>
      Math.sqrt(
        Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2)
      );

    let maxCornerDiff = 0;
    for (let i = 0; i < corners.length; i++) {
      for (let j = i + 1; j < corners.length; j++) {
        const d = colorDist(corners[i], corners[j]);
        if (d > maxCornerDiff) maxCornerDiff = d;
      }
    }

    const isSolidBorder = allCornersTransparent || maxCornerDiff < 30;

    let bg: { r: number; g: number; b: number; alpha: number };
    if (allCornersTransparent) {
      bg = { r: 0, g: 0, b: 0, alpha: 0 };
    } else {
      const avgR = Math.round(corners.reduce((s, c) => s + c.r, 0) / corners.length);
      const avgG = Math.round(corners.reduce((s, c) => s + c.g, 0) / corners.length);
      const avgB = Math.round(corners.reduce((s, c) => s + c.b, 0) / corners.length);
      bg = { r: avgR, g: avgG, b: avgB, alpha: 1 };
    }

    let outputBuffer: Buffer;

    if (isSolidBorder) {
      // Frasco/producto aislado: recortar márgenes sobrantes para obtener el producto puro
      let trimmedBuf: Buffer;
      try {
        const trimOpts = allCornersTransparent
          ? { threshold: 10 }
          : { background: bg, threshold: 20 };
        trimmedBuf = await sharp(inputBuffer).rotate().trim(trimOpts).toBuffer();
      } catch {
        // Si no hay bordes que recortar, mantener la imagen orientada
        trimmedBuf = await sharp(inputBuffer).rotate().toBuffer();
      }

      // Escalar el producto respetando márgenes seguros internos (para que no se corte)
      const inner = await sharp(trimmedBuf)
        .resize({
          width: MAX_INNER_WIDTH,
          height: MAX_INNER_HEIGHT,
          fit: 'inside',
          withoutEnlargement: false,
        })
        .toBuffer({ resolveWithObject: true });

      // Centrar el producto en el lienzo estándar 1200x900 con su color de fondo
      outputBuffer = await sharp({
        create: {
          width: TARGET_IMAGE_WIDTH,
          height: TARGET_IMAGE_HEIGHT,
          channels: allCornersTransparent ? 4 : 3,
          background: bg,
        },
      })
        .composite([
          {
            input: inner.data,
            gravity: 'centre',
          },
        ])
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
    } else {
      // Fotografía escénica / de campaña completa:
      const aspectRatio = origW / origH;
      if (aspectRatio >= 1.1 && aspectRatio <= 1.6) {
        // Proporción cercana a 4:3 → cubrir centrado
        outputBuffer = await sharp(inputBuffer)
          .rotate()
          .resize({
            width: TARGET_IMAGE_WIDTH,
            height: TARGET_IMAGE_HEIGHT,
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality: 85, effort: 4 })
          .toBuffer();
      } else {
        // Formato muy alargado o vertical → contener con fondo para no cortar detalles
        outputBuffer = await sharp(inputBuffer)
          .rotate()
          .resize({
            width: TARGET_IMAGE_WIDTH,
            height: TARGET_IMAGE_HEIGHT,
            fit: 'contain',
            background: bg,
          })
          .webp({ quality: 85, effort: 4 })
          .toBuffer();
      }
    }

    return {
      data: new Uint8Array(outputBuffer),
      mime: 'image/webp',
    };
  } catch (err: any) {
    console.error('Error al procesar la imagen con Sharp:', err);
    throw new Error(
      `No se pudo procesar la imagen: ${err?.message || 'formato de imagen corrupto o no compatible'}`
    );
  }
}

/**
 * Valida y procesa un buffer de imagen devolviendo bytes optimizados y MIME normalizado.
 * Mantiene compatibilidad hacia atrás con la función anterior.
 */
export async function validateImageBuffer(
  data: Uint8Array,
  declaredMime?: string
): Promise<ParsedImage> {
  return processProductImage(data, declaredMime);
}

/**
 * Convierte el payload de imagen recibido en el body JSON (base64) a bytes reacomodados + WebP.
 * Acepta:
 *   - data URL completa:  "data:image/png;base64,iVBORw0..."
 *   - base64 crudo + mime aparte:  "iVBORw0..." + "image/png"
 * Devuelve `null` si no hay imagen válida (sin lanzar error).
 */
export async function parseImagePayload(
  base64OrDataUrl: string,
  declaredMime?: string
): Promise<ParsedImage | null> {
  if (typeof base64OrDataUrl !== 'string' || base64OrDataUrl.trim() === '') {
    return null;
  }

  let raw = base64OrDataUrl.trim();
  let mime = (declaredMime || '').trim().toLowerCase();

  // Si viene como data URL, extraemos el mime y el base64.
  const dataUrlMatch = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(raw);
  if (dataUrlMatch) {
    if (dataUrlMatch[1]) mime = dataUrlMatch[1].toLowerCase();
    raw = dataUrlMatch[3];
  }

  // Quitar espacios y saltos de línea del base64.
  raw = raw.replace(/\s+/g, '');

  let data: Uint8Array;
  try {
    data = new Uint8Array(Buffer.from(raw, 'base64'));
  } catch {
    throw new Error('La imagen recibida no es un base64 válido.');
  }

  return processProductImage(data, mime);
}

/**
 * Descarga una imagen desde una URL de internet, la reacomoda con Sharp y la devuelve en WebP.
 */
export async function downloadImage(url: string): Promise<ParsedImage> {
  const raw = (url || '').trim();
  if (!raw) {
    throw new Error('La URL de la imagen está vacía.');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('La URL de la imagen no es válida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('La URL de la imagen debe empezar con http:// o https://');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(raw, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DVictorFragancia/1.0; +https://localhost)',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('La descarga de la imagen tardó demasiado (tiempo agotado).');
    }
    throw new Error('No se pudo descargar la imagen desde esa URL.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`No se pudo descargar la imagen (la web respondió ${res.status}).`);
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType && !contentType.startsWith('image/')) {
    throw new Error('La URL indicada no apunta a una imagen válida.');
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `La imagen supera el tamaño máximo permitido (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Verificamos por firma que de verdad sea una imagen.
  if (!sniffImageMime(data)) {
    throw new Error('La URL no devolvió una imagen válida (JPG, PNG, WEBP, GIF o AVIF).');
  }

  return processProductImage(data, contentType || undefined);
}
