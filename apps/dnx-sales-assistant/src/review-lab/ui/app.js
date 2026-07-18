const state = {
  sessionId: null,
  lastTurnNumber: null,
};

const $ = (id) => document.getElementById(id);

function showError(msg) {
  const el = $("error");
  el.hidden = !msg;
  el.textContent = msg || "";
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "No pude procesar este turno. Reiniciá la conversación o probá nuevamente.");
  }
  return data;
}

async function apiGet(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error("No pude cargar datos del laboratorio.");
  return data;
}

function renderChat(session) {
  const chat = $("chat");
  chat.innerHTML = "";
  for (const turn of session.turns || []) {
    const user = document.createElement("div");
    user.className = "bubble user";
    user.innerHTML = `<div class="meta">Turno ${turn.turnNumber} · Vos</div><div></div>`;
    user.lastChild.textContent = turn.userMessage;
    const bot = document.createElement("div");
    bot.className = "bubble bot";
    const review = turn.humanReview
      ? ` · ${turn.humanReview.verdict}`
      : "";
    bot.innerHTML = `<div class="meta">Asistente · score ${turn.diagnostics.daniScore}${review}</div><div></div>`;
    bot.lastChild.textContent = turn.assistantMessage;
    chat.append(user, bot);
  }
  chat.scrollTop = chat.scrollHeight;
}

function renderDiag(turn) {
  if (!turn) return;
  const d = turn.diagnostics;
  $("engine-badge").textContent = `Motor: ${d.styleEngine}`;
  $("d-intent").textContent = d.intent || "—";
  $("d-status").textContent = d.conversationStatus || "—";
  $("d-quote").textContent = d.quoteStatus || "—";
  $("d-known").textContent = (d.knownFields || []).join(", ") || "—";
  $("d-learned").textContent = (d.fieldsLearnedThisTurn || []).join(", ") || "—";
  $("d-corrected").textContent = (d.correctedFields || []).join(", ") || "—";
  $("d-missing").textContent = (d.missingFields || []).join(", ") || "—";
  $("d-asked").textContent = d.askedField || "—";
  $("d-type").textContent = d.responseType || "—";
  $("d-style").textContent = d.styleVersion || "—";
  $("d-score").textContent = String(d.daniScore);
  $("d-pricing").textContent = d.pricingRuntimeStatus || "NOT_RUN";
  const flags = $("d-flags");
  flags.innerHTML = "";
  if (!d.flags?.length) {
    flags.innerHTML = "<li>none</li>";
  } else {
    for (const f of d.flags) {
      const li = document.createElement("li");
      li.textContent = `[${f.severity}] ${f.code}: ${f.explanation}`;
      flags.appendChild(li);
    }
  }
  const visual = $("visual-status");
  const grid = $("visual-grid");
  grid.innerHTML = "";
  if (d.visualReferenceRequested) {
    visual.textContent = `Referencia visual solicitada: Sí · Nicho: ${d.visualNiche || "sin clasificar"} · Referencias autorizadas: ${d.visualAuthorizedCount ?? 0} · Proveedor: Catálogo local curado · Confianza lab: ${d.visualConfidence ?? "—"}`;
    const refs = d.visualReferences || [];
    if (refs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent =
        "Sin referencias autorizadas para este nicho. En una etapa futura este espacio podrá mostrar fotografías autorizadas.";
      grid.appendChild(empty);
    } else {
      for (const ref of refs.slice(0, 6)) {
        const card = document.createElement("article");
        card.className = "visual-card";
        card.innerHTML = `
          <a class="visual-thumb" href="${ref.assetUrl}" target="_blank" rel="noopener">
            <img alt="" src="${ref.assetUrl}" />
          </a>
          <h4></h4>
          <p class="visual-desc"></p>
          <p class="visual-purpose"></p>
          <p class="visual-rights"></p>
          <label class="visual-review-label">Revisión de referencia
            <select data-ref-id="${ref.id}" data-niche="${d.visualNiche || ""}" aria-label="Veredicto visual ${ref.id}">
              <option value="">—</option>
              <option value="USEFUL">ÚTIL</option>
              <option value="WRONG_NICHE">NO REPRESENTA EL NICHO</option>
              <option value="LOW_QUALITY">CALIDAD INSUFICIENTE</option>
              <option value="WOULD_NOT_USE">NO LA USARÍA</option>
              <option value="REVIEW_RIGHTS">REVISAR DERECHOS</option>
            </select>
          </label>
        `;
        card.querySelector("h4").textContent = ref.title;
        card.querySelector(".visual-desc").textContent = ref.description;
        card.querySelector(".visual-purpose").textContent =
          `Propósito: ${(ref.educationalPurpose || []).join(", ") || "—"}`;
        card.querySelector(".visual-rights").textContent =
          `Autor: ${ref.authorName || "—"} · ${ref.attributionRequired ? `Atribución: ${ref.attributionText || "requerida"}` : "Sin atribución obligatoria"} · Derechos: ${ref.authorizationBasis}`;
        card.querySelector("select").addEventListener("change", async (ev) => {
          const verdict = ev.target.value;
          if (!verdict || !state.sessionId) return;
          try {
            await api("/review-lab/api/visual-review", {
              sessionId: state.sessionId,
              referenceId: ref.id,
              niche: d.visualNiche || ref.niches?.[0] || "",
              verdict,
              note: undefined,
            });
          } catch (err) {
            showError(err.message);
          }
        });
        grid.appendChild(card);
      }
    }
  } else {
    visual.textContent = "Referencia visual solicitada: No";
  }
  $("review-panel").hidden = false;
  state.lastTurnNumber = turn.turnNumber;

  if (sessionSummary(turn)) {
    /* kept for future */
  }
}

