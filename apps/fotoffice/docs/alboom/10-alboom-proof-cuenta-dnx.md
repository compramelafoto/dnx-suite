# Alboom Proof: la cuenta real de DNX Estudio (leída el 29/09/2026)

> Recorrida con Claude in Chrome (el navegador integrado no pasa la verificación de Cloudflare), sólo
> lectura, sin guardar nada. Complementa `07-alboom-proof.md` (información pública). No se copian datos
> de clientes.

## 1. Volumen (lo que habría que migrar)

| Tipo de proyecto | En preparación | En curso | En revisión | Finalizado | Total activos |
|---|---:|---:|---:|---:|---:|
| Selección y Venta | 1 | 309 | 80 | 186 | **576** |
| Prueba de Álbum | 0 | 51 | 2 | 65 | **118** |
| Entrega (nuevo) | 1 | 2 | — | 0 | **3** |

- **Almacenamiento usado: 333,76 GB de 510 GB** (plan "Proof 500 GB" + 10 GB de regalo): galerías de
  selección 309,79 GB · prueba de álbum 13,97 GB · entregas 9,99 GB.
- Proyectos nuevos por mes: ilimitados; **12 creados en septiembre de 2026**.
- Muchos proyectos "En curso" (309) nunca se cerraron: al migrar conviene archivar los viejos.

## 2. Pantalla "Mis proyectos"

- Tres pestañas por tipo: **Selección y Venta · Entrega · Prueba de Álbum**.
- Vista **tablero** (columnas por estado: En preparación / En curso / En revisión / Finalizado; Entrega
  no tiene "En revisión") o **lista**.
- Filtros: buscar por nombre, período, **Status** (Activo/archivado), **Cliente**, **Etapa**,
  **Categoría**; ordenar por fecha de creación.
- Tarjeta: portada, nombre (DNX usa "número de pedido – cliente – evento", el mismo que DNX FLUX),
  categoría, cantidad de clientes (con punto de color si hay actividad nueva), plazo, ícono de tipo.

## 3. Dentro de un proyecto

Encabezado: nombre, estado (Publicado), tipo, tamaño (GB), código QR, vista previa y botón **Compartir**.

**Visión general**
- **Actividades del cliente**: clientes agrupados en *En progreso / En revisión / Finalizado*. Por cliente:
  contacto, aviso de qué hacer ("Revisa las fotos seleccionadas… haz clic en finalizar; si hace falta,
  reactivá la galería"), botón **Finalizar** (con menú), resumen (envió la selección tal día, N fotos,
  N comentarios), mensaje del cliente, pestañas **Fotos seleccionadas / Comentarios** y **Exportar** la
  selección (la lista para Lightroom).
- **Historial de actividades**: filtrable por cliente, período y tipo; registra inicio de descargas,
  galería completada, fotos seleccionadas, con fecha y hora.

**Preferencias** (10 secciones, con valores del proyecto de ejemplo)
| Sección | Qué tiene | Valor en DNX |
|---|---|---|
| Datos de la galería | nombre, categoría, fecha del trabajo, **visualización** (resolución de muestra), idioma, **mensaje de acceso**, permitir comentarios, permitir compartir en redes | Ultra HD 4K (3840 px); mensaje: "Seleccioná las fotos para tu fotolibro…"; comentarios y compartir activados |
| Fotos | todas / favoritas del estudio, **colecciones** (carpetas), ordenar, portada, añadir fotos | 142 fotos, sin colecciones |
| Selección y venta | modo: *Selección de fotos* / *Selección con venta de extras* / *Venta de fotos*; modo de selección *Libre* o *Por cantidad*; pestaña **Descuentos** | Selección de fotos, **libre** |
| Plazo y recordatorio | sin plazo / con plazo (y recordatorios) | **Sin plazo** |
| Acceso y privacidad | galería *Privada* / *Protegida con contraseña* / *Pública*; pestaña Fotos | **Privada** |
| Clientes | permitir que se registren (nombre, correo y teléfono obligatorios), agregar, importar, exportar CSV, contraseña visible por cliente, compartir | Registro permitido |
| Descarga | permitir descarga; *en vista de galería* (sin marca de agua) o *sólo seleccionadas o compradas* | Permitida, **en vista de galería** |
| Filtro facial | búsqueda por selfie | (sin revisar) |
| Marca de agua y protección | aplicar marca de agua; protección | **Sin marca de agua** |
| Diseño | portada, tipografía (Serif, Sans, Cursiva, Slab, Condensada, Heavy), color, estilo de botón, navegación, cuadrícula; vista previa computadora/celular | Sans |

