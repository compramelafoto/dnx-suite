"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../../../../components/ui/Modal";
import { RulesAssistantFromContest } from "../../../concursos/nuevo/rules/RulesAssistantFromContest";
import { ContestHeader } from "../../../concursos/components/ContestHeader";
import { ContestSetupChecklist } from "../../../concursos/components/ContestSetupChecklist";
import { ContestProgressSummary } from "../../../concursos/components/ContestProgressSummary";
import { DatosModalContent } from "./modals/DatosModalContent";
import { FechasModalContent } from "./modals/FechasModalContent";
import { CategoriasModalContent } from "./modals/CategoriasModalContent";
import { JuradoModalContent } from "./modals/JuradoModalContent";
import {
  getAllModules,
  getOverallProgress,
} from "../../../../lib/fotorank/contestProgress";
import type { ContestModuleId } from "../../../../lib/fotorank/contestProgress";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../lib/fotorank/contests").getFotorankContestById>>
>;

interface ContestDashboardProps {
  contest: Contest;
}

export function ContestDashboard({ contest }: ContestDashboardProps) {
  const router = useRouter();
  const [openModuleId, setOpenModuleId] = useState<ContestModuleId | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  const modules = getAllModules(contest);
  const overallProgress = getOverallProgress(contest);

  const handleModuleClick = (moduleId: string) => {
    setOpenModuleId(moduleId as ContestModuleId);
  };

  const closeModal = () => {
    setOpenModuleId(null);
    router.refresh();
  };

  const getModuleForModal = () => {
    if (!openModuleId) return null;
    return modules.find((m) => m.id === openModuleId);
  };

  const modalModule = getModuleForModal();

  const renderModalContent = () => {
    if (!openModuleId || !modalModule) return null;
    const readOnly = modalModule.editPermission === "locked";
    const restrictionMessage = modalModule.restrictionMessage;

    switch (openModuleId) {
      case "datos":
        return (
          <DatosModalContent
            contest={contest}
            onSuccess={closeModal}
            onCancel={closeModal}
            readOnly={readOnly}
            restrictionMessage={restrictionMessage}
          />
        );
      case "fechas":
        return (
          <FechasModalContent
            contest={contest}
            onSuccess={closeModal}
            onCancel={closeModal}
            readOnly={readOnly}
            restrictionMessage={restrictionMessage}
          />
        );
      case "categorias":
        return (
          <CategoriasModalContent
            contest={contest}
            onSuccess={closeModal}
            onCancel={closeModal}
            readOnly={readOnly}
            restrictionMessage={restrictionMessage}
          />
        );
      case "jurado":
        return (
          <JuradoModalContent
            contest={contest}
            onSuccess={closeModal}
            onCancel={closeModal}
            readOnly={readOnly}
            restrictionMessage={restrictionMessage}
          />
        );
      case "bases":
        return (
          <RulesAssistantFromContest
            contest={contest}
            onAccept={closeModal}
            onCancel={closeModal}
          />
        );
      case "premios":
      case "comercializacion":
      case "publicacion":
        return (
          <div className="space-y-6">
            <p className="text-sm text-fr-muted">Próximamente.</p>
            <button type="button" onClick={closeModal} className="fr-btn fr-btn-secondary">
              Cerrar
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const getModalTitle = () => {
    if (!modalModule) return "";
    return modalModule.label;
  };

  return (
    <div className="flex flex-col gap-10 lg:gap-12">
      <ContestHeader contest={contest} />

      <div className="grid gap-16 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-16">
          <ContestSetupChecklist
            modules={modules}
            onModuleClick={handleModuleClick}
            onLockedClick={(msg) => setLockedMessage(msg)}
          />
        </div>

        <div className="mt-2 lg:mt-10 lg:sticky lg:top-24 lg:self-start">
          <ContestProgressSummary
            overallProgress={overallProgress}
            modules={modules}
            categoriesCount={contest.categories.length}
            judgesCount={0}
            hasRules={!!contest.rulesText}
            lastUpdated={contest.updatedAt}
          />
        </div>
      </div>

      <Modal
        isOpen={!!openModuleId}
        onClose={closeModal}
        title={getModalTitle()}
        header="full"
        maxWidth="2xl"
        zIndex={60}
        showTopLogo={false}
      >
        <div className="pt-6">{renderModalContent()}</div>
      </Modal>

      <Modal
        isOpen={!!lockedMessage}
        onClose={() => setLockedMessage(null)}
        title="No se puede editar"
        header="full"
        maxWidth="md"
        zIndex={61}
        showTopLogo={false}
      >
        <div className="pt-6">
          <p className="text-sm text-fr-muted">{lockedMessage ?? "Este módulo no está disponible para editar."}</p>
          <button type="button" onClick={() => setLockedMessage(null)} className="fr-btn fr-btn-secondary mt-6">
            Cerrar
          </button>
        </div>
      </Modal>
    </div>
  );
}
