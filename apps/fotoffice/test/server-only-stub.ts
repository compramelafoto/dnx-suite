/**
 * Sustituto de `server-only` para los tests.
 *
 * `server-only` no es un paquete instalado: lo resuelve el compilador de Next para romper el
 * build si un módulo de servidor termina importado desde el navegador. Vitest no tiene esa
 * resolución, así que sin este sustituto **no se podría probar ningún módulo que la use** —y
 * quitarle la marca a un archivo para poder testearlo sería cambiar una protección real por
 * comodidad de laboratorio.
 */
export {};
