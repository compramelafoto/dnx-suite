import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryConversationStore } from "../in-memory-conversation-store.js";
import { processIncomingMessage } from "../../pipeline/process-incoming-message.js";
import {
  assertClientSafeText,
  composeClientSalesReply,
  detectRoleSignal,
  getSystemPromptForRole,
  resolveConversationRole,
  transitionConversationRole,
} from "./index.js";

describe("conversation role detection", () => {
  it("entra a CLIENT por lenguaje natural", () => {
    const phrases = [
      "Simulemos un cliente.",
      "Quiero probar una conversación con un cliente.",
      "Actuá como si fueras un cliente.",
      "Quiero ver cómo responderías a un cliente.",
      "Hablemos como si yo fuera un cliente.",
      "Entrá en modo cliente.",
      "Simulemos una conversación con un cliente.",
    ];
    for (const p of phrases) {
      const s = detectRoleSignal(p, "OWNER");
      assert.equal(s.action, "ENTER", p);
      if (s.action === "ENTER") assert.equal(s.role, "CLIENT");
    }
  });

  it("sale a OWNER por lenguaje natural", () => {
    const phrases = [
      "Terminemos la simulación.",
      "Volvé al modo normal.",
      "Volvé a hablar conmigo como propietario.",
      "Ya está.",
    ];
    for (const p of phrases) {
      const s = detectRoleSignal(p, "CLIENT");
      assert.equal(s.action, "EXIT", p);
    }
  });

  it("ya está no sale si estamos en OWNER", () => {
    assert.equal(detectRoleSignal("Ya está.", "OWNER").action, "NONE");
  });
});

describe("conversation role persistence via pipeline", () => {
  async function turn(store: InMemoryConversationStore, text: string) {
    return processIncomingMessage(
      {
        message: {
          from: "5493410000999",
          text,
          channel: "telegram",
          receivedAt: new Date().toISOString(),
        },
      },
      { store, styleEngine: "dani-conversation-v1" },
    );
  }

  it("entra, recuerda rol, cambia dos veces y conserva draft", async () => {
    const store = new InMemoryConversationStore();
    const enter = await turn(store, "Simulemos una conversación con un cliente.");
    assert.match(enter.text, /cliente real|modo propietario/i);
    assert.equal(resolveConversationRole(enter.memory.roleState), "CLIENT");
    assert.match(enter.text, /No mostraré mínimos sostenibles/i);

    const mid = await turn(store, "Hola. Me caso en Rosario.");
    assert.equal(resolveConversationRole(mid.memory.roleState), "CLIENT");
    assert.equal(assertClientSafeText(mid.text), true);
    assert.equal(/m[ií]nimo sostenible|OWNER|factor comercial/i.test(mid.text), false);
    assert.ok(mid.quoteRequest?.draft.city === "Rosario" || mid.quoteRequest?.draft.serviceType);

    const exit = await turn(store, "Terminemos la simulación.");
    assert.match(exit.text, /Volvimos al modo propietario/i);
    assert.equal(resolveConversationRole(exit.memory.roleState), "OWNER");
    assert.equal(exit.memory.roleState?.previousRole, "CLIENT");

    // contexto preservado
    const id = enter.memory.conversationId;
    const stored = await store.get(id);
    assert.equal(stored?.quoteRequestDraft?.city, "Rosario");

    const reenter = await turn(store, "Entrá en modo cliente.");
    assert.equal(resolveConversationRole(reenter.memory.roleState), "CLIENT");
    const reexit = await turn(store, "Volvé al modo normal.");
    assert.equal(resolveConversationRole(reexit.memory.roleState), "OWNER");
  });

  it("conversación larga en CLIENT sin precios ni explicación interna", async () => {
    const store = new InMemoryConversationStore();
    await turn(store, "Simulemos un cliente.");
    const turns = [
      "Hola.",
      "Me caso en Rosario.",
      "¿Qué me podés ofrecer?",
      "Es el 20 de noviembre de 2026.",
      "Son ocho horas.",
    ];
    for (const text of turns) {
      const res = await turn(store, text);
      assert.equal(resolveConversationRole(res.memory.roleState), "CLIENT");
      assert.equal(assertClientSafeText(res.text), true);
      assert.equal(/m[ií]nimo|recomendado|ARS\s*\d|\$\s*\d/i.test(res.text), false);
      assert.equal(/perfil econ[oó]mico|amortizaci/i.test(res.text), false);
    }
  });

  it("OWNER recupera capacidades tras salir", async () => {
    const store = new InMemoryConversationStore();
    await turn(store, "Simulemos un cliente.");
    await turn(store, "Terminemos la simulación.");
    const owner = await turn(
      store,
      "Tengo un casamiento en Rosario el 20 de noviembre de 2026 y son ocho horas.",
    );
    assert.equal(resolveConversationRole(owner.memory.roleState), "OWNER");
    assert.ok(
      owner.quoteRequest?.status === "READY_FOR_CALCULATION" ||
        owner.quoteRequest?.draft.serviceType === "WEDDING",
    );
    // OWNER puede hablar de presupuesto interno (invitación o estilo socio)
    assert.equal(/simulación de cliente/i.test(owner.text), false);
  });
});

describe("client sales reply + prompts", () => {
  it("cierre comercial sin mínimos", () => {
    const reply = composeClientSalesReply({
      userMessage: "Dale, perfecto",
      draft: {
        serviceType: "WEDDING",
        city: "Rosario",
        eventDate: "2026-11-20",
        durationHours: 8,
      },
      previouslyAskedCommercial: [
        "schedule",
        "ceremony_party",
        "guests",
        "photographers",
        "video",
        "delivery",
      ],
    });
    assert.match(reply.text, /propuesta adecuada/i);
    assert.equal(/m[ií]nimo sostenible/i.test(reply.text), false);
    assert.equal(assertClientSafeText(reply.text), true);
  });

  it("prompts OWNER y CLIENT separados", () => {
    const owner = getSystemPromptForRole("OWNER");
    const client = getSystemPromptForRole("CLIENT");
    assert.match(owner, /propietario|m[ií]nimos/i);
    assert.match(client, /vendedor/i);
    assert.match(client, /Nunca menciones/i);
    assert.notEqual(owner, client);
  });

  it("transition guarda previousRole", () => {
    const next = transitionConversationRole({
      current: {
        role: "OWNER",
        enteredAt: "2026-01-01T00:00:00.000Z",
        enteredBy: "SYSTEM",
      },
      nextRole: "CLIENT",
      at: "2026-01-02T00:00:00.000Z",
      enteredBy: "NATURAL_LANGUAGE",
    });
    assert.equal(next.role, "CLIENT");
    assert.equal(next.previousRole, "OWNER");
  });
});
