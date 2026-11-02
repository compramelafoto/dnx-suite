import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import {
  cerrarSesion,
  consultaDeCelular,
  consultaDePantalla,
  cookieCelular,
  crearSesion,
  ordenDeCelular,
  renovarCodigo,
  vincularCelular,
} from "./almacen";
import { sanearComando, sanearEstado } from "./protocolo";

/**
 * Lo que comparten las rutas `/api/control-remoto` de las dos apps. Quién puede abrir una sesión lo
 * decide cada app en su `route.ts`; de ahí en adelante mandan los secretos de la sesión.
 * Copia idéntica en FOTOFFICE (`apps/fotoffice/lib/control-remoto/rutas.ts`).
 */

const sinCache = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: sinCache });

/** El celular abre `/control-remoto/<id>`; el código va después de `#` y nunca llega a los registros del servidor. */
async function enlaceYQr(req: NextRequest, id: string, codigo: string) {
  const enlace = `${req.nextUrl.origin}/control-remoto/${id}#${codigo}`;
  const qr = await QRCode.toDataURL(enlace, { margin: 1, width: 480 });
  return { enlace, qr };
}

export async function responderSesionNueva(req: NextRequest, ambito: string, ref: string) {
  const s = await crearSesion(ambito, ref);
  return json({ id: s.id, clave: s.clave, vence: s.vence, ...(await enlaceYQr(req, s.id, s.codigo)) });
}

const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

export async function manejarSesion(req: NextRequest, id: string) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = texto(body?.accion, 20);
  const cookie = cookieCelular(id);
  const claveCelular = req.cookies.get(cookie.nombre)?.value ?? "";
  const vencida = () => json({ error: "Este control remoto ya no está activo." }, 410);

  switch (accion) {
    case "pantalla": {
      const desde = Number(body?.desde);
      const r = await consultaDePantalla(
        id,
        texto(body?.clave),
        Number.isInteger(desde) ? desde : -1,
        body?.estado ? sanearEstado(body.estado) : null,
      );
      return r ? json(r) : vencida();
    }
    case "renovar": {
      const codigo = await renovarCodigo(id, texto(body?.clave));
      return codigo ? json(await enlaceYQr(req, id, codigo)) : vencida();
    }
    case "cerrar":
      await cerrarSesion(id, texto(body?.clave));
      return json({ ok: true });
    case "vincular": {
      const r = await vincularCelular(id, texto(body?.codigo));
      if (!r) {
        return json({ error: "Este código ya se usó o venció. Pedí un código nuevo en la pantalla." }, 410);
      }
      const res = json({ ok: true });
      res.cookies.set(cookie.nombre, r.clave, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: cookie.ruta,
        expires: new Date(r.vence),
      });
      return res;
    }
    case "leer": {
      const r = await consultaDeCelular(id, claveCelular);
      return r ? json(r) : vencida();
    }
    case "ordenar": {
      const comando = sanearComando(body?.comando);
      if (!comando) return json({ error: "Orden desconocida." }, 400);
      return (await ordenDeCelular(id, claveCelular, comando)) ? json({ ok: true }) : vencida();
    }
    default:
      return json({ error: "Acción desconocida." }, 400);
  }
}
