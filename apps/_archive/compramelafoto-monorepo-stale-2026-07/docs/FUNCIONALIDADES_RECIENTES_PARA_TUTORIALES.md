# Funcionalidades recientes de impacto – Documentación y tutoriales

Listado de cambios y features recientes con **impacto en seguridad**, **organización de ventas** y **experiencia del fotógrafo y del cliente**, pensado para documentar y grabar tutoriales en video.

---

## 1. Seguridad y privacidad de álbumes

### 1.1 Álbum con fotos ocultas (solo selfie)
- **Qué es:** El fotógrafo puede marcar un álbum como “fotos ocultas”: el cliente no ve las fotos hasta pasar una verificación por selfie. Solo ve las fotos donde aparece su rostro (o las que no tienen rostro).
- **Impacto:** Evita que cualquiera con el link vea todo el álbum; cada persona ve solo “sus” fotos.
- **Dónde:** Dashboard del álbum → configuración del álbum (`hiddenPhotosEnabled`). Endpoint `POST /api/albums/[id]/hidden/selfie`.
- **Tutorial sugerido:** “Cómo activar fotos ocultas por selfie en un álbum”.

### 1.2 Auditoría completa de intentos de selfie (Admin)
- **Qué es:** Cada intento de selfie (éxito o fallo) se registra: quién (userId o guestId), álbum, fecha, IP hasheada, dispositivo, resultado (NO_FACE, MULTIPLE_FACES, MATCH_FOUND, etc.), fotos habilitadas y, si se guarda, la selfie con retención configurable.
- **Impacto:** El administrador (y el fotógrafo dueño) pueden auditar accesos y detectar abusos o fallos.
- **Dónde:** Admin → menú “Auditoría Selfies” (`/admin/auditoria-selfies`). Filtros por álbum, fecha, resultado, email/guest. Detalle con metadata y “Ver selfie” (URL firmada) cuando aplica.
- **Tutorial sugerido:** “Auditoría de selfies en el panel Admin”.

### 1.3 Validación de grant al ver una foto
- **Qué es:** Si el álbum tiene fotos ocultas, la API de vista de foto (`/api/photos/[id]/view`) exige una cookie de “grant” vigente y que el `photoId` esté en la lista autorizada. Sin grant válido → 403.
- **Impacto:** No se puede ver una foto del álbum oculto sin haber pasado la verificación por selfie (o sin ser dueño/admin).
- **Tutorial sugerido:** Incluir en el video de “fotos ocultas” cómo el cliente debe hacer selfie primero y luego navegar/comprar.

### 1.4 Privacidad en la auditoría
- **Qué es:** IP guardada como hash (SHA256 + sal), no en claro. Selfie en R2 solo si el álbum tiene `hiddenSelfieRetentionDays`; se borra con un cron cuando expira.
- **Impacto:** Cumplimiento y buena práctica: no se guardan IP ni selfies más de lo necesario.
- **Tutorial sugerido:** Mencionar en el video de auditoría (opcional: “Privacidad y retención de selfies”).

---

## 2. Organización de ventas por foto

### 2.1 Venta digital e impresa por foto (sellDigital / sellPrint)
- **Qué es:** Por cada foto del álbum el fotógrafo puede elegir si se vende como **digital**, como **impresa**, o ambas. Toggles en el grid del álbum.
- **Impacto:** Control fino: por ejemplo deshabilitar impresión en una foto solo digital, o quitar la venta de una foto concreta sin borrarla.
- **Dónde:** Dashboard → Álbum → grid de fotos: toggles “Digital” e “Impresa” por foto. API: `PATCH` en la foto con `sellDigital` / `sellPrint`.
- **Tutorial sugerido:** “Configurar qué fotos se venden en digital y cuáles en impresión”.

### 2.2 Checkout que respeta digital/impresa por foto
- **Qué es:** En comprar y en el resumen del pedido solo se ofrecen las opciones (digital/impresa) que el fotógrafo habilitó para cada foto. No se puede comprar digital si esa foto tiene `sellDigital: false`, ni impresa si `sellPrint: false`.
- **Impacto:** Lo que ve y compra el cliente coincide exactamente con la configuración del fotógrafo.
- **Dónde:** Flujo de compra (`/a/[id]/comprar`), resumen, y APIs de order-photos / pedidos.
- **Tutorial sugerido:** Incluir en “Venta por foto” o en “Flujo de compra del cliente”.

---

## 3. Organización del panel y menús

### 3.1 Menú Admin: Auditoría Selfies
- **Qué es:** Nuevo ítem en el menú del panel Admin: “Auditoría Selfies”, que lleva a la lista de intentos de selfie con filtros y detalle.
- **Impacto:** Acceso rápido a la auditoría sin buscar por URL.
- **Tutorial sugerido:** “Navegación del panel Admin” o dentro del video de auditoría de selfies.

### 3.2 Dashboard del fotógrafo: toggles por foto en el grid
- **Qué es:** En la vista de detalle del álbum, cada foto del grid muestra controles (digital/impresa, y en su caso opciones de álbum oculto) de forma clara y ordenada.
- **Impacto:** Menos clics y menos confusión al configurar muchos álbumes.
- **Tutorial sugerido:** “Gestionar fotos de un álbum: venta y visibilidad”.

