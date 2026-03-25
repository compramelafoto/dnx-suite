"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, FormField, FormSection, spacing, radius, useResolvedTheme, Card } from "@repo/design-system";
import { uploadJudgeAvatarImage } from "../../actions/judges";
import {
  JUDGE_AVATAR_MAX_BYTES,
  normalizeJudgeAvatarUrl,
} from "../../lib/fotorank/judges/judgeAvatar";
import { JudgeBioEditor } from "./JudgeBioEditor";
import { JudgeOtherLinksEditor } from "./JudgeOtherLinksEditor";

export type JudgeFormValues = {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  shortBio?: string;
  fullBioRichJson?: unknown;
  city?: string;
  country?: string;
  website?: string;
  instagram?: string;
  otherLinksJson?: unknown;
  isPublic?: boolean;
};

interface JudgeFormProps {
  initialValues?: JudgeFormValues;
  initialFullBioRichJson?: unknown;
  initialOtherLinksJson?: unknown;
  onSubmit: (values: JudgeFormValues) => Promise<{ ok: boolean; error?: string }>;
  submitLabel: string;
  showPassword?: boolean;
}

export function JudgeForm({
  initialValues,
  initialFullBioRichJson,
  initialOtherLinksJson,
  onSubmit,
  submitLabel,
  showPassword = false,
}: JudgeFormProps) {
  const theme = useResolvedTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarMode, setAvatarMode] = useState<"url" | "file">(() =>
    initialValues?.avatarUrl?.startsWith("/uploads/judges/") ? "file" : "url"
  );
  const [avatarUrlText, setAvatarUrlText] = useState(
    initialValues?.avatarUrl?.startsWith("/uploads/judges/") ? "" : (initialValues?.avatarUrl ?? "")
  );
  const [avatarFileKey, setAvatarFileKey] = useState(0);
  const [filePreviewObjectUrl, setFilePreviewObjectUrl] = useState<string | null>(null);
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);

  const bioInitial = useMemo(
    () => initialFullBioRichJson ?? initialValues?.fullBioRichJson ?? null,
    [initialFullBioRichJson, initialValues?.fullBioRichJson]
  );
  const linksInitial = useMemo(
    () => initialOtherLinksJson ?? initialValues?.otherLinksJson ?? null,
    [initialOtherLinksJson, initialValues?.otherLinksJson]
  );

  useEffect(() => {
    return () => {
      if (filePreviewObjectUrl) URL.revokeObjectURL(filePreviewObjectUrl);
    };
  }, [filePreviewObjectUrl]);

  const normalizedUrlForPreview = useMemo(() => normalizeJudgeAvatarUrl(avatarUrlText), [avatarUrlText]);

  const avatarPreviewSrc = useMemo(() => {
    if (filePreviewObjectUrl) return filePreviewObjectUrl;
    if (avatarMode === "url" && normalizedUrlForPreview) return normalizedUrlForPreview;
    if (avatarMode === "file" && initialValues?.avatarUrl?.trim()) return initialValues.avatarUrl.trim();
    return null;
  }, [avatarMode, filePreviewObjectUrl, initialValues?.avatarUrl, normalizedUrlForPreview]);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [avatarPreviewSrc, avatarMode]);

  const controlStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: radius.button,
    border: `1px solid ${theme.border.subtle}`,
    background: theme.surface.base,
    color: theme.text.primary,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: "0.95rem",
    outline: "none",
  };

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (filePreviewObjectUrl) {
      URL.revokeObjectURL(filePreviewObjectUrl);
      setFilePreviewObjectUrl(null);
    }
    if (!file) return;
    if (file.size > JUDGE_AVATAR_MAX_BYTES) {
      setError("El archivo supera el tamaño máximo (2 MB).");
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewObjectUrl(url);
    setError(null);
  }

  const resolveAvatarUrl = useCallback(
    async (form: HTMLFormElement): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
      const input = form.querySelector<HTMLInputElement>("#judge-avatar-file");
      const file = input?.files?.[0];
      if (file) {
        if (file.size > JUDGE_AVATAR_MAX_BYTES) {
          return { ok: false, error: "El archivo supera el tamaño máximo (2 MB)." };
        }
        const fd = new FormData();
        fd.append("file", file);
        const up = await uploadJudgeAvatarImage(fd);
        if (!up.ok) return { ok: false, error: up.error };
        return { ok: true, url: up.data!.url };
      }
      if (avatarMode === "url") {
        const trimmed = avatarUrlText.trim();
        if (trimmed && !normalizeJudgeAvatarUrl(trimmed)) {
          return { ok: false, error: "La URL del avatar debe ser http o https válida." };
        }
        return { ok: true, url: trimmed };
      }
      const prev = initialValues?.avatarUrl?.trim() ?? "";
      if (prev) return { ok: true, url: prev };
      return { ok: true, url: "" };
    },
    [avatarMode, avatarUrlText, initialValues?.avatarUrl]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const avatarRes = await resolveAvatarUrl(form);
    if (!avatarRes.ok) {
      setError(avatarRes.error);
      return;
    }

    const safeParseJson = (raw: string, fallback: unknown) => {
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    };

    const values: JudgeFormValues = {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      avatarUrl: avatarRes.url,
      shortBio: String(fd.get("shortBio") ?? ""),
      fullBioRichJson: safeParseJson(String(fd.get("fullBioRichJson") || "{}"), { version: 1, blocks: [] }),
      city: String(fd.get("city") ?? ""),
      country: String(fd.get("country") ?? ""),
      website: String(fd.get("website") ?? ""),
      instagram: String(fd.get("instagram") ?? ""),
      otherLinksJson: safeParseJson(String(fd.get("otherLinksJson") || "{}"), { version: 1, links: [] }),
      isPublic: fd.get("isPublic") === "on",
    };

    setError(null);
    setLoading(true);
    const result = await onSubmit(values);
    setLoading(false);
    if (!result.ok) setError(result.error ?? "No se pudo guardar");
    else if (form.querySelector<HTMLInputElement>("#judge-avatar-file")?.files?.[0]) {
      setAvatarFileKey((k) => k + 1);
      if (filePreviewObjectUrl) {
        URL.revokeObjectURL(filePreviewObjectUrl);
        setFilePreviewObjectUrl(null);
      }
    }
  }

  return (
    <form
      data-testid="judge-admin-form"
      method="post"
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}
    >
      {error ? (
        <div
          role="alert"
          style={{
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.1)",
            color: "#fca5a5",
            padding: spacing[4],
            borderRadius: radius.button,
          }}
        >
          {error}
        </div>
      ) : null}

      <FormSection title="Datos personales" style={{ marginBottom: 0 }}>
        <FormField label="Nombre" htmlFor="judge-firstName" required>
          <input id="judge-firstName" name="firstName" defaultValue={initialValues?.firstName ?? ""} style={controlStyle} required />
        </FormField>
        <FormField label="Apellido" htmlFor="judge-lastName" required>
          <input id="judge-lastName" name="lastName" defaultValue={initialValues?.lastName ?? ""} style={controlStyle} required />
        </FormField>
        <FormField label="Email" htmlFor="judge-email" required>
          <input id="judge-email" name="email" type="email" defaultValue={initialValues?.email ?? ""} style={controlStyle} required />
        </FormField>
        {showPassword ? (
          <FormField label="Contraseña" htmlFor="judge-password" required helperText="Mínimo 8 caracteres.">
            <input id="judge-password" name="password" type="password" style={controlStyle} required />
          </FormField>
        ) : null}
        <FormField label="Teléfono" htmlFor="judge-phone">
          <input id="judge-phone" name="phone" defaultValue={initialValues?.phone ?? ""} style={controlStyle} />
        </FormField>
      </FormSection>

      <FormSection title="Perfil público" style={{ marginBottom: 0 }}>
        <FormField
          label="Foto de perfil"
          helperText="URL https o archivo JPEG/PNG/WebP (máx. 2 MB). Los archivos subidos se guardan vía el servicio de almacenamiento del jurado."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
            <div
              role="radiogroup"
              aria-label="Modo de foto de perfil"
              style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}
            >
              <button
                type="button"
                role="radio"
                aria-checked={avatarMode === "url"}
                data-testid="judge-avatar-tab-url"
                onClick={() => {
                  setAvatarMode("url");
                  setAvatarFileKey((k) => k + 1);
                  if (filePreviewObjectUrl) {
                    URL.revokeObjectURL(filePreviewObjectUrl);
                    setFilePreviewObjectUrl(null);
                  }
                }}
                style={{
                  padding: `${spacing[2]} ${spacing[4]}`,
                  borderRadius: radius.button,
                  border: `1px solid ${avatarMode === "url" ? "#d4af37" : theme.border.subtle}`,
                  background: avatarMode === "url" ? "rgba(212, 175, 55, 0.12)" : theme.surface.base,
                  color: theme.text.secondary,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                Desde URL
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={avatarMode === "file"}
                data-testid="judge-avatar-tab-file"
                onClick={() => setAvatarMode("file")}
                style={{
                  padding: `${spacing[2]} ${spacing[4]}`,
                  borderRadius: radius.button,
                  border: `1px solid ${avatarMode === "file" ? "#d4af37" : theme.border.subtle}`,
                  background: avatarMode === "file" ? "rgba(212, 175, 55, 0.12)" : theme.surface.base,
                  color: theme.text.secondary,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                Subir archivo
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[6], alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div hidden={avatarMode !== "url"} style={avatarMode === "url" ? { display: "block" } : undefined}>
                  <input
                    id="judge-avatarUrl"
                    value={avatarUrlText}
                    onChange={(e) => setAvatarUrlText(e.target.value)}
                    placeholder="https://..."
                    style={controlStyle}
                  />
                </div>
                <div
                  hidden={avatarMode !== "file"}
                  style={
                    avatarMode === "file"
                      ? { display: "flex", flexDirection: "column", gap: spacing[2] }
                      : undefined
                  }
                >
                  <input
                    key={avatarFileKey}
                    id="judge-avatar-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ color: theme.text.secondary }}
                    onChange={handleAvatarFileChange}
                  />
                  {initialValues?.avatarUrl?.startsWith("/uploads/judges/") ? (
                    <p style={{ fontSize: "0.85rem", color: theme.text.secondary, margin: 0 }}>
                      Ya hay una foto en el servidor. Elegí un archivo nuevo para reemplazarla (la anterior se elimina al guardar).
                    </p>
                  ) : null}
                </div>
              </div>

              <Card style={{ flex: "0 0 auto", padding: spacing[4], minWidth: "120px" }} data-testid="judge-avatar-preview">
                <p style={{ fontSize: "0.75rem", color: theme.text.secondary, margin: "0 0 " + spacing[2] + " 0" }}>
                  Vista previa
                </p>
                <div
                  data-testid="judge-avatar-preview-frame"
                  style={{
                    width: "112px",
                    height: "112px",
                    borderRadius: "9999px",
                    border: `1px solid ${theme.border.subtle}`,
                    overflow: "hidden",
                    background: theme.surface.base,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {avatarPreviewSrc && !avatarPreviewError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      data-testid="judge-avatar-preview-img"
                      src={avatarPreviewSrc}
                      alt="Vista previa del avatar del jurado"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={() => setAvatarPreviewError(true)}
                    />
                  ) : (
                    <span
                      data-testid="judge-avatar-preview-placeholder"
                      style={{ fontSize: "0.7rem", color: theme.text.secondary, textAlign: "center", padding: spacing[2] }}
                    >
                      {avatarMode === "url" && avatarUrlText.trim() && !normalizedUrlForPreview
                        ? "URL no válida"
                        : avatarPreviewError
                          ? "No se pudo cargar"
                          : "Sin imagen"}
                    </span>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </FormField>

        <FormField label="Bio breve (resumen)" htmlFor="judge-shortBio" helperText="Texto corto para listados y tarjetas.">
          <textarea id="judge-shortBio" name="shortBio" rows={3} defaultValue={initialValues?.shortBio ?? ""} style={{ ...controlStyle, minHeight: "6rem" }} />
        </FormField>

        <FormField label="Bio ampliada" helperText="Bloques de texto, títulos, listas y enlaces. Sin HTML libre.">
          <JudgeBioEditor initialJson={bioInitial} />
        </FormField>

        <FormField label="Ciudad" htmlFor="judge-city">
          <input id="judge-city" name="city" defaultValue={initialValues?.city ?? ""} style={controlStyle} />
        </FormField>
        <FormField label="País" htmlFor="judge-country">
          <input id="judge-country" name="country" defaultValue={initialValues?.country ?? ""} style={controlStyle} />
        </FormField>
        <FormField label="Sitio web" htmlFor="judge-website" helperText="Se normaliza a https si omitís el protocolo.">
          <input id="judge-website" name="website" defaultValue={initialValues?.website ?? ""} style={controlStyle} />
        </FormField>
        <FormField label="Instagram" htmlFor="judge-instagram" helperText="Usuario o URL completa.">
          <input id="judge-instagram" name="instagram" defaultValue={initialValues?.instagram ?? ""} style={controlStyle} />
        </FormField>

        <div style={{ marginTop: spacing[2] }}>
          <p style={{ fontWeight: 600, color: theme.text.primary, marginBottom: spacing[3] }}>Enlaces adicionales</p>
          <JudgeOtherLinksEditor initialJson={linksInitial} />
        </div>

        <label style={{ display: "flex", gap: spacing[2], alignItems: "center", color: theme.text.secondary }}>
          <input type="checkbox" name="isPublic" defaultChecked={initialValues?.isPublic ?? true} />
          Perfil público visible en concursos
        </label>
      </FormSection>

      <div style={{ display: "flex", gap: spacing[3] }}>
        <Button type="submit" disabled={loading} data-testid="judge-admin-submit">
          {loading ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
