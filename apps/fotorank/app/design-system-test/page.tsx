"use client";

import { useState } from "react";
import {
  themeComprameLaFoto,
  themeFotorank,
  themeFotoffice,
  spacing,
  radius,
  compositionSpacing,
  semanticColors,
  DesignSystemProvider,
  useDesignSystem,
  Button,
  Card,
  Badge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormSection,
  FormField,
  SectionTitle,
  DialogIntro,
  ActionGroup,
  EmptyState,
  Icon,
  IconButton,
  iconMap,
  deleteAction,
  saveAction,
  copyAction,
  cancelAction,
  disableAction,
  editAction,
  shareAction,
  downloadAction,
  uploadAction,
  WhatsAppButton,
  EmailButton,
  SocialButton,
  WizardLayout,
  WizardSection,
  WizardField,
  Text,
  fontSize,
  useResolvedTheme,
} from "@repo/design-system";

type ThemeId = "compramelafoto" | "fotorank" | "fotoffice";
type ColorMode = "dark" | "light";

const THEMES = {
  compramelafoto: { brand: themeComprameLaFoto.brand, name: "ComprameLaFoto" },
  fotorank: { brand: themeFotorank.brand, name: "FotoRank" },
  fotoffice: { brand: themeFotoffice.brand, name: "FotoOffice" },
} as const;

const ICON_CATS = {
  "Usuario": [
    "login",
    "logout",
    "register",
    "user",
    "userEdit",
    "userSettings",
    "notifications",
    "security"
  ],
  "Navegación": [
    "menu",
    "sidebarToggle",
    "home",
    "dashboard",
    "arrowBack",
    "arrowForward",
    "chevronDown",
    "chevronUp",
    "more"
  ],
  "Configuración": [
    "settings",
    "preferences",
    "language",
    "theme",
    "privacy",
    "permissions"
  ],
  "Estados": [
    "loading",
    "success",
    "error",
    "warning",
    "info",
    "empty",
    "offline",
    "sync"
  ],
  "Fotografía": [
    "camera",
    "gallery",
    "album",
    "upload",
    "download",
    "image",
    "favorite",
    "hide",
    "select",
    "print",
    "buy",
    "cart"
  ],
  "Pagos": [
    "creditCard",
    "payment",
    "receipt",
    "invoice",
    "qr",
    "transfer",
    "discount",
    "coupon",
    "commission"
  ],
  "Social": [
    "share",
    "copyLink",
    "send",
    "message",
    "email",
    "whatsapp"
  ],
  "Productividad": [
    "save",
    "saveAll",
    "duplicate",
    "copy",
    "move",
    "archive",
    "restore",
    "delete",
    "disable",
    "enable",
    "edit"
  ],
  "Organización": [
    "calendar",
    "clock",
    "reminder",
    "event"
  ],
  "Búsqueda": [
    "search",
    "filter",
    "sort",
    "clearFilters"
  ]
};

const WIZARD_STEPS = [
  { id: "basics", label: "Datos" },
  { id: "dates", label: "Fechas" },
  { id: "rules", label: "Reglas" },
  { id: "review", label: "Revisión" },
] as const;

