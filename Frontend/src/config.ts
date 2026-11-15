/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHIVO: Frontend/src/config.ts
 * QUÉ ES: Configuración compartida de la tienda.
 * POR QUÉ: Centraliza datos que se usan en varios componentes (por ahora, el
 *          número de WhatsApp de la tienda) y permite sobreescribirlos sin tocar
 *          el código usando variables de entorno de Vite.
 *
 * CÓMO PROBAR EL MENSAJE DE LA BOLSA A TU PROPIO TELÉFONO:
 *   1. Crea un archivo `.env` en la RAÍZ del proyecto (donde está `package.json`,
 *      al mismo nivel que la carpeta `Frontend/`).
 *   2. Escribe:  VITE_WHATSAPP_NUMBER=1809XXXXXXX
 *      (tu número en formato internacional, SIN el signo '+' ni espacios).
 *   3. Reinicia el servidor de desarrollo (Vite lee el .env al arrancar).
 *   4. Al pulsar "Pedir por WhatsApp" el chat se abrirá con TU número, así que
 *      podrás enviarte el mensaje a ti mismo y ver cómo llega.
 *   5. Cuando termines de probar, borra el .env (o la línea) para volver al
 *      número real de la tienda.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Número de WhatsApp de la tienda (formato internacional, sin '+' ni espacios). */
export const WHATSAPP_NUMBER: string =
  (import.meta as any).env?.VITE_WHATSAPP_NUMBER || '18295553842';

/** Construye un enlace de WhatsApp (wa.me) con el mensaje ya codificado. */
export const whatsappUrl = (message: string): string =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
