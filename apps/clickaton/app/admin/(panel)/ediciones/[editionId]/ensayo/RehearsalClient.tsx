"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  chequearEdicionAction,
  descartarCopiaDeEnsayoAction,
  ensayarCompletoAction,
  ensayarEnSecoAction,
  type RespuestaChequeo,
} from "@/lib/edition-rehearsal/actions";
import type { ModoDeEnsayo } from "@/lib/edition-rehearsal/application/dry-run-steps";
import {
  PALABRA_DE_CONFIRMACION,
  confirmacionValida,
} from "@/lib/edition-rehearsal/domain/confirmacion";
import { pantallaDelPaso } from "@/lib/edition-rehearsal/domain/pantallas";
import type { ResultadoEnsayoEnSeco } from "@/lib/edition-rehearsal/application/run-dry-rehearsal";
import type { ResultadoEnsayoCompleto } from "@/lib/edition-rehearsal/application/run-full-rehearsal";
import {
  agruparPorRubro,
  enlaceDeHallazgo,
  presentarEstadoDePaso,
  presentarRubro,
  presentarSeveridad,
  resumirHallazgos,
} from "@/lib/edition-rehearsal/ui/rehearsal-presentation";

type Props = {
  editionId: string;
  editionName: string;
  editionSlug: string;
  timezone: string;
};

