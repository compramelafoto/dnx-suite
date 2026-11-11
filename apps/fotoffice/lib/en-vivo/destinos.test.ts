import { describe, expect, it } from "vitest";
import {
  armarOutputs,
  destinoUsado,
  enmascararClave,
  leerDestinosUsados,
  terminacion,
  validarServidor,
  YOUTUBE_RTMP_URL,
  type PedidoDestinos,
} from "./destinos";

const CLAVE_YT = "abcd-efgh-ijkl-mnop-qrst";
const CLAVE_IG = "IG123456789?s_bl=1&s_sw=0&a=AbCdEf9876";
const CLAVE_TT = "stream-tiktok-0011223344";
const SERVIDOR_IG = "rtmps://edgetee-upload-gru2-1.xx.fbcdn.net:443/rtmp/";
const SERVIDOR_TT = "rtmp://push-rtmp-l11-va01.tiktokcdn.com/game/";

function pedido(over: Partial<PedidoDestinos> = {}): PedidoDestinos {
  return {
    youtube: { elegido: false, claveGuardada: null },
    instagram: { elegido: false, servidor: "", clave: "" },
    tiktok: { elegido: false, servidor: "", clave: "", claveGuardada: null, servidorGuardado: null },
    ...over,
  };
}

describe("armado de outputs", () => {
  it("sin redes elegidas no arma nada (vivo sólo grabado)", () => {
    expect(armarOutputs(pedido())).toEqual({ ok: true, outputs: [] });
  });

  it("YouTube usa el servidor fijo y la clave guardada", () => {
    const r = armarOutputs(pedido({ youtube: { elegido: true, claveGuardada: CLAVE_YT } }));
    expect(r).toEqual({ ok: true, outputs: [{ destino: "YOUTUBE", url: YOUTUBE_RTMP_URL, streamKey: CLAVE_YT }] });
  });

  it("YouTube sin clave guardada avisa que hay que guardarla", () => {
    const r = armarOutputs(pedido({ youtube: { elegido: true, claveGuardada: null } }));
    expect(r.ok).toBe(false);
  });

  it("las tres redes juntas, en orden", () => {
    const r = armarOutputs(
      pedido({
        youtube: { elegido: true, claveGuardada: CLAVE_YT },
        instagram: { elegido: true, servidor: SERVIDOR_IG, clave: CLAVE_IG },
        tiktok: { elegido: true, servidor: SERVIDOR_TT, clave: CLAVE_TT, claveGuardada: null, servidorGuardado: null },
      }),
    );
    expect(r.ok && r.outputs.map((o) => o.destino)).toEqual(["YOUTUBE", "INSTAGRAM", "TIKTOK"]);
  });

  it("TikTok sin clave nueva usa la recordada y su servidor", () => {
    const r = armarOutputs(
      pedido({ tiktok: { elegido: true, servidor: "", clave: "", claveGuardada: CLAVE_TT, servidorGuardado: SERVIDOR_TT } }),
    );
    expect(r).toEqual({ ok: true, outputs: [{ destino: "TIKTOK", url: SERVIDOR_TT, streamKey: CLAVE_TT }] });
  });

  it("si un destino está mal no se arma ninguno", () => {
    const r = armarOutputs(
      pedido({
        youtube: { elegido: true, claveGuardada: CLAVE_YT },
        instagram: { elegido: true, servidor: "https://instagram.com", clave: CLAVE_IG },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^Instagram:/);
  });

  it("valida el servidor: sólo rtmp:// o rtmps://", () => {
    expect(validarServidor(SERVIDOR_IG)).toBeNull();
    expect(validarServidor(SERVIDOR_TT)).toBeNull();
    expect(validarServidor("http://x.com/live")).not.toBeNull();
    expect(validarServidor("no es una url")).not.toBeNull();
    expect(validarServidor("")).not.toBeNull();
  });

  it("una clave con espacios o corta se rechaza", () => {
    const corto = armarOutputs(pedido({ instagram: { elegido: true, servidor: SERVIDOR_IG, clave: "abc" } }));
    const espacios = armarOutputs(pedido({ instagram: { elegido: true, servidor: SERVIDOR_IG, clave: "abc def ghi jkl" } }));
    expect(corto.ok).toBe(false);
    expect(espacios.ok).toBe(false);
  });
});

describe("nunca se expone una clave completa", () => {
  it("la máscara sólo deja los últimos cuatro", () => {
    expect(enmascararClave(CLAVE_YT)).toBe("••••••••qrst");
    expect(enmascararClave(CLAVE_YT)).not.toContain("abcd");
    expect(terminacion(CLAVE_IG)).toBe("9876");
  });

  it("una clave corta no muestra nada (cuatro caracteres serían media clave)", () => {
    expect(enmascararClave("12345678")).toBe("••••••••");
    expect(terminacion("12345678")).toBe("");
  });

  it("lo que se guarda del vivo no lleva la clave ni el servidor con la clave", () => {
    const r = armarOutputs(
      pedido({
        youtube: { elegido: true, claveGuardada: CLAVE_YT },
        instagram: { elegido: true, servidor: SERVIDOR_IG, clave: CLAVE_IG },
        tiktok: { elegido: true, servidor: SERVIDOR_TT, clave: CLAVE_TT, claveGuardada: null, servidorGuardado: null },
      }),
    );
    if (!r.ok) throw new Error("debería armar");
    const guardado = JSON.stringify(r.outputs.map((o, i) => destinoUsado(o, `out-${i}`)));
    for (const clave of [CLAVE_YT, CLAVE_IG, CLAVE_TT]) expect(guardado).not.toContain(clave);
    expect(guardado).not.toContain("streamKey");
  });

  it("al leer lo guardado, un campo inesperado con una clave no pasa", () => {
    const leido = leerDestinosUsados([
      { destino: "INSTAGRAM", outputUid: "o1", terminacion: "9876", estado: "ACTIVO", streamKey: CLAVE_IG, url: SERVIDOR_IG },
      { destino: "FACEBOOK", outputUid: "o2", terminacion: "1111", estado: "ACTIVO" },
      "basura",
    ]);
    expect(leido).toEqual([{ destino: "INSTAGRAM", outputUid: "o1", terminacion: "9876", estado: "ACTIVO" }]);
    expect(JSON.stringify(leido)).not.toContain(CLAVE_IG);
  });

  it("una terminación guardada demasiado larga se recorta a cuatro", () => {
    expect(leerDestinosUsados([{ destino: "YOUTUBE", outputUid: null, terminacion: CLAVE_YT, estado: "ERROR" }])[0]?.terminacion).toBe("qrst");
  });

  it("un destino que no se pudo crear queda en ERROR con el motivo recortado", () => {
    const d = destinoUsado({ destino: "TIKTOK", url: SERVIDOR_TT, streamKey: CLAVE_TT }, null, "x".repeat(1000));
    expect(d.estado).toBe("ERROR");
    expect(d.error?.length).toBe(300);
  });
});
