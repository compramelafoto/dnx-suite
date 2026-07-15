/**
 * Declaración tipada para el marcador oficial `server-only`.
 * La resolución runtime la hace Next.js (paquete real / exports react-server).
 * No usar un shim en `paths` que anule esa protección.
 */
declare module "server-only";