function formatearMomento(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Pasa un instante a lo que espera un `<input type="datetime-local">`, en hora de la edición. */
function aCampoDeFecha(fecha: Date, timezone: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("year")}-${valor("month")}-${valor("day")}T${valor("hour")}:${valor("minute")}`;
}

/** Botón de borrado con confirmación, para no perder la copia de un clic al azar. */
function ConfirmSubmitButtonLike({
  onConfirm,
  cargando,
}: {
  onConfirm: () => void;
  cargando: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={cargando}
      onClick={() => {
        if (window.confirm("Se borra la copia de ensayo y todo lo que se creó adentro. ¿Seguro?")) {
          onConfirm();
        }
      }}
    >
      Borrar la copia de ensayo
    </Button>
  );
}

export function RehearsalClient({ editionId, editionName, editionSlug, timezone }: Props) {
  const [chequeo, setChequeo] = useState<RespuestaChequeo | null>(null);
  const [revisando, empezarRevision] = useTransition();

  const [modo, setModo] = useState<ModoDeEnsayo>("RECORRIDO");
  const [momento, setMomento] = useState<string>(() => aCampoDeFecha(new Date(), timezone));
  const [ensayo, setEnsayo] = useState<ResultadoEnsayoEnSeco | null>(null);
  const [ensayando, empezarEnsayo] = useTransition();

  function revisar() {
    empezarRevision(async () => {
      setChequeo(await chequearEdicionAction(editionId));
    });
  }

  function ensayar(modoElegido: ModoDeEnsayo, momentoElegido?: string) {
    const valor = momentoElegido ?? momento;
    setModo(modoElegido);
    empezarEnsayo(async () => {
      const iso = valor ? new Date(valor).toISOString() : null;
      setEnsayo(await ensayarEnSecoAction(editionId, iso, modoElegido));
    });
  }

  const [confirmacion, setConfirmacion] = useState("");
  const [completo, setCompleto] = useState<ResultadoEnsayoCompleto | null>(null);
  const [ensayandoCompleto, empezarEnsayoCompleto] = useTransition();
  const [dejarEnPie, setDejarEnPie] = useState(false);
  const [limpieza, setLimpieza] = useState<string | null>(null);
  const [borrando, empezarBorrado] = useTransition();

  function ensayarCompleto(enPie: boolean) {
    setDejarEnPie(enPie);
    setLimpieza(null);
    empezarEnsayoCompleto(async () => {
      setCompleto(await ensayarCompletoAction(editionId, confirmacion, enPie));
    });
  }

  function borrarLaCopia(copiaId: string) {
    empezarBorrado(async () => {
      const r = await descartarCopiaDeEnsayoAction(editionId, copiaId);
      if (r.ok) {
        const total = Object.values(r.borrado).reduce((a, b) => a + b, 0);
        setLimpieza(`Copia borrada: ${total} registros eliminados.`);
        setCompleto(null);
      } else {
        setLimpieza(r.mensaje);
      }
    });
  }

  const atajos = ensayo?.ok === true ? ensayo.atajos : [];

  const resumen =
    chequeo?.ok === true ? resumirHallazgos(chequeo.hallazgos) : null;
  const grupos = chequeo?.ok === true ? agruparPorRubro(chequeo.hallazgos) : [];

  return (
    <div className="min-w-0 space-y-6">
      <Card variant="outlined" className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-ck-text">Chequeo de la edición</h2>
            <p className="text-sm text-ck-text-muted">
              Revisa la configuración de {editionName} y avisa qué le falta para que un
              participante pueda hacer todo el recorrido. No modifica nada, así que lo podés
              apretar cuando quieras.
            </p>
          </div>
          <Button type="button" onClick={revisar} loading={revisando} variant="primary">
            {revisando ? "Revisando…" : "Revisar todo"}
          </Button>
        </div>

        {chequeo?.ok === false ? (
          <p className="text-sm text-[var(--ck-danger)]">{chequeo.mensaje}</p>
        ) : null}

        {chequeo?.ok === true && resumen ? (
          <div className="space-y-4">
            <div className="rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface-strong p-4">
              <p className="text-sm font-medium text-ck-text">{resumen.veredicto}</p>
              <p className="mt-1 text-xs text-ck-text-muted">
                {resumen.bloqueantes} bloqueantes · {resumen.atenciones} para revisar ·{" "}
                {resumen.bien} correctos · revisado el{" "}
                {formatearMomento(chequeo.revisadoEl, timezone)}
              </p>
            </div>

            {grupos.map((grupo) => (
              <section key={grupo.rubro} className="space-y-2">
                <h3 className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">
                  {presentarRubro(grupo.rubro)}
                </h3>
                <ul className="space-y-2">
                  {grupo.hallazgos.map((hallazgo) => {
                    const severidad = presentarSeveridad(hallazgo.severidad);
                    const enlace = enlaceDeHallazgo(hallazgo, editionId);
                    return (
                      <li
                        key={hallazgo.id}
                        className="rounded-[var(--ck-radius-sm)] border border-ck-border p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={severidad.variante}>{severidad.etiqueta}</Badge>
                          <span className="text-sm font-medium text-ck-text">
                            {hallazgo.titulo}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-ck-text-secondary">{hallazgo.detalle}</p>
                        {hallazgo.comoArreglar ? (
                          <p className="mt-1 text-sm text-ck-text-muted">
                            Qué hacer: {hallazgo.comoArreglar}
                          </p>
                        ) : null}
                        {enlace ? (
                          <Button href={enlace} variant="text" size="sm" className="mt-2">
                            Ir a arreglarlo
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {chequeo === null && !revisando ? (
          <p className="text-sm text-ck-text-muted">
            Todavía no revisaste nada. Apretá &laquo;Revisar todo&raquo; para empezar.
          </p>
        ) : null}
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ck-text">Ensayo del participante</h2>
          <p className="text-sm text-ck-text-muted">
            Recorre los diez pasos que hace una persona, desde que mira la página hasta que
            su foto queda revisada. Usa las mismas reglas que el sitio de verdad, pero no
            crea ninguna inscripción ni modifica nada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            loading={ensayando && modo === "RECORRIDO"}
            onClick={() => ensayar("RECORRIDO")}
          >
            Ensayar el recorrido completo
          </Button>
          <span className="text-xs text-ck-text-muted">
            Cada paso se evalúa en el momento en que de verdad ocurriría.
          </span>
        </div>

        <div className="space-y-3 rounded-[var(--ck-radius-sm)] border border-ck-border p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-ck-text">O pararse en un momento</h3>
            <p className="text-xs text-ck-text-muted">
              Elegí una fecha y hora y mirá qué le pasa a alguien que entra exactamente en
              ese instante. La hora es la de la edición ({timezone}) y sólo existe dentro de
              esta simulación: nadie más en el sitio ve nada distinto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={momento}
              onChange={(e) => setMomento(e.target.value)}
              aria-label="Fecha y hora a simular"
              className="rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface-strong px-3 py-2 text-sm text-ck-text"
            />
            <Button
              type="button"
              variant="secondary"
              loading={ensayando && modo === "INSTANTE"}
              onClick={() => ensayar("INSTANTE")}
            >
              Ver qué pasa a esa hora
            </Button>
          </div>

          {atajos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">
                Momentos de esta edición
              </p>
              <div className="flex flex-wrap gap-2">
                {atajos
                  .filter((a) => a.momentoIso !== null)
                  .map((a) => (
                    <Button
                      key={a.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      title={a.porQue}
                      onClick={() => {
                        const valor = aCampoDeFecha(new Date(a.momentoIso as string), timezone);
                        setMomento(valor);
                        ensayar("INSTANTE", valor);
                      }}
                    >
                      {a.etiqueta}
                    </Button>
                  ))}
              </div>
            </div>
          ) : null}
        </div>

        {ensayo?.ok === false ? (
          <p className="text-sm text-[var(--ck-danger)]">{ensayo.mensaje}</p>
        ) : null}

        {ensayo?.ok === true ? (
          <div className="space-y-4">
            <div className="rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface-strong p-4">
              <p className="text-sm font-medium text-ck-text">{ensayo.resultado.veredicto}</p>
              <p className="mt-1 text-xs text-ck-text-muted">
                {modo === "RECORRIDO"
                  ? "Recorrido completo: cada paso en su momento natural."
                  : `Parado en el ${formatearMomento(ensayo.resultado.momentoSimulado, timezone)} (hora de la edición).`}
              </p>
            </div>

            <ol className="space-y-2">
              {ensayo.resultado.pasos.map((p) => {
                const estado = presentarEstadoDePaso(p.estado);
                return (
                  <li
                    key={p.numero}
                    className="rounded-[var(--ck-radius-sm)] border border-ck-border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ck-label text-ck-text-muted">Paso {p.numero}</span>
                      <Badge variant={estado.variante}>{estado.etiqueta}</Badge>
                      <span className="text-sm font-medium text-ck-text">{p.nombre}</span>
                    </div>
                    <p className="mt-2 text-sm text-ck-text-secondary">
                      Lo que vería: {p.queVeria}
                    </p>
                    <p className="mt-1 text-sm text-ck-text-muted">{p.detalle}</p>
                    {p.comoArreglar ? (
                      <p className="mt-1 text-sm text-ck-text-muted">
                        Qué hacer: {p.comoArreglar}
                      </p>
                    ) : null}
                    {(() => {
                      const pantalla = pantallaDelPaso(p.numero, {
                        editionId,
                        editionSlug,
                      });
                      if (!pantalla) return null;
                      return (
                        <div className="mt-2 space-y-1">
                          <Button
                            href={pantalla.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outline"
                            size="sm"
                          >
                            {pantalla.etiqueta} ↗
                          </Button>
                          <p className="text-xs text-ck-text-muted">{pantalla.queProbar}</p>
                        </div>
                      );
                    })()}
                  </li>
                );
              })}
            </ol>

            <p className="text-xs text-ck-text-muted">
              Las pantallas del participante (su credencial, la pantalla en vivo, la subida
              de fotos) necesitan una inscripción. Corré el ensayo completo de abajo
              dejando la copia en pie y vas a poder abrirlas y tocarlas.
            </p>
          </div>
        ) : null}
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ck-text">Ensayo completo</h2>
          <p className="text-sm text-ck-text-muted">
            Igual que el ensayo de arriba, pero escribiendo de verdad: crea una copia
            descartable de {editionName}, inscribe un participante ficticio, lo confirma, le
            emite la credencial y le registra el ingreso.
          </p>
          <p className="text-sm text-ck-text-muted">
            La edición real no se toca en ningún momento. En la copia las entradas valen cero,
            así que no pasa por Mercado Pago ni mueve un peso, y la foto no se sube al
            depósito de archivos: eso se verifica en el ensayo en seco.
          </p>
          <p className="text-sm text-ck-text-muted">
            Si dejás la copia en pie, después podés abrir las pantallas del participante
            ficticio y tocar los botones vos mismo. Queda un botón para borrarla cuando
            termines de mirar.
          </p>
        </div>

        <div className="space-y-2 rounded-[var(--ck-radius-sm)] border border-[var(--ck-warning)]/50 bg-[var(--ck-warning-soft)] p-4">
          <label
            htmlFor="confirmacion-ensayo"
            className="block text-sm font-medium text-ck-text"
          >
            Para confirmar, escribí {PALABRA_DE_CONFIRMACION} en el casillero
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="confirmacion-ensayo"
              type="text"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder={PALABRA_DE_CONFIRMACION}
              autoComplete="off"
              className="w-40 rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface-strong px-3 py-2 text-sm text-ck-text"
            />
            <Button
              type="button"
              variant="secondary"
              loading={ensayandoCompleto && !dejarEnPie}
              disabled={!confirmacionValida(confirmacion)}
              onClick={() => ensayarCompleto(false)}
            >
              Correr y borrar la copia
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={ensayandoCompleto && dejarEnPie}
              disabled={!confirmacionValida(confirmacion)}
              onClick={() => ensayarCompleto(true)}
            >
              Correr y dejarla para recorrer
            </Button>
          </div>
        </div>

        {completo?.ok === false ? (
          <p className="text-sm text-[var(--ck-danger)]">{completo.mensaje}</p>
        ) : null}

        {completo?.ok === true ? (
          <div className="space-y-4">
            <div className="rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface-strong p-4">
              <p className="text-sm font-medium text-ck-text">{completo.resultado.veredicto}</p>
              <p className="mt-1 text-xs text-ck-text-muted">
                Copia usada: {completo.copiaNombre}
              </p>
            </div>

            <ol className="space-y-2">
              {completo.resultado.pasos.map((p) => {
                const estado = presentarEstadoDePaso(p.estado);
                return (
                  <li
                    key={p.numero}
                    className="rounded-[var(--ck-radius-sm)] border border-ck-border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ck-label text-ck-text-muted">Paso {p.numero}</span>
                      <Badge variant={estado.variante}>{estado.etiqueta}</Badge>
                      <span className="text-sm font-medium text-ck-text">{p.nombre}</span>
                    </div>
                    <p className="mt-2 text-sm text-ck-text-secondary">
                      Lo que vería: {p.queVeria}
                    </p>
                    <p className="mt-1 text-sm text-ck-text-muted">{p.detalle}</p>
                    {p.comoArreglar ? (
                      <p className="mt-1 text-sm text-ck-text-muted">
                        Qué hacer: {p.comoArreglar}
                      </p>
                    ) : null}
                    {(() => {
                      const pantalla = pantallaDelPaso(p.numero, {
                        editionId: completo.copiaId,
                        editionSlug: completo.copiaSlug,
                        registrationId: completo.copiaEnPie ? completo.registrationId : null,
                      });
                      if (!pantalla) return null;
                      return (
                        <div className="mt-2 space-y-1">
                          <Button
                            href={pantalla.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outline"
                            size="sm"
                          >
                            {pantalla.etiqueta} ↗
                          </Button>
                          <p className="text-xs text-ck-text-muted">{pantalla.queProbar}</p>
                        </div>
                      );
                    })()}
                  </li>
                );
              })}
            </ol>

            {completo.copiaEnPie ? (
              <div className="space-y-3 rounded-[var(--ck-radius-sm)] border border-[var(--ck-warning)]/50 bg-[var(--ck-warning-soft)] p-4">
                <p className="text-sm font-medium text-ck-text">
                  La copia quedó en pie para que la recorras.
                </p>
                <p className="text-sm text-ck-text-secondary">
                  Abrí las pantallas de arriba en otra pestaña y tocá lo que quieras: es una
                  edición de prueba, nada de lo que hagas ahí toca la edición real. Cuando
                  termines, borrala.
                </p>
                <ConfirmSubmitButtonLike
                  onConfirm={() => borrarLaCopia(completo.copiaId)}
                  cargando={borrando}
                />
              </div>
            ) : null}

            {limpieza ? (
              <p className="text-sm text-ck-text-secondary">{limpieza}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--ck-radius-sm)] border border-ck-border p-3">
                <h3 className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">
                  Lo que se creó
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-ck-text-secondary">
                  {Object.entries(completo.creado).map(([que, cuantos]) => (
                    <li key={que}>
                      {cuantos} {que}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[var(--ck-radius-sm)] border border-ck-border p-3">
                <h3 className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">
                  Lo que se borró
                </h3>
                {completo.borrado ? (
                  <ul className="mt-2 space-y-1 text-sm text-ck-text-secondary">
                    {Object.entries(completo.borrado).map(([que, cuantos]) => (
                      <li key={que}>
                        {cuantos} {que}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--ck-danger)]">
                    {completo.avisoDeLimpieza}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
