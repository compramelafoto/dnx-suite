"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  interpretExifClock,
  normalizeExifDateToUtcNumbers,
  parseExifOffset,
} from "@/lib/photo-upload/exif-clock";
import { submitReadinessCheckAction } from "@/lib/readiness/actions/submit-readiness-check";
import { clockOffMessage, readinessCopy } from "@/lib/readiness/content/readiness-copy";
import type { ReadinessResult } from "@/lib/readiness/domain/readiness";

import { CameraGpsInstructions } from "./CameraGpsInstructions";

type Estado = "idle" | "measuring" | "result" | "error";

type Verdict = {
  result: ReadinessResult;
  clockDeltaMinutes: number | null;
};

type Props = {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  /** Zona horaria de la edición: la misma que usa el servidor para reinterpretar el EXIF. */
  editionTimeZone: string;
  /** El resultado de la última prueba de esta inscripción, si ya hizo alguna. */
  initialVerdict?: Verdict | null;
};

function parseFecha(valor: unknown): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(d.getTime()) ? null : d;
}

function numeroFinitoPositivo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? valor : null;
}

/**
 * Cuando el EXIF no trae ancho/alto (frecuente: muchos teléfonos no graban
 * `PixelXDimension`/`PixelYDimension`), se mide el propio archivo. Nunca sale
 * del navegador: `createImageBitmap` decodifica localmente.
 */
async function medirConImageBitmap(
  file: File,
): Promise<{ width: number | null; height: number | null }> {
  if (typeof createImageBitmap !== "function") return { width: null, height: null };
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return dims;
  } catch {
    return { width: null, height: null };
  }
}

