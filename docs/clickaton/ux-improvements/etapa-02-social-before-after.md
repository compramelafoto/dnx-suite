# Etapa 02 Imp. 08 — Antes / después (placas, social, correos)

Solo presentación.

| Concepto | Antes | Después |
|---|---|---|
| Asset | “Vista previa del asset” | Vista previa de la placa / pieza |
| Render | Implícito / job | Fuera del lenguaje operativo |
| Template | templateRef visible | En información técnica |
| Job / Queue | Enum + ID mono | Estado humano + técnico colapsado |
| Story | No tipificado | “Historia” para placa de bienvenida |
| Carousel | N/A en cola actual | No prometido si no existe |
| Publisher LIVE | `DNX_…=true` en description | Banner “Publicación automática desactivada/habilitada” |
| Scheduled | `SCHEDULED` | “Programada” + fecha en español |
| Published | `PUBLISHED` | “Publicada” |
| Sent | Mezclado con entregado | “Correo enviado” (aceptado) |
| Delivered | Igual que sent | “Correo entregado” |
| Bounced | Status crudo / reason | “No pudo entregarse” + próximo paso |
| Regenerar | “Volver a generar placa” / “Reintentar” | Generar vs Volver a generar vs Volver a intentar |
| Reenviar | “Reenviar confirmación” | “Reenviar correo” + confirm de duplicación |
| Vista móvil | Lista densa + IDs | Cards, preview vertical, acciones full-width |
| Información técnica | ID en cabecera | `AdminTechnicalInfo` cerrado |
