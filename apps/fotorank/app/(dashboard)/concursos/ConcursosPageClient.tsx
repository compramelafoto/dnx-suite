"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Icon } from "@repo/design-system";
import { CreateContestWizard } from "./nuevo/CreateContestWizard";
import { ContestCard } from "./components/ContestCard";
import { EditContestModal } from "./EditContestModal";

interface Contest {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  status: string;
  categoriesCount: number;
  createdAt: Date;
}

interface ConcursosPageClientProps {
  contests: Contest[];
  organizationName: string;
}

export function ConcursosPageClient({ contests, organizationName }: ConcursosPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editContestId, setEditContestId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("crear") === "1") {
      setModalOpen(true);
      router.replace("/concursos", { scroll: false });
    }
  }, [searchParams, router]);

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <>
      <div className="fr-title-to-content fr-title-to-content-dashboard">
        <Button type="button" onClick={openModal}>
          <span className="inline-flex items-center gap-2">
            <Icon name="plus" size="sm" />
            Crear concurso
          </span>
        </Button>
      </div>

      {contests.length === 0 ? (
        <Card style={{ textAlign: "center", borderStyle: "dashed" }}>
          <p className="font-sans text-xl font-semibold text-fr-primary">
            Todavía no hay concursos creados.
          </p>
          <p className="mt-4 text-base leading-relaxed text-fr-muted">
            Creá tu primer concurso con el asistente.
          </p>
          <div className="mt-8">
            <Button type="button" onClick={openModal}>
              <span className="inline-flex items-center gap-2">
                <Icon name="plus" size="sm" />
                Crear concurso
              </span>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {contests.map((contest) => (
            <ContestCard
              key={contest.id}
              contest={contest}
              onEdit={(id) => setEditContestId(id)}
            />
          ))}
        </div>
      )}

      <CreateContestWizard
        isOpen={modalOpen}
        onClose={closeModal}
        organizationName={organizationName}
        onSuccess={closeModal}
      />

      <EditContestModal
        open={editContestId !== null}
        onClose={() => setEditContestId(null)}
        contestId={editContestId}
      />
    </>
  );
}
