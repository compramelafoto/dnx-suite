# Equipo: etapas 1 y 2 (fichas, jornada, pase de turno y mensajes)

**Diseño:** `docs/superpowers/specs/2026-10-21-equipo-jornadas-alertas-liquidacion-design.md`
(secciones 1 a 4, "Visibilidad y permisos" y "Orden de construcción").
**Fuera de esta entrega:** saldo inicial (etapa 0, PR #681), alertas, liquidación, logros y
comisiones por rubro (etapas 3 a 6).

## Reglas que no se negocian

- Las empleadas (STAFF) nunca ven un error ni una alerta: todo lo que les llega (saludo, aviso de
  salida, pase de turno) va envuelto para que, si algo falla, simplemente no aparezca.
- Nada bloquea una venta: el pase de turno se puede saltear y la venta cae en el turno abierto, como hoy.
- El panel Equipo es sólo para dueño o administrador (`canManageWorkspaceSettings`).
- Módulo nuevo `equipo`, apagado por defecto (sin fila en `WorkspaceFeatureModule` no existe).
- Los horarios de DNX Estudio los carga el dueño en la ficha: no van en el código.

## Pasos

1. **Base de datos** (`packages/db`): migración `20261216120000_fotoffice_equipo_etapa_1_2`, sólo
   tablas nuevas, idempotente, sin claves foráneas a tablas existentes. Tablas: ficha, valor de la
   jornada (con fecha desde), franjas del horario semanal, cambios puntuales, correcciones de la
   jornada, marcas para revisar, ajustes (tolerancia), piezas de mensajes y mensajes mostrados.
2. **Lógica pura** en `apps/fotoffice/lib/equipo/` con pruebas de vitest:
   - `fechas.ts`: día y minuto en hora argentina.
   - `horario.ts`: horario del día (franjas, sábados alternados, cambios puntuales, feriados).
   - `jornada.ts`: jornada del día desde los turnos de caja (entrada, salida, sin cierre propio,
     llegada tarde, salida temprana, tiempo de más y sin actividad, tolerancia, corrección a mano).
   - `cumpleanos.ts`: qué día se saluda (el mismo si trabaja; si no, su último día de trabajo antes).
   - `mensajes.ts` y `repertorio.ts`: armado del mensaje por piezas, ocasiones (cumpleaños, feriado,
     víspera, fin de semana, fin de mes) y no repetir la misma combinación en 30 días.
   - `pase.ts`: cuándo se ofrece el pase de turno.
3. **Servidor**: `acceso.ts` (guarda del panel), `repositorio.ts`, `mensajes-servidor.ts`.
4. **Pantallas** (`app/(shell)/equipo`): Jornadas (hoy y por día), ficha de cada persona (datos,
   horario, valor de la jornada, cambios puntuales, jornadas recientes con corrección), Mensajes
   (repertorio editable) y Configuración (tolerancia).
5. **Caja**: pase de turno en `/caja` cuando el turno abierto es de otra persona del equipo; saludo
   al abrir (`/caja`) y al cerrar (`/caja/turnos`).
6. **Aviso de salida** en `AdminShell`: aparece 5 minutos antes del fin del horario si tiene un
   turno abierto a su nombre; se cierra con una cruz y no vuelve ese día.
7. **Registro y menú**: `lib/modules/registry.ts` (clave `equipo`) y la sección Equipo del menú,
   sólo para dueño o administrador.
8. **Verificación**: tsc, vitest (equipo, cash, modules) y `pnpm build`. PR sin fusionar, sin
   aplicar la migración y sin encender el módulo.
