/**
 * Utilidades para procesar imágenes de productos.
 *
 * Dos formas de obtener la imagen, y ambas terminan guardando los BYTES en
 * Postgres (columna `imagen_data`):
 *   1. Archivo subido desde el equipo → llega como base64 / data URL.
 *   2. URL de internet → el backend la DESCARGA y guarda los bytes.
 */

// Tamaño máximo aceptado por imagen (en bytes, ya decodificada).
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Tiempo máximo para descargar una imagen desde una URL externa.
const DOWNLOAD_TIMEOUT_MS = 15000;

// Tipos MIME permitidos (whitelist). Se usa tanto al guardar como al servir.
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
 * Detecta el tipo real de la imagen leyendo sus "magic bytes" (firma).
 * Sirve para no fiarse solo del Content-Type que informe la web externa.
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
 * Valida unos bytes de imagen y devuelve bytes + MIME normalizado.
 * Lanza un Error con mensaje legible si el tipo o el tamaño no son válidos.
 */
export function validateImageBuffer(data: Uint8Array, declaredMime?: string): ParsedImage {
  if (!data || data.length === 0) {
    throw new Error('La imagen recibida está vacía.');
  }

  if (data.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `La imagen supera el tamaño máximo permitido (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`
    );
  }

  // Preferimos el tipo detectado por firma; si no, el declarado.
  const mime = sniffImageMime(data) || normalizeMime(declaredMime) || 'image/jpeg';

  if (!ALLOWED_IMAGE_MIME.includes(mime as any)) {
    throw new Error(
      `Tipo de imagen no permitido (${mime}). Usa JPG, PNG, WEBP, GIF o AVIF.`
    );
  }

  return { data, mime };
}

/**
 * Convierte el payload de imagen recibido en el body JSON a bytes + MIME.
 * Acepta:
 *   - data URL completa:  "data:image/png;base64,iVBORw0..."
 *   - base64 crudo + mime aparte:  "iVBORw0..." + "image/png"
 * Devuelve `null` si no hay imagen válida (sin lanzar error).
 * Lanza un Error con mensaje legible si el tipo o el tamaño no son válidos.
 */
export function parseImagePayload(
  base64OrDataUrl: string,
  declaredMime?: string
): ParsedImage | null {
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

  // Quitar espacios/saltos de línea del base64.
  raw = raw.replace(/\s+/g, '');

  let data: Uint8Array;
  try {
    data = new Uint8Array(Buffer.from(raw, 'base64'));
  } catch {
    throw new Error('La imagen recibida no es un base64 válido.');
  }

  return validateImageBuffer(data, mime);
}

/**
 * Descarga una imagen desde una URL de internet y la devuelve como bytes + MIME.
 * El backend hace la descarga para poder GUARDARLA en la base de datos.
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
        // Algunos sitios exigen un User-Agent "real" para servir la imagen.
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

  // Verificamos por firma que de verdad sea una imagen (no una página HTML).
  if (!sniffImageMime(data)) {
    throw new Error('La URL no devolvió una imagen válida (JPG, PNG, WEBP, GIF o AVIF).');
  }

  return validateImageBuffer(data, contentType || undefined);
}
