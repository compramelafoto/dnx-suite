# Glosario de contenidos — Clickatón

**Etapa:** 01 — Términos visibles unificados (propuesta)  
**Fecha:** 2026-08-01  
**Criterios:** español claro · voseo · fechas es-AR · hora 24 h · importes en pesos argentinos  
**Uso:** fuente de verdad de copy para Etapa 02+. No reemplaza textos legales definitivos.

---

## 1. Principios

1. Un concepto = un término en toda la UI.  
2. Interno (Prisma, enums, OAuth, webhooks) no va al público.  
3. Admin ve lenguaje operativo; detalle técnico en «Información técnica».  
4. Botones dicen el resultado («Publicar distribución», no «Activar»).  
5. Estados se muestran en español; el enum queda en backend.

---

## 2. Entidades y objetos

| Evitar en UI | Usar | Notas |
|---|---|---|
| ClickatonRegistration / Registration | Inscripción | |
| Order (local) | Cobro / pago | No existe Order local; no mencionar Prisma |
| Edition | Edición / maratón (según contexto) | Público: «maratón» o nombre del evento |
| Venue | Sede | |
| Ticket type | Tipo de entrada | |
| Product / variant | Producto / talle o variante | Mostrar nombre humano, no `productVariantId` |
| Hold | Reserva | «Tu lugar está reservado hasta…» |
| Credential | Credencial | |
| QR | Código QR / QR de acreditación | |
| Welcome Card | Placa de bienvenida | Marca interna solo en técnico |
| Prompt / consigna | Consigna | |
| Submission / upload | Envío de fotografía / carga de foto | Público: preferir «envío» o «cargar foto» |
| Fulfillment | Entrega del kit | |
| Allocation / recipient | Beneficiario / parte del reparto | |
| Collector | Cuenta de Mercado Pago (cobro) | No «collector» en UI |
| DNX Payments | (oculto público) · «Pagos DNX» solo admin avanzado | Público: «Mercado Pago» |
| Cuenta DNX | Tu cuenta / cuenta Clickatón | Evitar sigla en CTA primario |
| FotoRank | FotoRank (nombre de producto) | Explicar: «donde se juzga la competencia» |
| Webhook / reconciliación | «Confirmamos el pago automáticamente» | |
| OAuth | «Conexión con Mercado Pago» | |
| PKCE / client_id / vault | Solo «Información técnica» | Nunca env vars en UI |

---

## 3. Estados — inscripción

| Enum | Label visible | Descripción corta (helper) |
|---|---|---|
| DRAFT | Borrador | Empezaste la inscripción, todavía no está completa. |
| PENDING_PAYMENT | Pago pendiente | Reservamos tu lugar. Completá el pago antes de que venza. |
| CONFIRMED | Confirmada | Estás inscripto. Ya podés ver el QR y la credencial. |
| WAITLISTED | Lista de espera | Hay cupo limitado. Te avisamos si se libera un lugar. |
| CANCELLED | Cancelada | Esta inscripción ya no está activa. |
| REFUNDED | Reembolsada | Se devolvió el importe según las condiciones del evento. |
| DISQUALIFIED | Descalificada | La organización invalidó la participación. |
| TRANSFERRED_TO_NEXT_EDITION | Trasladada a próxima edición | Tu lugar pasó a otra edición. |
| EXPIRED | Expirada | Se venció el tiempo de reserva o de pago. |
| REFUND_REQUESTED | Reembolso solicitado | Pediste la devolución; estamos revisándola. |

---

## 4. Estados — pago

| Enum | Label visible | Descripción corta |
|---|---|---|
| NOT_REQUIRED | Sin cobro | Esta inscripción no requiere pago. |
| PENDING | Cobro pendiente | Todavía no recibimos el pago. |
| PROCESSING | Procesando cobro | El pago está en curso. No vuelvas a pagar. |
| APPROVED | Cobro aprobado | El pago se acreditó. |
| FAILED | Cobro fallido | No se pudo completar el pago. Probá de nuevo. |
| EXPIRED | Cobro expirado | Se venció el tiempo para pagar. |
| CANCELLED | Cobro cancelado | El cobro se canceló. |
| REFUNDED | Cobro reembolsado | Se devolvió el importe. |
| PARTIALLY_REFUNDED | Reembolso parcial | Se devolvió una parte del importe. |
| MANUAL_REVIEW | En revisión | El equipo está revisando este cobro. |

---

## 5. Estados — entrega de kit (fulfillment)

| Enum | Label visible | Descripción |
|---|---|---|
| PENDING | Pendiente de entrega | Todavía no se entregó en sede. |
| READY | Listo para entregar | Preparado para entregar. |
| DELIVERED | Entregado | El participante ya recibió el ítem. |
| CANCELLED | Entrega cancelada | Este ítem no se entrega. |

---

## 6. Estados — placa de bienvenida

| Enum | Label visible | Descripción |
|---|---|---|
| PENDING | Pendiente | Todavía no generamos la placa. |
| GENERATED | Lista | Ya podés verla y compartirla. |
| FAILED | No se pudo generar | Revisá la foto de perfil o pedí ayuda. |

---

## 7. Estados — consignas (participante)

| Enum | Label visible | Descripción |
|---|---|---|
| LOCKED | Bloqueada | Se abre según el cronograma del evento. |
| RELEASED / READY | Disponible | Ya podés cargar tu fotografía. |
| CLOSED | Cerrada | Terminó el plazo de envío. |
| DRAFT (admin) | Borrador | No publicada para participantes. |

