"use client";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

interface JuradoModalContentProps {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
}

export function JuradoModalContent({ onCancel, restrictionMessage }: JuradoModalContentProps) {
  return (
    <div className="space-y-6">
      {restrictionMessage && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold">{restrictionMessage}</div>
      )}
      <p className="text-sm text-fr-muted">Próximamente. Definir integrantes y criterios de evaluación.</p>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="fr-btn fr-btn-secondary">Cerrar</button>
      </div>
    </div>
  );
}
