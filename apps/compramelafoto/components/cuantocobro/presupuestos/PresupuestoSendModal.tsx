"use client";

import { usePhotographerVisualIdentity } from "@/components/cuantocobro/PhotographerVisualIdentityContext";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { useCuantoCobroUiAccent } from "@/components/cuantocobro/hooks/useCuantoCobroUiAccent";
import AppModal from "@/components/ui/AppModal";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  Bold,
  Eye,
  FileText,
  Globe,
  Info,
  Italic,
  Link2,
  List,
  Mail,
  RotateCcw,
  Send,
  Shield,
  Smile,
  Type,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

export type PresupuestoSendInput = {
  to: string;
  subject: string;
  message: string;
  includePdf: boolean;
  includeLink: boolean;
  confirmed: boolean;
};

const MESSAGE_MAX_LENGTH = 2000;
const DEFAULT_SEND_MESSAGE =
  "Hola,\n\nTe comparto el presupuesto para el trabajo fotográfico. Cualquier consulta, escribime.\n\nSaludos.";
const SENDER_EMAIL = "no-reply@compramelafoto.com";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteNumber: string;
  versionNumber: number;
  defaultEmail: string;
  onSend: (input: PresupuestoSendInput) => Promise<void>;
  accentColor?: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidEmailList(value: string): boolean {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every(isValidEmail);
}

function formatPreviewRecipients(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "email@cliente.com";
  return trimmed;
}

type IncludeOptionProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: string;
};

function SendIncludeOption({ checked, onChange, icon: Icon, title, description }: IncludeOptionProps) {
  return (
    <label
      className={cn("cc-send-include-card", checked && "cc-send-include-card--selected")}
    >
      <input
        type="checkbox"
        className="cc-send-include-card__checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="cc-send-include-card__check" aria-hidden />
      <span className="cc-send-include-card__icon-wrap" aria-hidden>
        <Icon className="cc-send-include-card__icon" />
      </span>
      <span className="cc-send-include-card__text">
        <span className="cc-send-include-card__title">{title}</span>
        <span className="cc-send-include-card__desc">{description}</span>
      </span>
    </label>
  );
}

