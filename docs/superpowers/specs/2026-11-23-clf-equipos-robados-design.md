# CLF — Denuncia y búsqueda de equipos robados

Fecha: 23/11/2026 · Estado: aprobado por Daniel en la conversación («Hacelo con estas mejoras»).

## Para qué

Que un fotógrafo al que le robaron una cámara o un lente pueda recuperarlo. CompramelaFoto
lee la ficha técnica (EXIF) de cada foto que se sube y ya guarda marca, modelo y número de
serie de las cámaras de cada fotógrafo. Si un equipo robado aparece trabajando en CLF —hoy o
dentro de meses— el administrador se entera y decide cómo seguir. No es para condenar a nadie:
es una pista privada para el damnificado, mediada por el administrador.

Además se arma, desde ahora, un **historial permanente de cada número de serie**: qué cuentas
lo usaron y entre qué fechas. Sirve para robos futuros y para equipos que cambian de mano.

## Objetivos

- Un fotógrafo con sesión denuncia un equipo: tipo (cámara o lente), marca, modelo, número de
  serie, fecha y lugar del robo, y **factura de compra** (obligatoria) más denuncia policial
  (opcional).
- El administrador aprueba o rechaza cada denuncia mirando la factura. Sólo las aprobadas entran
  al cruce.
- El cruce corre **todos los días** contra todo el historial, por tiempo indefinido mientras la
  denuncia esté activa: si el equipo empieza a usarse en CLF a los 90 días, se detecta ese día.
  También corre en el momento en que el administrador aprueba la denuncia.
- Cuando aparece una coincidencia nueva, el administrador recibe un correo. Las coincidencias
  sólo se ven en el panel admin.
- Buscador admin: cualquier número de serie → historial completo de quién lo usó y cuándo.

## No-objetivos (por ahora)

- Nada público: sin página pública, sin link en menús públicos, sin avisos al damnificado ni al
  que tiene el equipo. Todo contacto lo decide el administrador por fuera.
- El fotógrafo nunca ve coincidencias ni datos de otros: sólo el estado de su denuncia.
- Sin cruce por "mismo modelo" sin número de serie: daría falsos positivos con cualquiera que
  tenga la misma cámara.

## Anti-objetivos

- Que alguien use la herramienta para averiguar quién tiene la cámara de otro → por eso la
  factura y la aprobación manual.
- Que un fallo del sistema nuevo frene el procesamiento de fotos → el registro de números de
  serie va envuelto para que nunca rompa la lectura de EXIF.

## Lo que ya existe y se reutiliza

- `PhotographicCameraBody` (cámara por fotógrafo, con `serialNumber`, primera y última vez
  vista). En producción al 23/11/2026: 218 cámaras, 145 con número de serie, 7 números de
  serie ya usados por más de una cuenta.
- `PhotographicGearObservation` (una fila por foto, con `rawExifSummary`, que incluye
  `LensSerialNumber` en ~60 % de las fotos). **Se borra con la foto** a los 45 días de vida
  del álbum, por eso no sirve como historial.
- `PhotographicLens` **no guarda número de serie**: el del lente sólo está en `rawExifSummary`.

## Diseño

### Datos (tres tablas nuevas, ninguna columna en tablas existentes)

- `GearSerialSighting` — el historial permanente. Una fila por (tipo, serie normalizada,
  fotógrafo): marca, modelo, serie tal como vino, primera y última vez vista, cantidad de fotos,
  último álbum. No depende de las fotos: sobrevive a la limpieza de álbumes. Si se borra la
  cuenta del fotógrafo, la fila queda con el fotógrafo en nulo y un nombre de referencia.
- `StolenGearReport` — la denuncia: quién denuncia, tipo, marca, modelo, serie y serie
  normalizada, fecha y lugar del robo, descripción, número de denuncia policial, claves en R2 de
  la factura y de la denuncia, estado (`PENDING_REVIEW`, `ACTIVE`, `REJECTED`, `RECOVERED`,
  `WITHDRAWN`), notas del admin, fecha del último cruce.
- `StolenGearMatch` — una coincidencia entre una denuncia y una fila del historial de otro
  fotógrafo: estado (`NEW`, `REVIEWING`, `CONFIRMED`, `DISMISSED`), cuándo se detectó, cuándo
  se avisó, notas del admin.

La serie se normaliza igual para todo (mayúsculas, sin espacios ni guiones ni ceros a la
izquierda) para que "0123-456" y "123456" coincidan.

### Cómo se llena el historial

1. **Desde ahora:** al final de `upsertGearFromObservation` se registra la serie de la cámara y
   la del lente (de `LensSerialNumber`). Envuelto en try/catch.
2. **Lo anterior:** la migración carga el historial desde `PhotographicCameraBody` (cámaras) y
   desde `PhotographicGearObservation.rawExifSummary` (lentes de las fotos que siguen vivas).

### El cruce

Una denuncia activa coincide con una fila del historial cuando: mismo tipo, misma serie
normalizada, otro fotógrafo (no el denunciante) y la fila se vio **después** de la fecha del
robo (menos 1 día de margen). Lo visto antes del robo aparece en el historial de la denuncia,
pero no dispara aviso. Si la marca no coincide se guarda igual pero marcado como "marca
distinta" (puede ser otro equipo con la misma serie).

- Tarea diaria `/api/cron/stolen-gear-scan` a las 9:00 (hora argentina).
- Al aprobar una denuncia se cruza en el momento.
- Si hay coincidencias nuevas, un único correo al administrador (`ADMIN_EMAIL`) con cuántas y un
  link al panel. El correo no incluye datos personales: sólo marca/modelo y el link.

### Pantallas

- Fotógrafo: `/fotografo/equipos-robados` (sin link en el menú por ahora). Formulario de
  denuncia que ofrece elegir entre las cámaras que CLF ya le detectó (completa marca, modelo y
  serie) o cargarlo a mano; subida de factura y denuncia; lista de sus denuncias con su estado;
  puede retirar una denuncia o marcarla como recuperada.
- Admin: `/admin/equipos-robados` (con entrada en el menú admin): denuncias por estado, aprobar
  o rechazar viendo la factura (URL firmada temporal), coincidencias con el fotógrafo, el álbum
  y las fechas, marcar coincidencias como confirmadas o descartadas, marcar recuperado. Buscador
  de número de serie con historial completo.

### Archivos

Factura y denuncia van al bucket de CLF bajo `stolen-gear/` con nombre aleatorio, igual que las
selfies. Se ven sólo con URL firmada desde el panel admin. Las imágenes se achican en el
navegador antes de subir (para no pasar el límite de 4,5 MB de Vercel); PDF hasta 4 MB.

## Decisiones tomadas por el constructor

- Cruce diario (no cada 30 días): es una consulta barata, y avisa antes.
- Sin cruce por modelo sin serie (ver no-objetivos).
- Página del fotógrafo accesible por link pero fuera del menú, para que "no sea visible" hasta
  que Daniel decida lanzarla.
- Los lentes se cruzan sólo por el número de serie del lente cuando la cámara lo graba.
