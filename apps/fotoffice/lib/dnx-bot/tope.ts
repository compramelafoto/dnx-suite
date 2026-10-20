import "server-only";
import { sendTelegramMessage } from "@repo/dnx-bot";
import { leerConfigBot, plataformaDe, PLATAFORMA_GLOBAL } from "./config";
import { mesArgentino, mesSiguiente } from "./dia-argentino";
import { gastoDelMes, liberarMarca, reservarMarca } from "./store";

function usd(microUsd: number, decimales: number): string {
  return (microUsd / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: 2 });
}

type Aviso = { plataforma: string; signature: string; title: string; text: string; data: unknown };

function avisosDe(p: {
  gasto: number;
  tope: number;
  plataforma: string;
  prefijoFirma: string;
  quien: string;
  mes: string;
}): Aviso[] {
  if (p.tope <= 0) return [];
  const dia1 = `1/${mesSiguiente(p.mes).slice(5, 7).replace(/^0/, "")}`;
  const umbrales = [
    { pct: 80, text: `⚠️ FOTOFFICE · DNX Bot llegó al 80 % del tope mensual${p.quien}: USD ${usd(p.gasto, 2)} de USD ${usd(p.tope, 0)}.` },
    { pct: 100, text: `🛑 FOTOFFICE · DNX Bot llegó al tope mensual${p.quien} (USD ${usd(p.tope, 0)}): no responde hasta el ${dia1}. El resto de FOTOFFICE sigue igual.` },
  ];
  return umbrales
    .filter((u) => p.gasto * 100 >= p.tope * u.pct)
    .map((u) => ({
      plataforma: p.plataforma,
      signature: `${p.prefijoFirma}-${u.pct}-${p.mes}`,
      title: `Aviso de tope mensual ${u.pct} %${p.quien} (${p.mes})`,
      text: u.text,
      data: { gastoMicroUsd: p.gasto, topeMicroUsd: p.tope },
    }));
}

/**
 * Avisa por Telegram cuando el gasto del mes cruza el 80 % y el 100 % del tope de todo FOTOFFICE
 * (marca en "FOTOFFICE") y del tope del workspace (marca en "FOTOFFICE:<id>"). Una vez por umbral
 * y mes entre todas las instancias; si Telegram falla, la marca se libera y lo reintenta un turno
 * posterior (mismo patrón que `apps/compramelafoto/lib/bot/tope.ts`). Sólo montos en USD: nunca
 * datos de clientes ni del perfil. Nunca lanza.
 */
export async function avisarTopes(p: { workspaceId: string; ahora?: Date }): Promise<void> {
  try {
    const cfg = leerConfigBot();
    // Sin Telegram no se reserva nada: cuando se configure, el aviso pendiente sale en el próximo turno.
    if (!cfg.telegram) return;
    const ahora = p.ahora ?? new Date();
    const mes = mesArgentino(ahora);
    const plataformaWs = plataformaDe(p.workspaceId);
    const [global, workspace] = await Promise.all([
      gastoDelMes({ ahora }),
      gastoDelMes({ plataforma: plataformaWs, ahora }),
    ]);
    const avisos = [
      ...avisosDe({ gasto: global, tope: cfg.limits.monthlyCapMicroUsd, plataforma: PLATAFORMA_GLOBAL, prefijoFirma: "cap", quien: "", mes }),
      ...avisosDe({
        gasto: workspace,
        tope: cfg.limits.workspaceMonthlyCapMicroUsd,
        plataforma: plataformaWs,
        prefijoFirma: "cap-ws",
        quien: ` del workspace ${p.workspaceId}`,
        mes,
      }),
    ];
    for (const a of avisos) {
      const mia = await reservarMarca({ plataforma: a.plataforma, signature: a.signature, title: a.title, data: a.data });
      if (!mia) continue;
      const r = await sendTelegramMessage(cfg.telegram, a.text).catch((e: unknown) => ({ ok: false, error: String(e) }));
      if (!r.ok) {
        console.error("[dnx-bot] aviso de tope sin enviar", a.signature, r.error);
        await liberarMarca({ plataforma: a.plataforma, signature: a.signature });
      }
    }
  } catch (e) {
    console.error("[dnx-bot] aviso de tope", e);
  }
}