function sessionSummary(sessionOrTurn) {
  const session = sessionOrTurn.summary ? sessionOrTurn : null;
  if (!session?.summary) return;
  const s = session.summary;
  $("summary").innerHTML = `
    <strong>Resumen</strong><br/>
    Turnos: ${s.totalTurns} · Score promedio: ${s.averageScore} · Mínimo: ${s.minimumScore}<br/>
    Aprobadas: ${s.approved} · Ajuste: ${s.needsAdjustment} · Incorrectas: ${s.incorrect}<br/>
    Intent final: ${s.finalIntent || "—"} · Quote: ${s.finalQuoteStatus || "—"} · Pricing: ${s.finalPricingRuntimeStatus}<br/>
    <em>La evaluación automática orienta la revisión. La aprobación final es de Dani.</em>
  `;
}

function applySession(session) {
  state.sessionId = session.id;
  $("engine").value = session.styleEngine;
  renderChat(session);
  const last = session.turns?.[session.turns.length - 1];
  if (last) renderDiag(last);
  if (session.summary) {
    const s = session.summary;
    $("summary").innerHTML = `
      <strong>Resumen de sesión</strong><br/>
      Turnos: ${s.totalTurns} · Score promedio: ${s.averageScore} · Mínimo: ${s.minimumScore}<br/>
      Aprobadas: ${s.approved} · Ajuste: ${s.needsAdjustment} · Incorrectas: ${s.incorrect}<br/>
      Intent final: ${s.finalIntent || "—"} · Quote: ${s.finalQuoteStatus || "—"} · Pricing: ${s.finalPricingRuntimeStatus}<br/>
      <em>La evaluación automática orienta la revisión. La aprobación final es de Dani.</em>
    `;
  }
}

async function ensureSession() {
  if (state.sessionId) return state.sessionId;
  const data = await api("/review-lab/api/session", {
    styleEngine: $("engine").value,
  });
  applySession(data.session);
  return state.sessionId;
}