## 4. Menú general

- **Clientes**: listado de todas las cuentas de clientes (nombre, correo, teléfono), con cuentas de
  prueba mezcladas ("usuario@…"). Limpiar al migrar.
- **Órdenes**: panel de ventas con total, pedidos, ticket promedio, total pagado, fotos vendidas,
  galerías, promedio por galería; filtros por pago, categoría y galería. **Hay 14 pedidos de venta de
  fotos** (Torneo Balonpié Funes 2023 y otros): 1 pagado, el resto pendientes; montos en "US$" por
  la configuración brasileña. Sin cuenta de pago configurada (Alboom Pay sólo opera en Brasil).
- **Configuración**: General (nombre para mostrar, correo de notificaciones) · Logotipo y favicon ·
  **Dominio** (`dnxfotografia.alboompro.com/proof` principal y **`dnxfotografia.com.ar/proof` activo**,
  vía Prosite) · Cuenta de pago (sin configurar) · Aplicaciones (plugin de Lightroom Classic, ninguna
  conectada) · Marca de agua · **Categorías** · Protección anticopia (bloquear clic derecho, guardar
  desde el celular, 99 % de impresiones) · **Presets** · Límites y uso del plan.
- **Presets (2)**: "Predeterminado" y "Sesión de Fotos DNX" (18/08/2026). Separados para galería de fotos
  y entrega.
- **Categorías (23)** con cantidad de proyectos: Sesión de Fotos 189 · Fiesta 15 Años 155 · 15 anos 59 ·
  Boda 42 · Evento 33 · Cumpleaños 29 · Infantil 15 · Fiesta 13 · Pintada 12 · Fotolibro 11 · Casamento 6 ·
  Ensaio 5 · Bautismo 5 · Comunión 5 · Família 4 · Torneo deportivo 3 · Aniversário 2 · Gestante 1 ·
  Newborn 1 · Tirada 1 · CUmple 40 1 · Pré Casamento 0 · Fabrica 0. Varias vienen de fábrica en portugués
  (Casamento, Ensaio, 15 anos…) y se **unifican al migrar** (15 anos → Fiesta 15 Años, Casamento → Boda…).

## 5. Qué implica para la galería FOTOFFICE

1. **Migración de galerías**: ~700 proyectos y ~334 GB. Con R2 son ~USD 5/mes. Conviene migrar primero lo
   activo y archivar lo finalizado viejo; los enlaces `dnxfotografia.com.ar/proof/...` que ya tienen los
   clientes deberían **redirigir** a la galería nueva.
2. **Estados por cliente, no por galería** (confirmado): En progreso → En revisión → Finalizado, con
   "reactivar" para volver a abrir.
3. **Valores por defecto de DNX** para el preset inicial: privada, selección libre sin venta, sin plazo,
   descarga en vista de galería, sin marca de agua, 4K para ver, comentarios y compartir activados,
   mensaje de acceso orientado a elegir fotos del fotolibro.
4. **Tablero por estados con filtros por cliente, etapa y categoría**: igual que el resto del CRM
   (listado estándar de FOTOFFICE).
5. **Historial de actividad** por galería y aviso al fotógrafo: imprescindible.
6. Las ventas de fotos que alguna vez se hicieron en Proof van por **CompraMeLaFoto** (decisión del 29/09).
