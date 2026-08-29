import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TEMPLATE_V2_POLICY,
  requireTemplateV2ReadAccess,
  requireTemplateV2WriteAccess,
} from "../services/template-v2-authorization";
import type { TemplateV2AccessPolicy } from "../services/template-v2-policy";

/** La política que declara FotoOffice: la plantilla es de la institución, no de la persona. */
const FOTOFFICE: TemplateV2AccessPolicy = {
  canDesign: () => true,
  isAdmin: () => false,
  owns: (user, template) =>
    template.workspaceId != null && user.workspaceId != null
      ? template.workspaceId === user.workspaceId
      : template.ownerUserId === user.id,
};

const duenio = { id: 3, role: "WORKSPACE_OWNER", workspaceId: "ws_sfpr" };
const carnetSfpr = { id: "t1", ownerUserId: 99, status: "ACTIVE", workspaceId: "ws_sfpr" };

test("el dueño de la institución abre el carnet de su institución", () => {
  // La regresión concreta: esto tiraba 403 TEMPLATE_FORBIDDEN porque WORKSPACE_OWNER no
  // figuraba en la lista de roles de otra aplicación.
  const r = requireTemplateV2ReadAccess({
    user: duenio,
    template: carnetSfpr,
    policy: FOTOFFICE,
  });
  assert.equal(r.id, "t1");
});

test("y lo puede editar aunque lo haya creado otra persona", () => {
  // ownerUserId 99 ≠ 3 a propósito: quien creó la plantilla puede haber dejado la comisión.
  const r = requireTemplateV2WriteAccess({
    user: duenio,
    template: carnetSfpr,
    policy: FOTOFFICE,
  });
  assert.equal(r.id, "t1");
});

test("no ve la plantilla de otra institución", () => {
  const ajena = { id: "t2", ownerUserId: 3, status: "ACTIVE", workspaceId: "ws_otra" };
  assert.throws(
    () => requireTemplateV2ReadAccess({ user: duenio, template: ajena, policy: FOTOFFICE }),
    /no encontrada/i,
  );
});

test("ni la puede editar, aunque la haya creado esa misma persona", () => {
  // El agujero que esto cierra: con `isAdmin: () => true` alcanzaba con adivinar el id.
  const ajena = { id: "t2", ownerUserId: 3, status: "ACTIVE", workspaceId: "ws_otra" };
  assert.throws(
    () => requireTemplateV2WriteAccess({ user: duenio, template: ajena, policy: FOTOFFICE }),
    /no encontrada/i,
  );
});

test("una plantilla sin institución se cae a la regla del dueño original", () => {
  const suelta = { id: "t3", ownerUserId: 3, status: "ACTIVE", workspaceId: null };
  assert.equal(
    requireTemplateV2ReadAccess({ user: duenio, template: suelta, policy: FOTOFFICE }).id,
    "t3",
  );
  const deOtro = { id: "t4", ownerUserId: 77, status: "ACTIVE", workspaceId: null };
  assert.throws(
    () => requireTemplateV2ReadAccess({ user: duenio, template: deOtro, policy: FOTOFFICE }),
    /no encontrada/i,
  );
});

test("sin política, rige la de siempre: no cambia nada para Clickatón", () => {
  const fotografo = { id: 7, role: "PHOTOGRAPHER" };
  const suya = { id: "t5", ownerUserId: 7, status: "ACTIVE" };
  assert.equal(requireTemplateV2ReadAccess({ user: fotografo, template: suya }).id, "t5");

  const ajena = { id: "t6", ownerUserId: 8, status: "ACTIVE" };
  assert.throws(
    () => requireTemplateV2ReadAccess({ user: fotografo, template: ajena }),
    /no encontrada/i,
  );

  const cualquiera = { id: 9, role: "CLIENT" };
  assert.throws(
    () => requireTemplateV2ReadAccess({ user: cualquiera, template: suya }),
    /Sin permisos de diseñador/,
  );
});

test("la política por omisión sigue siendo la del dueño de la fila", () => {
  assert.equal(
    DEFAULT_TEMPLATE_V2_POLICY.owns({ id: 5, role: "ADMIN" }, {
      id: "t",
      ownerUserId: 5,
      status: "ACTIVE",
    }),
    true,
  );
  assert.equal(
    DEFAULT_TEMPLATE_V2_POLICY.owns({ id: 5, role: "ADMIN" }, {
      id: "t",
      ownerUserId: 6,
      status: "ACTIVE",
    }),
    false,
  );
});
