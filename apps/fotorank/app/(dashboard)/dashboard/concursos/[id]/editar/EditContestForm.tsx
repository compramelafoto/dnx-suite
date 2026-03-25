"use client";

import { useActionState } from "react";
import Link from "next/link";
import { editContestFormAction } from "../../../../../actions/contests";
import { inputBase, textareaWizard } from "../../../../../components/ui/form";
import { routes } from "../../../../../lib/routes";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "READY_TO_PUBLISH", label: "Listo para publicar" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "ARCHIVED", label: "Archivado" },
] as const;

interface EditContestFormProps {
  contest: Contest;
}

export function EditContestForm({ contest }: EditContestFormProps) {
  const [state, formAction] = useActionState(editContestFormAction, null);

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-8">
      <input type="hidden" name="contestId" value={contest.id} />

      {state?.error && (
        <div
          className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-6 rounded-xl border border-[#262626] bg-[#141414] p-6 sm:p-8">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium text-fr-primary">
            Título <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={contest.title}
            className={inputBase}
            placeholder="Nombre del concurso"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="shortDescription" className="block text-sm font-medium text-fr-primary">
            Descripción breve
          </label>
          <input
            id="shortDescription"
            name="shortDescription"
            type="text"
            defaultValue={contest.shortDescription ?? ""}
            className={inputBase}
            placeholder="Resumen para listados"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="fullDescription" className="block text-sm font-medium text-fr-primary">
            Descripción completa
          </label>
          <textarea
            id="fullDescription"
            name="fullDescription"
            defaultValue={contest.fullDescription ?? ""}
            className={textareaWizard}
            placeholder="Descripción detallada del concurso"
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="block text-sm font-medium text-fr-primary">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={contest.status === "ACTIVE" ? "PUBLISHED" : contest.status === "SETUP_IN_PROGRESS" ? "DRAFT" : contest.status}
            className="block w-full cursor-pointer appearance-none rounded-lg border border-[#262626] bg-[#0a0a0a] px-5 py-4 pr-10 text-base leading-relaxed text-fr-primary transition-colors hover:border-[#333] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 bg-no-repeat bg-[length:1.25rem] bg-[right_0.75rem_center]"
            style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a1a1a1'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")" }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-[#262626] bg-[#141414] p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-fr-primary">Contenido público del concurso</h2>
          <p className="text-sm leading-relaxed text-fr-muted">
            Esta información se muestra en la landing pública del concurso para comunicar mejor la propuesta a
            quienes quieran participar.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="prizesSummary" className="block text-sm font-medium text-fr-primary">
            Resumen de premios
          </label>
          <p className="text-sm text-fr-muted">
            Contá de forma breve cuáles son los premios, menciones o beneficios para quienes participen.
          </p>
          <textarea
            id="prizesSummary"
            name="prizesSummary"
            defaultValue={contest.prizesSummary ?? ""}
            className={textareaWizard}
            rows={5}
            placeholder="Ejemplo: Primer premio en efectivo, diploma, difusión en redes, exposición colectiva y menciones especiales del jurado."
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sponsorsText" className="block text-sm font-medium text-fr-primary">
            Sponsors y apoyos
          </label>
          <p className="text-sm text-fr-muted">
            Podés mencionar empresas, instituciones o aliados que acompañan el concurso.
          </p>
          <textarea
            id="sponsorsText"
            name="sponsorsText"
            defaultValue={contest.sponsorsText ?? ""}
            className={textareaWizard}
            rows={5}
            placeholder="Ejemplo: Concurso acompañado por la Asociación X, el Sponsor Y y el apoyo institucional de Z."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="fr-btn fr-btn-primary">
          Guardar cambios
        </button>
        <Link href={routes.dashboard.concursos.detalle(contest.id)} className="fr-btn fr-btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