---

## 8. Estados — envío de fotografía

| Enum propuesto (UI) | Descripción |
|---|---|
| Pendiente de confirmación | Recibimos el archivo; lo estamos validando. |
| Confirmado | El envío es válido. |
| Rechazado | No cumple los requisitos. Revisá el mensaje. |
| Fallido | Hubo un error al procesar el archivo. |
| En revisión manual | El equipo lo está revisando. |
| Procesando | Estamos analizando la foto. |

(Mapear desde enums backend: `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `FAILED`, `MANUAL_REVIEW`, `PROCESSING`.)

---

## 9. Estados — edición

Usar `EDITION_STATUS_LABELS` existentes (Borrador, Inscripción abierta, etc.).  
Publicada / No publicada como badges secundarios.

---

## 10. Estados — conexión Mercado Pago (admin)

| Evitar | Usar |
|---|---|
| NOT_CONNECTED | Sin conectar |
| OAUTH_PENDING | Conexión en curso |
| ACTIVE | Conectada |
| NEEDS_REAUTH | Hay que volver a conectar |
| REVOKED | Desconectada |

Descripción CTA: «Conectá la cuenta de Mercado Pago que recibirá los pagos.»

---

## 11. Estados — publicaciones sociales (admin)

| Enum | Label |
|---|---|
| PENDING_APPROVAL | Pendiente de aprobación |
| APPROVED | Aprobada |
| SCHEDULED | Programada |
| PUBLISHED | Publicada |
| FAILED | Falló la publicación |
| CANCELLED | Cancelada |
| REJECTED | Rechazada |

---

## 12. Cronograma / finanzas (admin operativo)

| Evitar | Usar |
|---|---|
| ACTIVE (timeline/distribution) | Versión publicada |
| DRAFT | Borrador |
| Asegurar DRAFT | Crear borrador |
| Activar (distribución) | Publicar distribución |
| Fee policy | Política de comisiones (solo técnico) |
| Timezone | Zona horaria |
| frozen | Cerrado / no editable |

---

## 13. Botones y CTAs (patrones)

| Ambiguo | Preferido |
|---|---|
| Continuar | Continuar a [paso siguiente] |
| Procesar / Ejecutar | Decir la acción concreta |
| Aplicar | Aplicar filtros / Aplicar código |
| Activar | Publicar / Activar cuenta / Activar consignas (según objeto) |
| Asegurar DRAFT | Crear borrador de cronograma |
| Asegurar config upload | Crear configuración de carga de fotos |
| Pagar (TEST) | Pagar (entorno de prueba) — solo non-prod |
| CREAR / ACTIVAR MI CUENTA DNX | Creá tu cuenta para ver el QR |
| REENVIAR EMAIL | Reenviar email de confirmación |
| Scanner | Escanear credencial |

---

## 14. Fechas, horas e importes

| Tipo | Formato |
|---|---|
| Fecha corta | `dd/mm/aaaa` (es-AR) |
| Fecha + hora | `dd/mm/aaaa HH:mm` (24 h) |
| Rango evento | «19 de septiembre de 2026, 14:00 a 22:00 (hora Argentina)» |
| Importe | `$25.000` o `ARS 25.000` — siempre indicar moneda |
| Gratis | «Gratis» |

Reutilizar `formatArDateTime` / `formatArsDisplay` / `formatPublicPrice` donde existan.

---

## 15. Mensajes de error (tono)

| Evitar | Preferir |
|---|---|
| Códigos `CARD_PAYMENT_FAILED` | «No pudimos procesar el pago con esta tarjeta. Probá de nuevo o usá otro medio.» |
| Stack / Prisma / function names | Nunca en UI |
| «Error del backend» | «Algo falló de nuestro lado. Probá en unos minutos.» |
| JSON crudo | Mensaje + «Código de soporte: XXX» solo si ayuda a ops |

---

## 16. Términos LEGAL_REVIEW (no redefinir aquí)

Mantener wording legal hasta aprobación; en UI no legal usar:

| Concepto | Glosa operativa (no jurídica) |
|---|---|
| Bases y condiciones | «Reglas de inscripción y participación» |
| Política de privacidad | «Cómo usamos tus datos» |
| Uso de imagen | «Autorización para usar tu foto de perfil / placa» |
| Publicación en redes | «Posible publicación de tu placa en redes del evento» |
| Reembolso | «Devolución del dinero» |
| Licencia promocional | Dejar en bases; no resumir en UI sin legal |

---

## 17. Vocabulario de roles (UI)

| Rol | Cómo nombrarlo |
|---|---|
| Participante / fotógrafo | Participante |
| Admin allowlist | Equipo Clickatón / Administración |
| Organizador (allocation) | Beneficiario organizador (finanzas) — no panel propio |
| Jurado | Jurado (en FotoRank); en Clickatón: «La evaluación se hace en FotoRank» |

---

## 18. Checklist de consistencia para PRs de copy

- [ ] ¿El estado se muestra con label del glosario?  
- [ ] ¿El botón dice el resultado?  
- [ ] ¿Hay explicación de 1 línea si el concepto es nuevo?  
- [ ] ¿Se ocultó jargon (webhook, OAuth, Prisma, IDs)?  
- [ ] ¿Fechas/importes en formato AR?  
- [ ] ¿Texto legal tocado? → etiqueta LEGAL_REVIEW y no mergear como definitivo.