export function ReadinessCheckCard({
  registrationId,
  editionSlug,
  accessToken,
  editionTimeZone,
  initialVerdict = null,
}: Props) {
  const [estado, setEstado] = useState<Estado>(initialVerdict ? "result" : "idle");
  const [verdict, setVerdict] = useState<Verdict | null>(initialVerdict);
  const [wasLastCheck, setWasLastCheck] = useState(Boolean(initialVerdict));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();

  async function handleFile(file: File) {
    setEstado("measuring");
    setErrorMessage(null);
    setWasLastCheck(false);

    // Los dos pasos van en try/catch separados a propósito. Leer la foto y
    // hablar con el servidor fallan por razones distintas, y esta pantalla no
    // produce otra cosa que un diagnóstico: si un corte de red se anuncia
    // como "no pudimos leer esa foto", el participante sale a cambiar la
    // cámara de su teléfono por un problema que no tiene.
    let fd: FormData;
    try {
      // Diferido a propósito: `exifr` no viaja en el paquete inicial de la
      // página, sólo se carga cuando el participante realmente eligió una foto.
      const exifr = (await import("exifr")).default;
      const tags = (await exifr
        .parse(file, {
          tiff: true,
          gps: true,
          translateKeys: true,
          reviveValues: true,
        })
        .catch(() => null)) as Record<string, unknown> | null;

      const hasGps =
        typeof tags?.latitude === "number" && typeof tags?.longitude === "number";

      // Dos correcciones encadenadas, y las dos hacen falta:
      //
      // 1. `normalizeExifDateToUtcNumbers` deshace la zona horaria del
      //    TELÉFONO, que `exifr` mete al revivir la fecha en el navegador.
      //    Sin esto, `interpretExifClock` — escrita para el servidor, donde
      //    el proceso corre en UTC — corrige dos veces y le marca tres horas
      //    de más a todo participante argentino.
      // 2. `interpretExifClock` reubica esos números en la zona de la
      //    edición, o en el desfasaje que venga en el propio EXIF.
      const exifOffsetMinutes =
        parseExifOffset(tags?.OffsetTimeOriginal) ??
        parseExifOffset(tags?.OffsetTimeDigitized) ??
        parseExifOffset(tags?.OffsetTime);
      const captureDate = interpretExifClock({
        exifDate: normalizeExifDateToUtcNumbers(
          parseFecha(tags?.DateTimeOriginal) ??
            parseFecha(tags?.CreateDate) ??
            parseFecha(tags?.DateCreated),
        ),
        timeZone: editionTimeZone,
        exifOffsetMinutes,
      });

      let width =
        numeroFinitoPositivo(tags?.ExifImageWidth) ?? numeroFinitoPositivo(tags?.ImageWidth);
      let height =
        numeroFinitoPositivo(tags?.ExifImageHeight) ?? numeroFinitoPositivo(tags?.ImageHeight);
      if (width === null || height === null) {
        const medido = await medirConImageBitmap(file);
        width = medido.width;
        height = medido.height;
      }

      // Sólo estos cuatro datos viajan al servidor. La foto nunca sale del
      // navegador: ni bytes, ni miniatura, ni el propio `File`.
      fd = new FormData();
      fd.set("registrationId", registrationId);
      fd.set("editionSlug", editionSlug);
      fd.set("token", accessToken);
      fd.set("hasGps", hasGps ? "true" : "false");
      if (captureDate) fd.set("captureAtMs", String(captureDate.getTime()));
      fd.set("width", String(width ?? NaN));
      fd.set("height", String(height ?? NaN));
    } catch {
      setEstado("error");
      setErrorMessage(readinessCopy.check.readError);
      return;
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }

    try {
      const response = await submitReadinessCheckAction(fd);
      if (!response.ok) {
        setEstado("error");
        setErrorMessage(response.message);
        return;
      }
      setVerdict({
        result: response.verdict.result,
        clockDeltaMinutes: response.verdict.clockDeltaMinutes,
      });
      setEstado("result");
    } catch {
      // La foto se leyó bien: lo que falló fue el viaje al servidor.
      setEstado("error");
      setErrorMessage(readinessCopy.check.submitError);
    }
  }

  function reintentar() {
    setEstado("idle");
    setVerdict(null);
    setErrorMessage(null);
    inputRef.current?.click();
  }

  const resultCopy = verdict ? readinessCopy.results[verdict.result] : null;
  const esExito = verdict?.result === "READY";

  return (
    <Card variant="outlined" className="space-y-4">
      <p className="ck-label text-ck-text">{readinessCopy.check.takePhotoButtonLabel}</p>
      <p className="text-sm text-ck-text-secondary">{readinessCopy.takePhotoNow}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-describedby={statusId}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {/*
        Este botón desaparece cuando hay un resultado en pantalla: ahí el que
        manda es el "Probar de nuevo" de la caja del resultado, que hace
        exactamente lo mismo. Dos botones iguales obligan a elegir entre cosas
        que no se diferencian.
      */}
      {estado === "idle" || estado === "error" ? (
        <Button type="button" onClick={() => inputRef.current?.click()}>
          {readinessCopy.check.takePhotoButtonLabel}
        </Button>
      ) : null}

      {estado === "measuring" ? (
        <p role="status" aria-live="polite" className="text-sm text-ck-text-secondary">
          {readinessCopy.check.measuring}
        </p>
      ) : null}

      {estado === "error" ? (
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className="text-sm text-ck-danger"
        >
          {errorMessage}
        </p>
      ) : null}

      {estado === "result" && resultCopy && verdict ? (
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          className={cn(
            "space-y-2 rounded-[var(--ck-radius-control)] border p-4",
            esExito ? "border-ck-success/50 bg-ck-success/10" : "border-ck-border-strong",
          )}
        >
          {wasLastCheck ? (
            <p className="ck-caption text-ck-text-muted">{readinessCopy.check.lastCheckLabel}</p>
          ) : null}
          <p className={cn("font-semibold", esExito ? "text-ck-success" : "text-ck-text")}>
            {resultCopy.title}
          </p>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            {verdict.result === "CLOCK_OFF" && verdict.clockDeltaMinutes !== null
              ? clockOffMessage(verdict.clockDeltaMinutes)
              : resultCopy.whatToDo}
          </p>

          {verdict.result === "NO_GPS" ? <CameraGpsInstructions /> : null}

          <Button type="button" variant="secondary" size="sm" onClick={reintentar}>
            {readinessCopy.check.retry}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
