# Turnos de servicio — etapa 1: reservar sin cobro

Diseño completo: `docs/superpowers/specs/2026-10-17-turnos-de-servicio-design.md`.
Esta etapa entrega lo mínimo útil: **el cliente reserva solo un turno sin cobro**
(entrevista, llamada, asesoramiento) y el estudio lo ve en su Agenda.

## Qué entra

1. **Base** (migración `20270128090000_fotoffice_turnos_etapa1`, a mano + registro):
   - `FotofficeCitaTipo` suma `isBookable`, `publicDescription`, `durationMinutes`,
     `modality` (ONLINE | TELEFONO | ESTUDIO | DIRECCION) y `address` (dirección o
     enlace de la videollamada).
   - `FotofficeCitaTipoFranja`: franjas semanales del tipo (mismo formato que
     `BookingSpaceHours`).
   - `FotofficeTurnosAjustes`: texto de la página, plazo para cancelar (48 h), margen
     entre turnos, anticipación mínima (24 h) y máxima (60 días), correo de aviso.
   - `FotofficeTurno`: la reserva (contacto, mensaje, estado, token de gestión,
     vínculo a la cita y al cliente, datos de cancelación).
2. **Lógica** en `lib/turnos/`:
   - `franjas.ts`, `disponibilidad.ts`, `plazo.ts`, `formulario.ts`, `ics.ts`: puros, con pruebas.
   - `ocupacion.ts`: citas de la Agenda (no anuladas, del dueño o sin responsable) +
     Google freeBusy del calendario principal y del de la Agenda. Si Google está
     conectado y no responde, no se ofrecen horarios (nunca a ciegas). Si el negocio no
     conectó Google, se usa sólo la Agenda.
   - `reservar.ts`: transacción con `pg_advisory_xact_lock` por negocio, nueva
     verificación con `checkRange`, tope de 3 turnos activos por correo, cliente por
     correo (`findOrCreateClient`), cita CONFIRMADA y turno CONFIRMADO.
   - `gestion.ts`: cancelar y reprogramar por enlace hasta el plazo.
   - `correos.ts`: confirmación al cliente (con `.ics` y enlace de gestión), aviso al
     estudio, cancelación y reprogramación.
3. **Páginas públicas** `/w/[slug]/turnos`, `/w/[slug]/turnos/[tipoId]` y
   `/w/[slug]/turnos/gestion/[token]`.
4. **Configuración**: en Configuración → Agenda → Tipos de cita, cada tipo tiene
   «Turnos online» (publicar, texto, duración, modalidad, franjas) y la página tiene
   sus ajustes generales.
5. La cita del turno entra en la Agenda como cualquier otra y se empuja a Google con el
   empuje existente.

## Qué queda para la etapa 2

Cobro (seña o total por Mercado Pago), confirmación con aprobación y bandeja de
solicitudes, productos y pedido, espacio de Reservas, preguntas propias por tipo,
Meet automático, módulo `appointments` propio (hoy se apoya en el módulo Agenda) y
recordatorio específico del turno (hoy aplica el recordatorio general de la Agenda).

## Pruebas

Unitarias de las piezas puras y de `reservar`/`gestion` sobre la base en memoria
(`lib/circuitos/base-en-memoria.ts`), incluida la doble reserva del mismo horario.