---

## 4. Experiencia del fotógrafo

### 4.1 Control de visibilidad y venta por álbum y por foto
- **Qué es:** A nivel álbum: público/privado, fotos ocultas por selfie, retención de selfie. A nivel foto: venta digital / impresa.
- **Impacto:** El fotógrafo define quién ve qué y qué se puede comprar, sin tener que eliminar fotos.
- **Tutorial sugerido:** “Control total del álbum: visibilidad y venta”.

### 4.2 Ver el álbum como lo ve el cliente
- **Qué es:** Botón “Vista del cliente” / “Copiar enlace” en el dashboard del álbum para previsualizar o compartir el link.
- **Impacto:** Comprobar en vivo el resultado de “fotos ocultas” y de los toggles digital/impresa.
- **Tutorial sugerido:** Ya suele estar en docs; reforzar en “Fotos ocultas” y “Venta por foto”.

---

## 5. Experiencia del cliente

### 5.1 Flujo de selfie en álbum con fotos ocultas
- **Qué es:** El cliente entra al álbum, ve que debe verificar con selfie, sube la foto; el sistema devuelve un “grant” (cookie) y entonces puede ver y comprar solo las fotos autorizadas.
- **Impacto:** Acceso sencillo y seguro a “mis fotos” sin crear cuenta obligatoria (guestId en cookie).
- **Tutorial sugerido:** “Cómo ver y comprar tus fotos en un álbum con verificación por selfie”.

### 5.2 Comprar solo lo permitido por foto
- **Qué es:** En el carrito y en el checkout el cliente solo ve opciones de compra (digital/impresa) para las fotos que el fotógrafo habilitó.
- **Impacto:** Menos errores y menos soporte (“no me deja comprar impresa” cuando esa foto no está en venta impresa).
- **Tutorial sugerido:** Incluir en el video de compra del cliente.

---

## 6. Infraestructura y buenas prácticas

### 6.1 Rate limit en selfie
- **Qué es:** Límite de intentos de selfie por álbum e IP (ej. 15 por minuto). Si se supera → 429 y el intento se registra como RATE_LIMITED.
- **Impacto:** Reduce abuso y fuerza bruta en el endpoint de selfie.
- **Tutorial sugerido:** Mencionar en “Seguridad” o “Auditoría”.

### 6.2 Cron de limpieza (hidden album)
- **Qué es:** Job que borra selfies guardadas en R2 cuando llega su `expiresAt` y actualiza el attempt (auditoría se mantiene).
- **Impacto:** Retención de datos mínima necesaria y cumplimiento.
- **Tutorial sugerido:** “Tareas programadas (cron)” o nota en documentación técnica.

### 6.3 GuestId en cookie
- **Qué es:** Usuario no logueado recibe una cookie con un UUID para identificar intentos y grants sin guardar datos personales hasta que compre o se registre.
- **Impacto:** Auditoría y control de acceso también para visitantes anónimos.
- **Tutorial sugerido:** Opcional en “Privacidad y auditoría”.

---

## Resumen por tipo de contenido para videos

| Tema del video                         | Funcionalidades a cubrir                                                                 |
|----------------------------------------|-------------------------------------------------------------------------------------------|
| **Seguridad de álbumes**               | 1.1 Fotos ocultas por selfie, 1.3 Validación al ver foto, 1.4 Privacidad (IP hash, retención) |
| **Auditoría para Admin**               | 1.2 Auditoría Selfies, 3.1 Menú Auditoría Selfies, 6.1 Rate limit                        |
| **Organizar ventas (fotógrafo)**        | 2.1 Digital/Impresa por foto, 2.2 Checkout, 4.1 Control álbum y foto, 4.2 Vista cliente   |
| **Experiencia del cliente**             | 5.1 Flujo selfie, 5.2 Comprar solo lo permitido                                          |
| **Panel y menús**                       | 3.1 Menú Auditoría Selfies, 3.2 Grid con toggles                                          |
| **Técnico / operación**                 | 6.2 Cron limpieza, 6.3 GuestId, variables de entorno (grant secret, IP salt)              |

---

## Checklist rápido para documentación

- [ ] Álbum con fotos ocultas: activar y probar flujo selfie.
- [ ] Auditoría Selfies: filtros, detalle, “Ver selfie” cuando aplica.
- [ ] Toggles digital/impresa por foto en el grid del álbum.
- [ ] Checkout respetando sellDigital/sellPrint.
- [ ] Validación de grant al ver una foto (álbum oculto).
- [ ] Menú Admin “Auditoría Selfies”.
- [ ] Rate limit y resultado RATE_LIMITED en auditoría.
- [ ] Retención de selfie (hiddenSelfieRetentionDays) y cron de limpieza.
- [ ] Variables de entorno: `HIDDEN_ALBUM_GRANT_SECRET`, `HIDDEN_ALBUM_IP_SALT`, `CRON_SECRET`.

Si querés, el siguiente paso puede ser bajar esto a guiones por video (bullet points por minuto) o a secciones concretas para la wiki/help del producto.
