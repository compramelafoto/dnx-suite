# Residuales de copy — Imp. 09

Textos que permanecen tras la pasada global. No son regresiones de lógica.

| Texto residual | Ruta / componente | Motivo | Nombre propio | Técnico no visible | Integración | Decisión humana | Próxima acción |
|---|---|---|---|---|---|---|---|
| “Sponsors locales” | `content/organizar-sede.ts` | Copy marketing histórico | Parcial | No | No | Producto/marca | Revisar con contenido |
| “Eyebrow…” | `/design-system` | Showcase DS interno | No | No | No | No | OUT_OF_SCOPE |
| `SUPER_ADMIN` en código | `lib/admin/*` | No visible en UI | No | Sí | No | No | Mantener |
| Valores enum en `<option value>` | filtros admin | Valor de query, label ES | No | Sí (value) | No | No | Mantener |
| “FotoRank” / “Mercado Pago” / “Resend” | varias | Marcas | Sí | No | Sí | No | Mantener |
| “Variante” en algunos flash keys internos | actions | Keys no visibles; títulos ES | No | Sí | No | No | OK |
| Legal funnel anglicismos | `content/legal-funnel.ts` | LEGAL_REVIEW | No | No | No | Legal | No reescribir aquí |
| Mensajes admin inbox genéricos | `/admin/mensajes` | Bajo uso | No | No | No | Producto | PARTIAL futuro |
| Device `status` crudo en acreditación | dispositivos list | Operativo bajo | No | Parcial | No | Producto | Mapear si crece uso |
| Design tokens / class names EN | CSS/TSX | No UI copy | No | Sí | No | No | N/A |

## Residuales corregidos en Imp. 09

Dashboard, Sponsors→Patrocinadores, Banners Home, Slug→Identificador de URL, asset id, Eyebrow form, MVP en config/dashboard/sedes, Catálogo nav, acceso denegado, 404, loading, integraciones statusLabel.