async function loadScenarios() {
  const data = await apiGet("/review-lab/api/scenarios");
  const select = $("scenario");
  for (const s of data.scenarios) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.id} — ${s.description}`;
    select.appendChild(opt);
  }
}

$("btn-new").addEventListener("click", async () => {
  showError("");
  try {
    const data = await api("/review-lab/api/session", {
      styleEngine: $("engine").value,
    });
    $("compare-box").hidden = true;
    applySession(data.session);
    $("review-panel").hidden = true;
  } catch (e) {
    showError(e.message);
  }
});

$("engine").addEventListener("change", async () => {
  if (!state.sessionId) return;
  try {
    const data = await api("/review-lab/api/engine", {
      sessionId: state.sessionId,
      styleEngine: $("engine").value,
    });
    applySession(data.session);
  } catch (e) {
    showError(e.message);
  }
});

$("composer").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  showError("");
  try {
    await ensureSession();
    const message = $("message").value.trim();
    const data = await api("/review-lab/api/message", {
      sessionId: state.sessionId,
      message,
    });
    $("message").value = "";
    $("compare-box").hidden = true;
    applySession(data.session);
    renderDiag(data.turn);
  } catch (e) {
    showError(e.message);
  }
});

$("btn-compare").addEventListener("click", async () => {
  showError("");
  try {
    await ensureSession();
    const message = $("message").value.trim();
    if (!message) {
      showError("Escribí un mensaje para comparar sin alterar la conversación.");
      return;
    }
    const data = await api("/review-lab/api/compare", {
      sessionId: state.sessionId,
      message,
    });
    const box = $("compare-box");
    box.hidden = false;
    box.innerHTML = `
      <div>
        <strong>LEGACY</strong> · score ${data.legacy.score}<br/>
        <p></p>
        <small>Flags: ${(data.legacy.flags || []).join(", ") || "none"} · Campo: ${data.legacy.askedField || "—"}</small>
      </div>
      <div>
        <strong>DANI V1</strong> · score ${data.dani.score}<br/>
        <p></p>
        <small>Flags: ${(data.dani.flags || []).join(", ") || "none"} · Campo: ${data.dani.askedField || "—"}</small>
        <p><small>Eliminados: ${(data.flagsRemoved || []).join(", ") || "none"} · Introducidos: ${(data.flagsIntroduced || []).join(", ") || "none"}</small></p>
      </div>
    `;
    box.children[0].querySelector("p").textContent = data.legacy.text;
    box.children[1].querySelector("p").textContent = data.dani.text;
  } catch (e) {
    showError(e.message);
  }
});

$("btn-load-scenario").addEventListener("click", async () => {
  showError("");
  try {
    await ensureSession();
    const scenarioId = $("scenario").value;
    if (!scenarioId) {
      showError("Elegí un escenario o usá conversación libre.");
      return;
    }
    const data = await api("/review-lab/api/scenario/load", {
      sessionId: state.sessionId,
      scenarioId,
    });
    applySession(data.session);
  } catch (e) {
    showError(e.message);
  }
});

$("btn-step").addEventListener("click", async () => {
  showError("");
  try {
    await ensureSession();
    const data = await api("/review-lab/api/scenario/step", {
      sessionId: state.sessionId,
    });
    applySession(data.session);
    if (data.turn) renderDiag(data.turn);
    if (data.done) showError("");
  } catch (e) {
    showError(e.message);
  }
});

$("btn-run-all").addEventListener("click", async () => {
  showError("");
  try {
    await ensureSession();
    const scenarioId = $("scenario").value;
    if (scenarioId) {
      await api("/review-lab/api/scenario/load", {
        sessionId: state.sessionId,
        scenarioId,
      });
    }
    const data = await api("/review-lab/api/scenario/run", {
      sessionId: state.sessionId,
    });
    applySession(data.session);
    const last = data.session.turns?.[data.session.turns.length - 1];
    if (last) renderDiag(last);
    $("summary").innerHTML += `<br/><strong>Escenario:</strong> ${data.passed ? "PASS" : "FAIL"} · score ${data.score}`;
  } catch (e) {
    showError(e.message);
  }
});

$("btn-export").addEventListener("click", async () => {
  showError("");
  try {
    await ensureSession();
    const data = await api("/review-lab/api/export", {
      sessionId: state.sessionId,
    });
    $("summary").innerHTML += `<br/>Exportación guardada: <code>${data.savedTo}</code>`;
  } catch (e) {
    showError(e.message);
  }
});

for (const btn of document.querySelectorAll("[data-verdict]")) {
  btn.addEventListener("click", async () => {
    if (!state.sessionId || !state.lastTurnNumber) return;
    showError("");
    try {
      const data = await api("/review-lab/api/review", {
        sessionId: state.sessionId,
        turnNumber: state.lastTurnNumber,
        verdict: btn.getAttribute("data-verdict"),
        note: $("note").value,
      });
      applySession(data.session);
      const turn = data.session.turns.find((t) => t.turnNumber === state.lastTurnNumber);
      if (turn) renderDiag(turn);
    } catch (e) {
      showError(e.message);
    }
  });
}

async function refreshCalibration() {
  const params = new URLSearchParams();
  const verdict = $("cal-filter-verdict").value;
  const code = $("cal-filter-code").value.trim();
  const copyId = $("cal-filter-copy").value.trim();
  if (verdict) params.set("verdict", verdict);
  if (code) params.set("code", code);
  if (copyId) params.set("copyId", copyId);
  const data = await apiGet(`/review-lab/api/calibration?${params}`);
  const q = data.quality || {};
  $("cal-quality").innerHTML = `
    <strong>Calidad conversacional</strong><br/>
    Revisadas: ${q.totalReviewed ?? 0} · Aprobadas: ${q.percentApproved ?? 0}% · Ajuste: ${q.percentNeedsAdjustment ?? 0}% · Incorrectas: ${q.percentIncorrect ?? 0}%<br/>
    Score automático promedio: ${q.averageAutomaticScore ?? 0} ·
    Score alto / Dani rechaza: ${q.highScoreHumanRejected ?? 0} ·
    Score bajo / Dani aprueba: ${q.lowScoreHumanApproved ?? 0}<br/>
    Casos dorados: ${q.goldenCases ?? 0} · Propuestas: ${q.pendingCopyProposals ?? 0}<br/>
    <em>${q.disclaimer || "El score automático y la aprobación humana miden aspectos distintos."}</em>
  `;
  const inbox = $("cal-inbox");
  inbox.innerHTML = "";
  for (const item of data.items || []) {
    const disc =
      item.calibrationCode === "CALIBRATION_HIGH_SCORE_HUMAN_REJECTED" ||
      item.calibrationCode === "CALIBRATION_LOW_SCORE_HUMAN_APPROVED";
    const card = document.createElement("article");
    card.className = "cal-card" + (disc ? " discrepancy" : "");
    card.innerHTML = `
      <h4>${item.verdict} · ${item.calibrationCode} · score ${item.styleScore ?? "—"}</h4>
      <p><strong>Usuario:</strong> <span class="u"></span></p>
      <p><strong>Asistente:</strong> <span class="a"></span></p>
      <p class="muted">Copy: ${(item.appliedCopyIds || []).join(", ") || "—"} · Campo: ${item.askedField || "—"} · Intent: ${item.detectedIntent || "—"}</p>
      <p class="muted">Nota: <span class="n"></span></p>
      <div class="toolbar">
        <label>Categoría
          <select data-item-id="${item.id}" class="cal-code">
            <option value="">—</option>
            <option>CALIBRATION_TOO_FORMAL</option>
            <option>CALIBRATION_UNNATURAL_CONFIRMATION</option>
            <option>CALIBRATION_BAD_COPY_VARIANT</option>
            <option>CALIBRATION_WRONG_QUESTION</option>
            <option>CALIBRATION_OTHER</option>
            <option>CALIBRATION_HIGH_SCORE_HUMAN_REJECTED</option>
            <option>CALIBRATION_LOW_SCORE_HUMAN_APPROVED</option>
          </select>
        </label>
        <button type="button" data-golden="${item.id}">Proponer como caso dorado</button>
        <button type="button" data-propose-copy="${item.id}" data-copy="${(item.appliedCopyIds || [])[0] || ""}">Proponer cambio de copy</button>
      </div>
    `;
    card.querySelector(".u").textContent = item.userMessage;
    card.querySelector(".a").textContent = item.assistantMessage;
    card.querySelector(".n").textContent = item.note || "—";
    const sel = card.querySelector(".cal-code");
    sel.value = item.calibrationCode;
    sel.addEventListener("change", async () => {
      if (!sel.value) return;
      await api("/review-lab/api/calibration/code", {
        itemId: item.id,
        code: sel.value,
      });
      await refreshCalibration();
    });
    card.querySelector("[data-golden]").addEventListener("click", async () => {
      const prop = await api("/review-lab/api/calibration/propose-golden", {
        itemId: item.id,
      });
      if (confirm("Confirmar caso dorado? (segunda confirmación)")) {
        await api("/review-lab/api/calibration/confirm-golden", {
          proposalId: prop.proposal.id,
        });
        alert("Caso dorado confirmado en .local (no versionado aún).");
        await refreshCalibration();
      }
    });
    card.querySelector("[data-propose-copy]").addEventListener("click", async () => {
      const copyId = card.querySelector("[data-propose-copy]").getAttribute("data-copy");
      if (!copyId) {
        showError("Este turno no tiene copy ID. Revisá appliedCopyIds.");
        return;
      }
      const proposedText = prompt("Texto propuesto (manual, sin IA):");
      if (!proposedText) return;
      const reason = prompt("Motivo:") || "Ajuste humano";
      const created = await api("/review-lab/api/calibration/copy-proposal", {
        copyId,
        action: "EDIT",
        proposedText,
        reason,
        evidenceItemIds: [item.id],
        approve: true,
      });
      const sim = await api("/review-lab/api/calibration/simulate", {
        proposalId: created.proposal.id,
      });
      const box = $("cal-sim");
      box.hidden = false;
      box.innerHTML = `
        <div><strong>Antes</strong><br/>Score avg: ${sim.simulation.averageScoreBefore}<br/>Pass: ${sim.simulation.passedBefore}/${sim.simulation.totalScenarios}</div>
        <div><strong>Después</strong><br/>Score avg: ${sim.simulation.averageScoreAfter}<br/>Pass: ${sim.simulation.passedAfter}/${sim.simulation.totalScenarios}<br/>Estado: ${sim.simulation.status}<br/>Catálogo mutado: ${sim.simulation.catalogMutated}</div>
      `;
    });
    inbox.appendChild(card);
  }
  const groups = $("cal-groups");
  groups.innerHTML = "<strong>Agrupación por copy ID</strong><ul></ul>";
  const ul = groups.querySelector("ul");
  for (const g of (data.groups?.byCopyId || []).slice(0, 12)) {
    const li = document.createElement("li");
    li.textContent = `Grupo: ${g.key} · Revisiones: ${g.total} · Aprobadas: ${g.approved} · Ajuste: ${g.needsAdjustment} · Incorrectas: ${g.incorrect} · Predomina: ${g.predominantCode}`;
    ul.appendChild(li);
  }
}

$("btn-cal-ingest").addEventListener("click", async () => {
  showError("");
  try {
    await ensureSession();
    const data = await api("/review-lab/api/calibration/ingest", {
      sessionId: state.sessionId,
      redact: $("cal-redact").checked,
    });
    $("summary").innerHTML += `<br/>Calibración: +${data.itemsAdded} ítems`;
    await refreshCalibration();
  } catch (e) {
    showError(e.message);
  }
});

$("btn-cal-refresh").addEventListener("click", () =>
  refreshCalibration().catch((e) => showError(e.message)),
);
$("btn-cal-candidates").addEventListener("click", async () => {
  try {
    const data = await api("/review-lab/api/calibration/generate-candidates", {});
    alert(`Candidatos: ${(data.candidates || []).length}`);
  } catch (e) {
    showError(e.message);
  }
});
$("btn-cal-export").addEventListener("click", async () => {
  try {
    const data = await api("/review-lab/api/calibration/export", {});
    alert(`Export: ${data.fileName}`);
  } catch (e) {
    showError(e.message);
  }
});
for (const id of ["cal-filter-verdict", "cal-filter-code", "cal-filter-copy"]) {
  $(id).addEventListener("change", () => refreshCalibration().catch(() => {}));
}

function fillList(id, items, mapFn) {
  const ul = $(id);
  ul.innerHTML = "";
  if (!items?.length) {
    ul.innerHTML = "<li>—</li>";
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = mapFn(item);
    ul.appendChild(li);
  }
}

function renderPricingReview(data) {
  const r = data.review;
  if (!r) return;
  $("pricing-status").textContent = `Estado: ${r.status} · fuente ${data.configSource || "—"}`;
  const show = $("pricing-show-amounts").checked && r.result && !r.result.amountsHidden;
  $("p-min").textContent = show
    ? `${r.result.currency} ${r.result.minimumSustainable}`
    : "oculto";
  $("p-rec").textContent = show
    ? `${r.result.currency} ${r.result.recommendedPrice}`
    : "oculto";
  $("p-factor").textContent = r.result?.commercialFactor ?? "—";
  $("p-currency").textContent = r.result?.currency ?? "—";
  $("p-engine").textContent = r.calculationVersion || "—";
  $("p-expl-ver").textContent = r.explanationVersion || "dani-pricing-explanation-v1";
  fillList("p-fields", r.inputSummary?.fields, (f) => `[${f.origin}] ${f.label}: ${f.valueDescription}`);
  fillList("p-missing", r.missingInformation, (m) => `${m.label} · ${m.expectedOrigin} · ${m.action}`);
  fillList("p-assumptions", r.assumptions, (a) => `${a.label}: ${a.valueDescription}`);
  fillList("p-components", r.components, (c) => `${c.name} (${c.status}) — ${c.explanation}`);
  fillList("p-warnings", r.warnings, (w) => `[${w.severity}] ${w.message}`);
  $("p-dani").textContent = r.explanationDani || "—";
  $("p-structured").textContent = r.explanationStructured || "—";
}

async function refreshPricingReview() {
  await ensureSession();
  const show = $("pricing-show-amounts").checked;
  const allowSynthetic = $("pricing-allow-synthetic")?.checked === true;
  const data = await api("/review-lab/api/pricing-review/calculate", {
    sessionId: state.sessionId,
    showInternalAmounts: show,
    allowSynthetic,
  });
  renderPricingReview(data);
  const banner = $("pricing-synthetic-banner");
  if (banner) {
    if (data.syntheticBanner || data.configSource === "SYNTHETIC") {
      banner.hidden = false;
      banner.textContent =
        data.syntheticBanner ||
        "PERFIL SINTÉTICO DE PRUEBA\n\nEstos importes no corresponden al perfil real de Dani y no deben utilizarse para cotizar.";
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
  }
}

$("btn-pricing-calc").addEventListener("click", () =>
  refreshPricingReview().catch((e) => showError(e.message)),
);
$("pricing-show-amounts").addEventListener("change", () =>
  refreshPricingReview().catch((e) => showError(e.message)),
);
const pricingSyntheticToggle = $("pricing-allow-synthetic");
if (pricingSyntheticToggle) {
  pricingSyntheticToggle.addEventListener("change", () =>
    refreshPricingReview().catch((e) => showError(e.message)),
  );
}
$("btn-pricing-export").addEventListener("click", async () => {
  try {
    await ensureSession();
    const data = await api("/review-lab/api/pricing-review/export", {
      sessionId: state.sessionId,
    });
    alert(`Export financiero: ${data.relativeHint || data.fileName}`);
  } catch (e) {
    showError(e.message);
  }
});
for (const btn of document.querySelectorAll("[data-pricing-verdict]")) {
  btn.addEventListener("click", async () => {
    try {
      await ensureSession();
      await api("/review-lab/api/pricing-review/review", {
        sessionId: state.sessionId,
        verdict: btn.getAttribute("data-pricing-verdict"),
        code: $("pricing-code").value || undefined,
        note: $("pricing-note").value || undefined,
      });
      $("summary").innerHTML += "<br/>Revisión de explicación de presupuesto registrada.";
      await refreshCalibration();
    } catch (e) {
      showError(e.message);
    }
  });
}

await loadScenarios();
await $("btn-new").click();
refreshCalibration().catch(() => {});

