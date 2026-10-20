/**
 * Topes de la firma escaneada (D16), compartidos por el navegador y el servidor. Una acción de
 * servidor acepta cuerpos de hasta 1 MB: la firma se achica en el navegador (lado mayor de 1200 px,
 * JPEG) antes de mandarla, y el servidor rechaza lo que pase de este tope con un mensaje claro.
 */
export const FIRMA_MAX_BYTES = 900 * 1024;
export const FIRMA_LADO_MAX = 1200;
export const FIRMA_DEMASIADO_GRANDE = "La firma pesa demasiado. Probá con una foto más chica o un recorte de la firma.";
