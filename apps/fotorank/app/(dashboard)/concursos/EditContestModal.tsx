"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormSection,
  FormField,
  spacing,
  radius,
  useResolvedTheme,
} from "@repo/design-system";
import { editContestFormActionForModal, getContestForEdit } from "../../actions/contests";

interface EditContestModalProps {
  open: boolean;
  onClose: () => void;
  contestId: string | null;
}

export function EditContestModal({ open, onClose, contestId }: EditContestModalProps) {
  const theme = useResolvedTheme();
  const [contest, setContest] = useState<Awaited<ReturnType<typeof getContestForEdit>>>(null);
  const [loading, setLoading] = useState(false);
  const [state, formAction, isPending] = useActionState(editContestFormActionForModal, null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!open || !contestId) {
      setContest(null);
      submittedRef.current = false;
      return;
    }

    setLoading(true);
    getContestForEdit(contestId)
      .then((result) => setContest(result))
      .finally(() => setLoading(false));
  }, [open, contestId]);

  useEffect(() => {
    if (submittedRef.current && !isPending && state === null) {
      onClose();
      submittedRef.current = false;
    }
  }, [isPending, onClose, state]);

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

  return (
    <Modal open={open} onClose={onClose} maxWidth="52rem" maxHeight="90vh" zIndex={120}>
      <ModalHeader title="Editar concurso" />

      {loading ? (
        <ModalBody>
          <p style={{ color: theme.text.secondary, fontSize: "0.875rem" }} aria-live="polite">
            Cargando...
          </p>
        </ModalBody>
      ) : !contest ? (
        <>
          <ModalBody>
            <p style={{ color: theme.text.secondary, fontSize: "0.875rem" }}>No se pudo cargar el concurso.</p>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </ModalFooter>
        </>
      ) : (
        <form
          action={formAction}
          onSubmit={() => {
            submittedRef.current = true;
          }}
        >
          <input type="hidden" name="contestId" value={contest.id} />
          {/* Estado fijo en este modal (no editable). */}
          <input type="hidden" name="status" value={contest.status} />

          <ModalBody>
            {state?.error ? (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  marginBottom: spacing[6],
                  borderRadius: radius.button,
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#fca5a5",
                  padding: spacing[4],
                  fontSize: "0.875rem",
                }}
              >
                {state.error}
              </div>
            ) : null}

            <FormSection title="Datos generales" style={{ marginBottom: 0 }}>
              {/* Sangría interna para alinear el bloque como el modal de referencia. */}
              <div style={{ paddingLeft: spacing[2], paddingRight: spacing[2] }}>
                <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
                  <FormField label="Título" htmlFor="edit-title" required>
                    <input
                      id="edit-title"
                      name="title"
                      type="text"
                      required
                      defaultValue={contest.title}
                      style={controlStyle}
                    />
                  </FormField>

                  <FormField label="Descripción breve" htmlFor="edit-shortDescription">
                    <input
                      id="edit-shortDescription"
                      name="shortDescription"
                      type="text"
                      defaultValue={contest.shortDescription ?? ""}
                      style={controlStyle}
                    />
                  </FormField>

                  <FormField label="Descripción completa" htmlFor="edit-fullDescription">
                    <textarea
                      id="edit-fullDescription"
                      name="fullDescription"
                      defaultValue={contest.fullDescription ?? ""}
                      rows={5}
                      style={{ ...controlStyle, minHeight: "8rem", resize: "vertical" }}
                    />
                  </FormField>
                </div>
              </div>
            </FormSection>
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