function WizardShowroomFields() {
  const theme = useResolvedTheme();
  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: `${spacing[3]} ${spacing[4]}`,
    borderRadius: radius.input,
    border: `1px solid ${theme.border.default}`,
    background: theme.surface.overlay,
    color: theme.text.primary,
    fontSize: fontSize.sm,
    outline: "none",
  };

  return (
    <WizardSection
      title="Información básica"
      description="Esta información se muestra en el listado público de concursos."
    >
      <WizardField
        label="Nombre del concurso"
        htmlFor="showroom-wizard-title"
        helperText="Nombre corto y claro. Recomendado 80 caracteres o menos."
        required
      >
        <input id="showroom-wizard-title" defaultValue="Retrato de luz natural" style={inputStyle} />
      </WizardField>
      <WizardField
        label="Descripción breve"
        htmlFor="showroom-wizard-desc"
        helperText="Opcional. Un párrafo que resuma el espíritu del concurso."
      >
        <textarea
          id="showroom-wizard-desc"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: "96px" }}
          defaultValue=""
        />
      </WizardField>
    </WizardSection>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useDesignSystem();
  return (
    <section style={{ marginBottom: spacing[16] }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: theme.text.primary, marginBottom: spacing[6], paddingBottom: spacing[4], borderBottom: `1px solid ${theme.border.subtle}` }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ShowroomContent({ themeId, setThemeId }: { themeId: ThemeId; setThemeId: (id: ThemeId) => void }) {
  const { theme, mode, setMode } = useDesignSystem();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLongTitleOpen, setModalLongTitleOpen] = useState(false);
  const [modalBrandStoryOpen, setModalBrandStoryOpen] = useState(false);
  const [compositionModalOpen, setCompositionModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  const showroomInputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: `${spacing[3]} ${spacing[4]}`,
    borderRadius: radius.input,
    border: `1px solid ${theme.border.default}`,
    background: theme.surface.overlay,
    color: theme.text.primary,
    fontSize: fontSize.sm,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.background.primary, color: theme.text.primary, padding: spacing[8], fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ marginBottom: spacing[12] }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: spacing[2] }}>Design System Showroom</h1>
        <p style={{ color: theme.text.secondary, marginBottom: spacing[8] }}>Guía visual, catálogo de iconos y acciones para toda la suite.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[6], alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: theme.text.tertiary, marginBottom: spacing[2] }}>Marca</label>
            <select id="theme" value={themeId} onChange={(e) => setThemeId(e.target.value as ThemeId)} style={{ padding: spacing[2], borderRadius: radius.button, background: theme.surface.base, border: `1px solid ${theme.border.default}`, color: theme.text.primary }}>
              {Object.entries(THEMES).map(([id, { name }]) => (<option key={id} value={id}>{name}</option>))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: theme.text.tertiary, marginBottom: spacing[2] }}>Modo</label>
            <div style={{ display: "flex", gap: spacing[2] }}>
              <Button variant={mode === "dark" ? "primary" : "outline"} size="sm" onClick={() => setMode?.("dark")}>Dark</Button>
              <Button variant={mode === "light" ? "primary" : "outline"} size="sm" onClick={() => setMode?.("light")}>Light</Button>
            </div>
          </div>
        </div>
      </header>
      <Section title="Themes">
        <div style={{ display: "flex", gap: spacing[6], flexWrap: "wrap" }}>
          {Object.entries(THEMES).map(([id, { name, brand }]) => (
            <Card key={id} style={{ minWidth: 200 }}>
              <div style={{ marginBottom: spacing[4] }}>
                <div style={{ width: 40, height: 40, borderRadius: radius.button, background: brand.primary, marginBottom: spacing[4] }} />
                <strong style={{ color: theme.text.primary }}>{name}</strong>
                <p style={{ fontSize: "0.75rem", color: theme.text.secondary, marginTop: spacing[2] }}>Primary: {brand.primary}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Colors">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: spacing[6] }}>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>Neutrales (modo {mode})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              {(["primary","secondary","tertiary"] as const).map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
                  <div style={{ width: 32, height: 32, borderRadius: radius.button, background: theme.background[k], border: `1px solid ${theme.border.subtle}` }} />
                  <span style={{ fontSize: "0.75rem", color: theme.text.secondary }}>background.{k}</span>
                </div>
              ))}
              {(["base","elevated"] as const).map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
                  <div style={{ width: 32, height: 32, borderRadius: radius.button, background: theme.surface[k], border: `1px solid ${theme.border.subtle}` }} />
                  <span style={{ fontSize: "0.75rem", color: theme.text.secondary }}>surface.{k}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>Marca ({THEMES[themeId].name})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              <div style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
                <div style={{ width: 40, height: 40, borderRadius: radius.button, background: theme.brand.primary, border: `1px solid ${theme.border.subtle}` }} />
                <span style={{ fontSize: "0.75rem", color: theme.text.secondary }}>primary</span>
              </div>
            </div>
          </div>
        </div>
      </Section>
      <Section title="Logos / Brand Family">
        <div style={{ display: "flex", gap: spacing[8], flexWrap: "wrap", alignItems: "center" }}>
          {Object.entries(THEMES).map(([id, { name }]) => (
            <div key={id} style={{ padding: spacing[8], background: theme.surface.base, border: `1px solid ${theme.border.default}`, borderRadius: radius.card, minWidth: 160, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, margin: "0 auto", background: theme.surface.elevated, borderRadius: radius.button, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text.tertiary, fontSize: "1.5rem", fontWeight: 700 }}>
                {name.slice(0, 2).toUpperCase()}
              </div>
              <p style={{ marginTop: spacing[4], fontSize: "0.875rem", color: theme.text.secondary }}>{name}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Buttons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], marginBottom: spacing[8] }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], alignItems: "center" }}>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="md">Medium</Button>
          <Button variant="primary" size="lg">Large</Button>
        </div>
      </Section>
      <Section title="Badges">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
      </Section>
      <Section title="Cards">
        <div style={{ display: "flex", gap: compositionSpacing.horizontal.cardGap, flexWrap: "wrap" }}>
          <Card style={{ maxWidth: 320 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: spacing[2] }}>Card title</h3>
            <p style={{ color: theme.text.secondary, fontSize: "0.875rem" }}>Contenido.</p>
          </Card>
          <Card style={{ maxWidth: 320 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: spacing[2] }}>Card con badge</h3>
            <div style={{ display: "flex", gap: spacing[4], alignItems: "center", marginBottom: spacing[4] }}><Badge variant="success">Activo</Badge></div>
          </Card>
        </div>
      </Section>
      <Section title="Composición y jerarquía (compositionSpacing)">
        <p style={{ color: theme.text.secondary, maxWidth: 720, marginBottom: spacing[8], lineHeight: 1.6 }}>
          Referencia viva del ritmo vertical y horizontal definido en{" "}
          <code style={{ fontSize: "0.85em", color: theme.text.primary }}>packages/design-system/.../compositionSpacing.ts</code>.
          En FotoRank, las mismas relaciones están reflejadas en{" "}
          <code style={{ fontSize: "0.85em", color: theme.text.primary }}>globals.css</code> como{" "}
          <code style={{ fontSize: "0.85em", color: theme.text.primary }}>--fr-comp-*</code>.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing[8], marginBottom: spacing[10] }}>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>stack (vertical)</h3>
            {(
              Object.entries(compositionSpacing.stack) as [string, string][]
            ).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[4],
                  marginBottom: spacing[2],
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ width: 160, color: theme.text.tertiary, flexShrink: 0 }}>{key}</span>
                <div
                  style={{
                    height: 8,
                    width: value,
                    minWidth: 4,
                    borderRadius: 2,
                    background: theme.brand.primary,
                  }}
                  title={value}
                />
                <span style={{ color: theme.text.secondary }}>{value}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>form + horizontal</h3>
            {(
              Object.entries(compositionSpacing.form) as [string, string][]
            ).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[4],
                  marginBottom: spacing[2],
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ width: 160, color: theme.text.tertiary, flexShrink: 0 }}>form.{key}</span>
                <div
                  style={{
                    height: 8,
                    width: value,
                    minWidth: 4,
                    borderRadius: 2,
                    background: theme.brand.primary,
                  }}
                />
                <span style={{ color: theme.text.secondary }}>{value}</span>
              </div>
            ))}
            {(
              Object.entries(compositionSpacing.horizontal) as [string, string][]
            ).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[4],
                  marginBottom: spacing[2],
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ width: 160, color: theme.text.tertiary, flexShrink: 0 }}>horizontal.{key}</span>
                <div
                  style={{
                    height: 8,
                    width: value,
                    minWidth: 4,
                    borderRadius: 2,
                    background: theme.brand.accent ?? theme.brand.primary,
                  }}
                />
                <span style={{ color: theme.text.secondary }}>{value}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>modal (panel)</h3>
            {(
              Object.entries(compositionSpacing.modal) as [string, string][]
            ).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[4],
                  marginBottom: spacing[2],
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ width: 160, color: theme.text.tertiary, flexShrink: 0 }}>modal.{key}</span>
                <div
                  style={{
                    height: 8,
                    width: value,
                    minWidth: 4,
                    borderRadius: 2,
                    background: theme.brand.primary,
                  }}
                />
                <span style={{ color: theme.text.secondary }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: spacing[10] }}>
          <SectionTitle
            level="subsection"
            title="SectionTitle (subsection)"
            description="Título → descripción usa stack.titleToSubtitle; margen inferior stack.block."
          />
          <p style={{ color: theme.text.secondary, fontSize: "0.875rem" }}>Contenido ficticio bajo el encabezado de sección.</p>
        </div>
        <div style={{ marginBottom: spacing[10] }}>
          <EmptyState
            icon={<Icon name="empty" size="lg" />}
            title="Sin elementos"
            description="EmptyState centra icono, título y CTA con los mismos gaps que stack.*"
            action={<Button variant="outline" size="sm">Acción</Button>}
          />
        </div>
        <div style={{ maxWidth: 480, marginBottom: spacing[10] }}>
          <FormSection
            title="FormSection + FormField"
            description="Recuadro con padding 32px y entre campos form.betweenFields."
          >
            <FormField label="Nombre" htmlFor="ds-comp-name" helperText="Texto de ayuda bajo el control.">
              <input id="ds-comp-name" defaultValue="Demo" style={showroomInputStyle} />
            </FormField>
            <FormField label="Estado" htmlFor="ds-comp-state" helperText="Mismo label → control → helper que en dashboard.">
              <select id="ds-comp-state" defaultValue="ok" style={showroomInputStyle}>
                <option value="ok">OK</option>
              </select>
            </FormField>
          </FormSection>
        </div>
        <div style={{ marginBottom: spacing[6] }}>
          <Text variant="muted" as="p" style={{ marginBottom: spacing[4] }}>
            ActionGroup <strong>footer</strong>: borde + contentToActions + padding (como fr-form-actions en FotoRank).
          </Text>
          <div style={{ padding: spacing[6], border: `1px dashed ${theme.border.default}`, borderRadius: radius.card }}>
            <p style={{ color: theme.text.secondary, fontSize: "0.875rem", margin: 0 }}>Cuerpo ficticio del formulario.</p>
            <ActionGroup variant="footer" justify="end">
              <Button variant="outline" size="sm">Cancelar</Button>
              <Button variant="primary" size="sm">Guardar</Button>
            </ActionGroup>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: compositionSpacing.horizontal.actionGapComfort }}>
          <Button variant="primary" onClick={() => setCompositionModalOpen(true)}>
            Modal compuesto (DialogIntro + FormSection)
          </Button>
        </div>
        <Modal open={compositionModalOpen} onClose={() => setCompositionModalOpen(false)} maxWidth="28rem">
          <ModalHeader title="Acción requerida" />
          <ModalBody>
            <DialogIntro
              subtitle="Confirmá los datos antes de continuar. Márgenes logo/título/subtítulo: compositionSpacing.modalBrand."
            />
            <div style={{ marginTop: compositionSpacing.stack.block }}>
              <Text variant="body" as="p" style={{ margin: 0 }}>
                Párrafo de cuerpo con variant body (tamaño y color del tema).
              </Text>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setCompositionModalOpen(false)}>Cerrar</Button>
            <Button variant="primary" onClick={() => setCompositionModalOpen(false)}>Entendido</Button>
          </ModalFooter>
        </Modal>
      </Section>
      <Section title="Modal">
        <div style={{ marginBottom: spacing[10], maxWidth: 720 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: spacing[3], color: theme.text.primary }}>
            Anatomía del header (patrón de sistema)
          </h3>
          <Text variant="muted" as="p" style={{ marginBottom: spacing[6], lineHeight: 1.6 }}>
            El header usa <strong>CSS Grid</strong>: columna flexible <code style={{ color: theme.text.secondary }}>minmax(0, 1fr)</code> para
            título (y slots hijos) y columna <code style={{ color: theme.text.secondary }}>auto</code> reservada al cerrar. Así el texto puede
            hacer salto de línea sin invadir la zona de la X. Valores en <code style={{ color: theme.text.secondary }}>compositionSpacing.modal</code>; en FotoRank, variables <code style={{ color: theme.text.secondary }}>--fr-modal-*</code> en <code style={{ color: theme.text.secondary }}>globals.css</code>.
          </Text>
          <div
            style={{
              border: `1px solid ${theme.border.default}`,
              borderRadius: radius.modal,
              overflow: "hidden",
              background: theme.surface.base,
              marginBottom: spacing[6],
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                alignItems: "center",
                columnGap: compositionSpacing.modal.titleToCloseGap,
                boxSizing: "border-box",
                minHeight: compositionSpacing.modal.headerMinHeight,
                padding: `${compositionSpacing.modal.headerPaddingY} ${compositionSpacing.modal.headerPaddingX}`,
                borderBottom: `1px solid ${theme.border.subtle}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                  Título del modal (el ancho útil termina antes de la columna del cerrar)
                </div>
                <div style={{ marginTop: spacing[2], fontSize: "0.65rem", color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Columna 1 · gap = titleToCloseGap ({compositionSpacing.modal.titleToCloseGap})
                </div>
              </div>
              <div
                title={`Área mínima ${compositionSpacing.modal.closeHitArea}`}
                style={{
                  width: compositionSpacing.modal.closeHitArea,
                  height: compositionSpacing.modal.closeHitArea,
                  boxSizing: "border-box",
                  border: `1px dashed ${theme.border.strong}`,
                  borderRadius: radius.button,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  color: theme.text.tertiary,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                ×
                <span style={{ fontSize: "0.6rem", marginTop: 2 }}>{compositionSpacing.modal.closeHitArea}</span>
              </div>
            </div>
            <div style={{ padding: compositionSpacing.modal.bodyPadding, color: theme.text.secondary, fontSize: fontSize.sm }}>
              Cuerpo del modal (bodyPadding = {compositionSpacing.modal.bodyPadding})
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: spacing[4], fontSize: "0.75rem", color: theme.text.secondary, marginBottom: spacing[8] }}>
            <div><strong style={{ color: theme.text.tertiary }}>headerPaddingX / Y</strong><br />{compositionSpacing.modal.headerPaddingX} / {compositionSpacing.modal.headerPaddingY}</div>
            <div><strong style={{ color: theme.text.tertiary }}>titleToCloseGap</strong><br />{compositionSpacing.modal.titleToCloseGap}</div>
            <div><strong style={{ color: theme.text.tertiary }}>closeHitArea</strong><br />{compositionSpacing.modal.closeHitArea} (mín. táctil)</div>
            <div><strong style={{ color: theme.text.tertiary }}>closeGlyphSize</strong><br />{compositionSpacing.modal.closeGlyphSize}</div>
            <div><strong style={{ color: theme.text.tertiary }}>headerMinHeight</strong><br />{compositionSpacing.modal.headerMinHeight}</div>
            <div><strong style={{ color: theme.text.tertiary }}>paddingOverlay</strong><br />{compositionSpacing.modal.paddingOverlay}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: compositionSpacing.horizontal.actionGapComfort }}>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Abrir modal</Button>
          <Button variant="outline" onClick={() => setModalLongTitleOpen(true)}>Modal con título largo</Button>
        </div>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <ModalHeader title="Título del modal" />
          <ModalBody><p style={{ color: theme.text.secondary }}>Contenido. Header, body y footer usan compositionSpacing.modal.*</p></ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Guardar</Button>
          </ModalFooter>
        </Modal>
        <Modal open={modalLongTitleOpen} onClose={() => setModalLongTitleOpen(false)} maxWidth="24rem">
          <ModalHeader title="Confirmación de publicación del concurso internacional de fotografía contemporánea — revisá los datos antes de continuar" />
          <ModalBody>
            <p style={{ color: theme.text.secondary, margin: 0, fontSize: fontSize.sm }}>
              El título anterior hace wrap en la columna flexible; la X permanece en su celda de {compositionSpacing.modal.closeHitArea} sin superponerse al texto.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={() => setModalLongTitleOpen(false)}>Cerrar demo</Button>
          </ModalFooter>
        </Modal>

        <div
          style={{
            marginTop: spacing[12],
            paddingTop: spacing[10],
            borderTop: `1px solid ${theme.border.subtle}`,
            maxWidth: 900,
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: spacing[4], color: theme.text.primary }}>
            Logo / isologo en modales (marca vs funcional)
          </h3>
          <Text variant="muted" as="p" style={{ marginBottom: spacing[8], lineHeight: 1.65, maxWidth: 680 }}>
            Reglas: <strong>con logo</strong> solo onboarding, bienvenida o piezas de marca explícitas.{" "}
            <strong>Sin logo</strong> en login, elección de perfil, formularios y decisiones rápidas. Si hay logo:{" "}
            <strong>arriba del título</strong>, centrado, altura máx. {compositionSpacing.modalBrand.logoMaxHeight}, nunca entre título y descripción. Tokens:{" "}
            <code style={{ color: theme.text.secondary }}>compositionSpacing.modalBrand</code> y en FotoRank{" "}
            <code style={{ color: theme.text.secondary }}>.fr-modal-brand</code>.
          </Text>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: spacing[8],
              marginBottom: spacing[10],
            }}
          >
            <Card style={{ border: `2px solid ${theme.brand.primary}` }}>
              <Badge variant="success" style={{ marginBottom: spacing[4] }}>Correcto</Badge>
              <div style={{ fontSize: fontSize.sm, color: theme.text.secondary, lineHeight: 1.5 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: compositionSpacing.modalBrand.logoToTitle }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      maxHeight: compositionSpacing.modalBrand.logoMaxHeight,
                      borderRadius: radius.button,
                      background: theme.brand.primary,
                      opacity: 0.35,
                    }}
                    aria-hidden
                  />
                </div>
                <div style={{ fontWeight: 600, color: theme.text.primary, marginBottom: compositionSpacing.modalBrand.titleToSubtitle, textAlign: "center" }}>
                  Título del modal
                </div>
                <div style={{ marginBottom: compositionSpacing.modalBrand.subtitleToActions, textAlign: "center" }}>Descripción o lead</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ padding: `${spacing[2]} ${spacing[4]}`, borderRadius: radius.button, background: theme.surface.elevated, fontSize: fontSize.xs }}>Acciones</span>
                </div>
              </div>
              <p style={{ marginTop: spacing[4], marginBottom: 0, fontSize: "0.7rem", color: theme.text.tertiary }}>
                Orden: logo → título → descripción ({compositionSpacing.modalBrand.logoToTitle} / {compositionSpacing.modalBrand.titleToSubtitle}) → acciones ({compositionSpacing.modalBrand.subtitleToActions}).
              </p>
            </Card>
            <Card style={{ border: `1px solid ${semanticColors.danger}` }}>
              <Badge variant="error" style={{ marginBottom: spacing[4] }}>Incorrecto</Badge>
              <div style={{ fontSize: fontSize.sm, color: theme.text.secondary, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 600, color: theme.text.primary, marginBottom: spacing[3], textAlign: "center" }}>Título del modal</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: spacing[3] }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.button,
                      background: theme.brand.primary,
                      opacity: 0.35,
                    }}
                    aria-hidden
                  />
                </div>
                <div style={{ textAlign: "center" }}>Descripción (el logo quedó “flotando” entre título y texto)</div>
              </div>
              <p style={{ marginTop: spacing[4], marginBottom: 0, fontSize: "0.7rem", color: theme.text.tertiary }}>
                Rompe jerarquía y no comunica un rol claro; evitar en el sistema.
              </p>
            </Card>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: spacing[4], fontSize: "0.75rem", color: theme.text.secondary, marginBottom: spacing[8] }}>
            {(
              Object.entries(compositionSpacing.modalBrand) as [string, string][]
            ).map(([key, value]) => (
              <div key={key}>
                <strong style={{ color: theme.text.tertiary }}>modalBrand.{key}</strong>
                <br />
                {value}
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setModalBrandStoryOpen(true)}>
            Abrir modal con marca (DialogIntro + logo)
          </Button>
        </div>
        <Modal open={modalBrandStoryOpen} onClose={() => setModalBrandStoryOpen(false)} maxWidth="26rem">
          <ModalHeader />
          <ModalBody>
            <DialogIntro
              branding={
                <div
                  style={{
                    width: 40,
                    height: 40,
                    maxHeight: compositionSpacing.modalBrand.logoMaxHeight,
                    borderRadius: radius.button,
                    background: theme.brand.primary,
                    opacity: 0.45,
                  }}
                  aria-hidden
                />
              }
              title="Bienvenida"
              subtitle="Logo pequeño arriba del título; mismo ritmo que modalBrand en código."
            >
              <Button variant="primary" onClick={() => setModalBrandStoryOpen(false)}>
                Entendido
              </Button>
            </DialogIntro>
          </ModalBody>
        </Modal>
      </Section>
      <Section title="Wizard (layout)">
        <p style={{ color: theme.text.secondary, marginBottom: spacing[4], maxWidth: 520, fontSize: "0.875rem" }}>
          Demo de <strong>WizardLayout</strong> con pasos, sección y campos. Respeta la marca y el modo seleccionados arriba.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setWizardStep(0);
            setWizardOpen(true);
          }}
        >
          Abrir wizard demo
        </Button>
        <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} maxWidth="48rem" maxHeight="90vh" zIndex={2000}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "min(88vh, 720px)",
              maxHeight: "90vh",
              minHeight: 0,
            }}
          >
            <WizardLayout
              brand={
                <Text
                  variant="h3"
                  as="span"
                  style={{ letterSpacing: "0.08em", textTransform: "uppercase", color: theme.brand.primary }}
                >
                  {THEMES[themeId].name}
                </Text>
              }
              organizationName="Organización demo (showroom)"
              steps={[...WIZARD_STEPS]}
              currentStep={wizardStep}
              title="Datos generales del concurso"
              description="Definí el nombre y la visibilidad. Podés ajustar estos datos más adelante desde el tablero."
              onClose={() => setWizardOpen(false)}
              footerLeft={
                <Button type="button" variant="ghost" onClick={() => setWizardOpen(false)}>
                  Cancelar
                </Button>
              }
              footerRight={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={wizardStep === 0}
                    onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                  >
                    Atrás
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() =>
                      wizardStep >= WIZARD_STEPS.length - 1 ? setWizardOpen(false) : setWizardStep((s) => s + 1)
                    }
                  >
                    {wizardStep >= WIZARD_STEPS.length - 1 ? "Guardar" : "Siguiente"}
                  </Button>
                </>
              }
            >
              <WizardShowroomFields />
            </WizardLayout>
          </div>
        </Modal>
      </Section>
      <Section title="Icons Library">
        {Object.entries(ICON_CATS).map(([catName, icons]) => (
          <div key={catName} style={{ marginBottom: spacing[8] }}>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>{catName}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: spacing[4] }}>
              {icons.map((name) => (name in iconMap) ? (
                <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: spacing[2], padding: spacing[4], background: theme.surface.base, borderRadius: radius.button }}>
                  <Icon name={name as keyof typeof iconMap} size="md" />
                  <span style={{ fontSize: "0.65rem", color: theme.text.tertiary }}>{name}</span>
                </div>
              ) : null)}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], marginTop: spacing[8] }}>
          <Button variant="primary"><Icon name="camera" size="sm" /> Foto</Button>
          <Button variant="outline"><Icon name="favorite" size="sm" /> Favorito</Button>
          <Button variant="secondary"><Icon name="success" size="md" /> Confirmar</Button>
        </div>
      </Section>
      <Section title="Semantic Actions">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
          <Button variant="destructive"><Icon name="delete" size="sm" /> Eliminar</Button>
          <Button variant="primary"><Icon name="save" size="sm" /> Guardar</Button>
          <Button variant="secondary"><Icon name="copy" size="sm" /> Copiar</Button>
          <Button variant="outline"><Icon name="close" size="sm" /> Cancelar</Button>
          <Button variant="secondary"><Icon name="disable" size="sm" /> Desactivar</Button>
          <Badge variant="warning">Advertencia</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="success">Éxito</Badge>
        </div>
      </Section>
      <Section title="Icon Buttons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], marginBottom: spacing[6] }}>
          <IconButton icon="delete" variant="danger" aria-label="Eliminar" />
          <IconButton icon="save" variant="success" aria-label="Guardar" />
          <IconButton icon="copy" variant="secondary" aria-label="Copiar" />
          <IconButton icon="edit" variant="outline" aria-label="Editar" />
          <IconButton icon="share" variant="neutral" aria-label="Compartir" />
          <IconButton icon="download" variant="primary" aria-label="Descargar" />
          <IconButton icon="upload" variant="primary" aria-label="Subir" />
        </div>
        <p style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>Tamaños:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], alignItems: "center" }}>
          <IconButton icon="camera" variant="primary" size="sm" aria-label="Foto" />
          <IconButton icon="camera" variant="primary" size="md" aria-label="Foto" />
          <IconButton icon="camera" variant="primary" size="lg" aria-label="Foto" />
        </div>
      </Section>
      <Section title="User Actions">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
          <Button variant="primary"><Icon name="login" size="sm" /> Ingresar</Button>
          <Button variant="outline"><Icon name="logout" size="sm" /> Salir</Button>
          <Button variant="secondary"><Icon name="user" size="sm" /> Perfil</Button>
          <Button variant="outline"><Icon name="changePassword" size="sm" /> Cambiar contraseña</Button>
        </div>
      </Section>
      <Section title="Navigation">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
          <IconButton icon="menu" variant="ghost" aria-label="Menú" />
          <IconButton icon="sidebarToggle" variant="ghost" aria-label="Sidebar" />
          <IconButton icon="home" variant="ghost" aria-label="Inicio" />
          <IconButton icon="dashboard" variant="ghost" aria-label="Dashboard" />
          <IconButton icon="arrowBack" variant="ghost" aria-label="Volver" />
        </div>
      </Section>
      <Section title="Social / Integrations">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], alignItems: "center" }}>
          <WhatsAppButton phone="5491112345678" message="Hola" />
          <EmailButton to="contacto@ejemplo.com" subject="Consulta" />
          <SocialButton variant="mercadopago" href="#" aria-label="MercadoPago" />
          <SocialButton variant="facebook" href="#" aria-label="Facebook" />
          <SocialButton variant="instagram" href="#" aria-label="Instagram" />
          <SocialButton variant="twitter" href="#" aria-label="Twitter" />
          <SocialButton variant="tiktok" href="#" aria-label="TikTok" />
        </div>
      </Section>
      <Section title="Photography Actions">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
          <Button variant="primary"><Icon name="upload" size="sm" /> Subir fotos</Button>
          <Button variant="primary"><Icon name="download" size="sm" /> Descargar</Button>
          <Button variant="primary"><Icon name="buy" size="sm" /> Comprar</Button>
          <Button variant="secondary"><Icon name="print" size="sm" /> Imprimir</Button>
          <Button variant="outline"><Icon name="favorite" size="sm" /> Favorito</Button>
        </div>
      </Section>
      <Section title="Payment Actions">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
          <Button variant="primary"><Icon name="payment" size="sm" /> Pagar</Button>
          <Button variant="secondary"><Icon name="creditCard" size="sm" /> Tarjeta</Button>
          <Button variant="secondary"><Icon name="qr" size="sm" /> QR</Button>
          <Button variant="outline"><Icon name="receipt" size="sm" /> Recibo</Button>
        </div>
      </Section>
      <Section title="Action Combos">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[6] }}>
          <div style={{ display: "flex", gap: spacing[2] }}>
            <Button variant="primary"><Icon name="save" size="sm" /> Guardar</Button>
            <Button variant="outline"><Icon name="close" size="sm" /> Cancelar</Button>
          </div>
          <div style={{ display: "flex", gap: spacing[2] }}>
            <Button variant="outline"><Icon name="edit" size="sm" /> Editar</Button>
            <Button variant="destructive"><Icon name="delete" size="sm" /> Eliminar</Button>
          </div>
          <div style={{ display: "flex", gap: spacing[2] }}>
            <Button variant="outline"><Icon name="share" size="sm" /> Compartir</Button>
            <Button variant="secondary"><Icon name="copy" size="sm" /> Copiar</Button>
          </div>
          <div style={{ display: "flex", gap: spacing[2] }}>
            <Button variant="secondary"><Icon name="enable" size="sm" /> Activar</Button>
            <Button variant="secondary"><Icon name="disable" size="sm" /> Desactivar</Button>
          </div>
        </div>
      </Section>
      <Section title="Tokens base">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: spacing[8] }}>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>Spacing</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              {Object.entries(spacing).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                  <span style={{ color: theme.text.tertiary }}>{k}</span>
                  <span style={{ color: theme.text.secondary }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>Radius</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              {Object.entries(radius).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                  <span style={{ color: theme.text.tertiary }}>{k}</span>
                  <span style={{ color: theme.text.secondary }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default function DesignSystemTestPage() {
  const [themeId, setThemeId] = useState<ThemeId>("fotorank");
  const [mode, setMode] = useState<ColorMode>("dark");
  return (
    <DesignSystemProvider theme={THEMES[themeId].brand} mode={mode} setMode={setMode}>
      <ShowroomContent themeId={themeId} setThemeId={setThemeId} />
    </DesignSystemProvider>
  );
}
