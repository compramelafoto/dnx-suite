# Finanzas DNX — Etapa 1b: lo que falta para usarlo todos los meses

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Que el dueño pueda mantener el módulo solo, sin depender de que alguien escriba SQL.

**Architecture:** Se agrega la fecha de vencimiento al gasto, se completan las operaciones de edición y baja que faltaban, y las pantallas dejan de ser de sólo lectura. Mismo patrón que la etapa 1: rutas de API bajo `/api/admin/finance-dnx/` más componentes cliente.

**Spec:** `docs/superpowers/specs/2026-09-11-finanzas-dnx-control-de-gastos-design.md`

## Por qué existe esta etapa

La etapa 1 quedó de sólo escritura: se puede cargar, no corregir. En la práctica eso significa que
**cuando el dueño pague las facturas rechazadas no puede marcarlas como pagadas**, y el módulo va a
seguir mostrando una deuda que ya no existe. Es el primer uso real del módulo y está bloqueado.

Las cinco piezas, en orden de urgencia:

1. **Editar y borrar un gasto** — bloquea el uso de hoy.
2. **Fecha de vencimiento** — sin ella el módulo no puede avisar nada. Es el dato que habría evitado enterarse cuatro meses tarde de que Neon venía rechazando.
3. **Cargar el dólar del mes desde la pantalla** — la ruta existe y nadie la llama.
4. **Dar de baja un proveedor** — la pantalla muestra el estado y no deja cambiarlo.
5. **Aviso mensual por correo** — "faltan cargar los gastos de agosto". Queda para una etapa posterior.

## Global Constraints

- Textos, comentarios y mensajes de error en **español**.
- Toda ruta bajo `/api/admin` lleva `requireAuth([Role.ADMIN])` como primera línea: el middleware excluye `/api` y el layout sólo protege páginas.
- Prisma devuelve `Decimal`: convertir a número en el borde de la API, nunca dentro de `@repo/finance-control`.
- Dinero en unidades menores enteras dentro del paquete puro, sufijo `Minor`. **El sufijo `Cents` está prohibido.**
- La migración se aplica a mano sobre la rama `production` de `divine-hall-10689679` y se registra en `_prisma_migrations` en la misma sesión.
- Sin server actions.

---

### Task 1: Fecha de vencimiento en el gasto

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `ExpenseEntry`)
- Create: `packages/db/prisma/migrations/<timestamp>_finanzas_vencimiento/migration.sql`

- [ ] **Step 1:** agregar al modelo `ExpenseEntry`, después de `status`:

```prisma
  /// Cuándo vence la factura. Permite avisar antes de que un rechazo se vuelva un corte.
  dueDate            DateTime?
```

- [ ] **Step 2:** `pnpm --filter @repo/db exec prisma generate` — debe terminar sin errores.
- [ ] **Step 3:** generar el SQL comparando esquema contra esquema, **sin conectarse a ninguna base**:

```bash
git show HEAD:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma
pnpm --filter @repo/db exec prisma migrate diff \
  --from-schema-datamodel /tmp/schema-antes.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

Debe contener **sólo** `ALTER TABLE "ExpenseEntry" ADD COLUMN "dueDate"`. Si toca otra tabla, detenerse y reportar.

- [ ] **Step 4:** commit. **No aplicar la migración**: eso lo hace el controlador con confirmación del dueño.

---

### Task 2: Editar, borrar y dar de baja

**Files:**
- Create: `apps/compramelafoto/app/api/admin/finance-dnx/expenses/[id]/route.ts`
- Modify: `apps/compramelafoto/lib/finance-dnx/expense-form.ts`
- Modify: `apps/compramelafoto/lib/finance-dnx/vendor-form.ts`
- Modify: `apps/compramelafoto/app/api/admin/finance-dnx/vendors/[id]/route.ts`
- Test: `apps/compramelafoto/lib/finance-dnx/expense-form.test.ts`, `vendor-form.test.ts`

**Interfaces:**
- Produces: `PUT /api/admin/finance-dnx/expenses/[id]` y `DELETE /api/admin/finance-dnx/expenses/[id]`.
- `parseVendorForm` pasa a aceptar `active: boolean` (por defecto `true` si no viene).

- [ ] **Step 1:** escribir primero las pruebas de `parseVendorForm` con `active`:

```ts
test("acepta un proveedor dado de baja", () => {
  const resultado = parseVendorForm({ ...valido, active: false });
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.equal(resultado.value.active, false);
});

test("si no viene el estado, el proveedor queda activo", () => {
  const resultado = parseVendorForm(valido);
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.equal(resultado.value.active, true);
});
```

- [ ] **Step 2:** correrlas y verlas fallar. **Step 3:** agregar `active` a `VendorForm` y a `parseVendorForm`, y persistirlo en el `PUT` de proveedores.
- [ ] **Step 4:** `PUT /expenses/[id]`: valida con `parseExpenseForm`, recalcula `amountArs`, **borra y recrea el reparto** con `splitAmountByAllocation` sobre el reparto vigente del proveedor, todo dentro de un `$transaction`. Guard de admin primero, `try/catch` con `console.error`, `P2025` → 404, `P2002` → 409.
- [ ] **Step 5:** `DELETE /expenses/[id]`: borra el gasto; el reparto se va solo por el `onDelete: CASCADE`. Guard primero, `P2025` → 404.
- [ ] **Step 6:** `pnpm --filter compramelafoto test:finance-dnx` y `NODE_OPTIONS='--max-old-space-size=8192' pnpm --filter compramelafoto typecheck`, ambos en verde y pegados en el informe.
- [ ] **Step 7:** commit.

---

### Task 3: Las pantallas dejan de ser de sólo lectura

**Files:**
- Modify: `apps/compramelafoto/app/admin/finanzas-dnx/gastos/page.tsx`
- Modify: `apps/compramelafoto/app/admin/finanzas-dnx/proveedores/page.tsx`

- [ ] **Step 1:** en **Gastos**, cada fila de la tabla gana un botón de editar y uno de borrar. Editar abre el mismo formulario de alta con los datos cargados y llama al `PUT`. Borrar pide confirmación nombrando el proveedor y el mes antes de llamar al `DELETE` — es destructivo y no se deshace.
- [ ] **Step 2:** en **Gastos**, agregar el campo de **fecha de vencimiento** al formulario, y en la tabla marcar en rojo las facturas vencidas y sin pagar.
- [ ] **Step 3:** en **Gastos**, un bloque chico para **cargar el dólar del mes**: muestra el valor actual de `GET /fx`, permite editarlo y lo guarda con `PUT /fx`. Es lo que hoy no tiene forma de cargarse.
- [ ] **Step 4:** en **Proveedores**, el estado Activo/Inactivo pasa a ser editable y se envía en el formulario.
- [ ] **Step 5:** `typecheck` limpio. Commit.

---

## Fuera de alcance, para después

- **Aviso mensual por correo** el día 5: "faltan cargar los gastos de <mes>", con la lista de proveedores que faltan. Es la pieza que convierte el módulo en algo que te busca a vos en vez de esperarte.
- Traer facturas automáticamente de los proveedores: **no es posible**, ninguno las expone por API.
