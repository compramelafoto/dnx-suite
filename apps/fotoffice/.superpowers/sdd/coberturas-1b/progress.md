
Tanda 4 (Tarea 6): complete — bb44ec06. tests lib/coverages 288/288; tsc limpio; lint y build sin problemas nuevos.
  Decisiones del implementador aceptadas: `order: 65` en el menú del portal; nota sobre el índice único (roleId, memberId) queda anotada para "retirar postulación" (fuera de 1b).
Ruling: el plan confunde "todos los roles llenos" con "equipo confirmado". Resolución: la convocatoria pasa a COMPLETA cuando `todosLosRolesCompletos` (asignaciones vivas), y la cobertura pasa a EQUIPO_CONFIRMADO sólo cuando `equipoConfirmado` (todas aceptadas). Si no, se le avisa a la ONG que el equipo está listo mientras las invitaciones siguen sin responder. Costo si me equivoco: el correo team-complete sale más tarde de lo que alguien esperaba.

Tanda 5 (Tareas 7 y 8): complete — 7a2d618f, 0b45f1ef. lib/coverages 314/314; el resto sin problemas nuevos.
Ruling (duda 1 del implementador): las postulaciones que quedan en RECIBIDA se cierran solas cuando la cobertura llega a EQUIPO_CONFIRMADO, en la misma transacción, pasando a NO_SELECCIONADA. Sin correo. Si no, el voluntario ve "te anotaste" para siempre. Costo si me equivoco: alguien se entera por la pantalla y no por un aviso.
Ruling (duda 3 del implementador): una invitación directa sí saca a la cobertura de PLANIFICADA a BUSCANDO_EQUIPO, y la convocatoria se puede crear también desde BUSCANDO_EQUIPO. Así cada estado conserva un solo significado y el modo DIRECTA no deja coberturas varadas. Costo si me equivoco: hay que revisar los dos guardas puros de convocatoria.ts.
Duda 2 (reinvitar a quien rechazó) queda anotada como deuda, igual que la de retirar postulación: las dos son el mismo índice único y se resuelven juntas fuera de 1b.

Tanda 6 (Partes A/B + Tarea 9): complete — 908e31c6, 62a958cc. 2802 tests pasan; sin problemas nuevos.
Aceptadas las tres decisiones del implementador: el corte de postulaciones usa canTransitionApplication (alcanza también EN_REVISION y PRESELECCIONADA); planPublicarConvocatoria devuelve moverCobertura y no escribe una transición nula; team-complete paga dos lecturas por confirmación a cambio de decidir la rotación del enlace antes de la transacción.
Ruling (duda 3): call-published sale a todos los colaboradores activos sin mirar visibility. Filtrar por zona o especialidad es la recomendación de candidatos, que el plan deja explícitamente fuera de 1b. Costo si me equivoco: un workspace con convocatorias por zona manda correos de más hasta que se implemente.

Tanda 7 (Tarea 10): complete — e22d61ad, 455bd052. 2834 pasan; lib/coverages 393. Barrera de aislamiento reprobada con infractora de mentira y vuelta a verde.
Bug real encontrado y arreglado: una invitación directa publicaba sola la convocatoria en BORRADOR (sin publishedAt, sin puedePublicarse, sin correo).
Pendiente para la tanda de arreglos finales: (a) el catch de las dos acciones de armar equipo traduce cualquier error a "ya está en el equipo" — distinguir P2002; (b) listActiveCollaboratorEmails no mira el estado del socio en el padrón: alguien de baja sigue recibiendo avisos.
Ruling: el cron de vencimiento y las pantallas de cierre (VENCIDA, REALIZADA, ENTREGADA, CERRADA, CANCELADA) son 1c, no 1b. El plazo funciona igual porque puedePostularse mira la fecha.