export default function PresupuestoSendModal({
  open,
  onClose,
  quoteNumber,
  versionNumber,
  defaultEmail,
  onSend,
  accentColor: accentColorProp,
}: Props) {
  const accentFromHook = useCuantoCobroUiAccent();
  const accentColor = accentColorProp ?? accentFromHook;
  const { identity } = usePhotographerVisualIdentity();

  const [to, setTo] = useState(defaultEmail);
  const [subject, setSubject] = useState(`Presupuesto ${quoteNumber}`);
  const [message, setMessage] = useState(DEFAULT_SEND_MESSAGE);
  const [includePdf, setIncludePdf] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchedTo, setTouchedTo] = useState(false);

  const accentStyle = useMemo(
    () => ({ "--cc-accent": accentColor }) as CSSProperties,
    [accentColor],
  );

  const senderLabel = identity.displayName?.trim() || "Tu estudio";
  const emailInvalid = touchedTo && !isValidEmailList(to);
  const canSend = isValidEmailList(to) && (includePdf || includeLink) && !sending;

  useEffect(() => {
    if (!open) return;
    setTo(defaultEmail);
    setSubject(`Presupuesto ${quoteNumber}`);
    setMessage(DEFAULT_SEND_MESSAGE);
    setIncludePdf(true);
    setIncludeLink(true);
    setTouchedTo(false);
    setError(null);
  }, [open, defaultEmail, quoteNumber]);

  function handleMessageChange(value: string) {
    setMessage(value.slice(0, MESSAGE_MAX_LENGTH));
  }

  async function handleSubmit() {
    setTouchedTo(true);
    if (!isValidEmailList(to)) {
      setError("Ingresá al menos un email válido del cliente.");
      return;
    }
    if (!includePdf && !includeLink) {
      setError("Elegí adjuntar el PDF o incluir un enlace.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      await onSend({
        to,
        subject,
        message,
        includePdf,
        includeLink,
        confirmed: true,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el email");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      maxWidthCapRem="72rem"
      showCloseButton={false}
      panelClassName="cc-presupuesto-send-modal cc-page"
      contentClassName="!p-0 !overflow-hidden flex min-h-0 flex-1 flex-col"
      zIndexClass="z-[95]"
      ariaLabelledBy="cc-send-modal-title"
    >
      <div className="cc-send-modal" style={accentStyle}>
        <header className="cc-send-modal__header">
          <div className="cc-send-modal__header-main">
            <span className="cc-send-modal__header-icon-wrap" aria-hidden>
              <Send className="cc-send-modal__header-icon" />
            </span>
            <div className="cc-send-modal__header-text min-w-0">
              <h2 id="cc-send-modal-title" className="cc-send-modal__title m-0">
                Enviar presupuesto
              </h2>
              <p className="cc-send-modal__subtitle m-0">
                El cliente recibirá un email con la propuesta y un enlace para verla online.
                <span className="sr-only">
                  {" "}
                  Presupuesto {quoteNumber}, versión {versionNumber}.
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cc-send-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="cc-send-modal__body">
          <div className="cc-send-modal__grid">
            <div className="cc-send-modal__form">
              <div className="cc-send-field">
                <label className="cc-send-field__label" htmlFor="cc-send-to">
                  Para
                </label>
                <div
                  className={cn(
                    "cc-send-field-input-wrap",
                    emailInvalid && "cc-send-field-input-wrap--invalid",
                  )}
                >
                  <Mail className="cc-send-field-input-wrap__icon" aria-hidden />
                  <Input
                    id="cc-send-to"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    className="cc-send-field-input-wrap__input min-h-[44px]"
                    placeholder="Email del cliente*"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    onBlur={() => setTouchedTo(true)}
                    aria-invalid={emailInvalid}
                    aria-describedby="cc-send-to-help"
                  />
                </div>
                <p id="cc-send-to-help" className="cc-send-field__help m-0">
                  Podés agregar varios correos separados por coma.
                </p>
                {emailInvalid ? (
                  <p className="cc-send-field__error m-0" role="alert">
                    Revisá que los correos estén bien escritos.
                  </p>
                ) : null}
              </div>

              <div className="cc-send-field">
                <label className="cc-send-field__label" htmlFor="cc-send-subject">
                  Asunto
                </label>
                <div className="cc-send-field-input-wrap">
                  <Type className="cc-send-field-input-wrap__icon" aria-hidden />
                  <Input
                    id="cc-send-subject"
                    className="cc-send-field-input-wrap__input min-h-[44px]"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              </div>

              <div className="cc-send-field">
                <div className="cc-send-field__label-row">
                  <label className="cc-send-field__label m-0" htmlFor="cc-send-message">
                    Mensaje
                  </label>
                  <button
                    type="button"
                    className="cc-send-message-reset"
                    onClick={() => setMessage(DEFAULT_SEND_MESSAGE)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Usar mensaje predeterminado
                  </button>
                </div>
                <div className="cc-send-message-editor">
                  <div className="cc-send-message-editor__toolbar" aria-hidden>
                    <button type="button" className="cc-send-message-editor__tool" disabled tabIndex={-1}>
                      <Bold className="h-4 w-4" />
                    </button>
                    <button type="button" className="cc-send-message-editor__tool" disabled tabIndex={-1}>
                      <Italic className="h-4 w-4" />
                    </button>
                    <button type="button" className="cc-send-message-editor__tool" disabled tabIndex={-1}>
                      <List className="h-4 w-4" />
                    </button>
                    <button type="button" className="cc-send-message-editor__tool" disabled tabIndex={-1}>
                      <Link2 className="h-4 w-4" />
                    </button>
                    <button type="button" className="cc-send-message-editor__tool" disabled tabIndex={-1}>
                      <Smile className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    id="cc-send-message"
                    className="cc-send-message-editor__textarea"
                    rows={7}
                    value={message}
                    onChange={(e) => handleMessageChange(e.target.value)}
                    maxLength={MESSAGE_MAX_LENGTH}
                  />
                  <p className="cc-send-message-editor__counter m-0" aria-live="polite">
                    {message.length}/{MESSAGE_MAX_LENGTH}
                  </p>
                </div>
              </div>

              <fieldset className="cc-send-field cc-send-field--fieldset">
                <legend className="cc-send-field__label">Incluir en el email</legend>
                <div className="cc-send-include-list">
                  <SendIncludeOption
                    checked={includePdf}
                    onChange={setIncludePdf}
                    icon={FileText}
                    title="Adjuntar PDF del presupuesto"
                    description="El cliente recibirá la propuesta en PDF."
                  />
                  <SendIncludeOption
                    checked={includeLink}
                    onChange={setIncludeLink}
                    icon={Globe}
                    title="Incluir enlace para ver online"
                    description="El cliente podrá ver la propuesta en su navegador."
                  />
                </div>
              </fieldset>

              <div className="cc-send-info-box" role="note">
                <Info className="cc-send-info-box__icon" aria-hidden />
                <p className="cc-send-info-box__text m-0">
                  Cuando envíes el presupuesto, el cliente recibirá un email con el enlace y los datos indicados.
                </p>
              </div>

              {error ? (
                <p className="cc-send-field__error m-0" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <aside className="cc-send-modal__preview" aria-label="Vista previa del email">
              <div className="cc-send-preview-card">
                <div className="cc-send-preview-card__head">
                  <Eye className="cc-send-preview-card__head-icon" aria-hidden />
                  <h3 className="cc-send-preview-card__title m-0">Vista previa del email</h3>
                </div>

                <div className="cc-send-preview-email">
                  <dl className="cc-send-preview-meta m-0">
                    <div>
                      <dt>De:</dt>
                      <dd>
                        {senderLabel} &lt;{SENDER_EMAIL}&gt;
                      </dd>
                    </div>
                    <div>
                      <dt>Para:</dt>
                      <dd>{formatPreviewRecipients(to)}</dd>
                    </div>
                    <div>
                      <dt>Asunto:</dt>
                      <dd>{subject.trim() || `Presupuesto ${quoteNumber}`}</dd>
                    </div>
                  </dl>

                  <div className="cc-send-preview-message">
                    <p className="m-0 whitespace-pre-wrap">{message || DEFAULT_SEND_MESSAGE}</p>
                  </div>

                  <div className="cc-send-preview-attachments">
                    {includePdf ? (
                      <div className="cc-send-preview-attachment">
                        <span className="cc-send-preview-attachment__icon-wrap" aria-hidden>
                          <FileText className="cc-send-preview-attachment__icon" />
                        </span>
                        <span className="cc-send-preview-attachment__text">
                          <span className="cc-send-preview-attachment__title">{quoteNumber}</span>
                          <span className="cc-send-preview-attachment__desc">PDF adjunto</span>
                        </span>
                      </div>
                    ) : null}
                    {includeLink ? (
                      <div className="cc-send-preview-attachment">
                        <span className="cc-send-preview-attachment__icon-wrap cc-send-preview-attachment__icon-wrap--link" aria-hidden>
                          <Globe className="cc-send-preview-attachment__icon" />
                        </span>
                        <span className="cc-send-preview-attachment__text">
                          <span className="cc-send-preview-attachment__title">Ver presupuesto online</span>
                          <span className="cc-send-preview-attachment__desc">
                            Se incluirá un enlace en el email
                          </span>
                        </span>
                      </div>
                    ) : null}
                    {!includePdf && !includeLink ? (
                      <p className="cc-send-preview-empty m-0">No hay adjuntos ni enlaces seleccionados.</p>
                    ) : null}
                  </div>
                </div>

                <div className="cc-send-preview-security">
                  <Shield className="cc-send-preview-security__icon" aria-hidden />
                  <p className="cc-send-preview-security__text m-0">
                    Enlace seguro y único. El cliente deberá ingresar su email para acceder.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="cc-send-modal__footer">
          <CuantoCobroButton
            type="button"
            variant="outline"
            className="cc-send-modal__footer-btn min-h-[44px] w-full sm:w-auto"
            onClick={onClose}
            disabled={sending}
          >
            Cancelar
          </CuantoCobroButton>
          <CuantoCobroButton
            type="button"
            variant="primary"
            className="cc-send-modal__footer-btn cc-send-modal__submit min-h-[44px] w-full sm:w-auto"
            disabled={!canSend}
            onClick={() => void handleSubmit()}
          >
            <Send className="h-4 w-4 shrink-0" aria-hidden />
            {sending ? "Enviando…" : "Enviar email"}
          </CuantoCobroButton>
        </footer>
      </div>
    </AppModal>
  );
}
