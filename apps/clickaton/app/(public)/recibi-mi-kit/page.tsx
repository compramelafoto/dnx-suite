import type { Metadata } from "next";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import {
  listKitSelfConfirmCandidates,
  type KitSelfConfirmCandidate,
} from "@/lib/home-delivery/self-confirm";
import {
  KIT_SELF_CONFIRM_MESSAGE,
  type KitSelfConfirmState,
} from "@/lib/home-delivery/self-confirm-rules";
import { participantLivePath } from "@/lib/participant-live/routes";

import { confirmarKitRecibidoAction } from "./actions";
import { KIT_QR_PATH } from "./path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recibí mi kit",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ inscripcion?: string; listo?: string; estado?: string }>;
};

const ESTADOS = new Set<string>(Object.keys(KIT_SELF_CONFIRM_MESSAGE));

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ck-yellow">Clickatón</p>
      <h1 className="mt-2 text-3xl font-bold text-ck-text">¿Te llegó el kit?</h1>
      <div className="mt-6 space-y-4">{children}</div>
    </main>
  );
}

export default async function RecibiMiKitPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await getClickatonAuthUser();

  if (!user) {
    const next = encodeURIComponent(KIT_QR_PATH);
    return (
      <Shell>
        <p className="text-ck-text-secondary">
          Para acreditarte, iniciá sesión con el email con el que te inscribiste. Es lo único
          que hace falta: no tenés que ir a ninguna sede.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href={`${CLICKATON_LOGIN_PATH}?next=${next}`} size="lg">
            Iniciar sesión
          </Button>
          <Button href={`/crear-cuenta?next=${next}`} variant="outline" size="lg">
            No tengo cuenta
          </Button>
        </div>
        <p className="text-sm text-ck-text-muted">
          Si no tenés cuenta, creala con el mismo email de la inscripción y volvé a esta página.
        </p>
      </Shell>
    );
  }

  const candidates = await listKitSelfConfirmCandidates({ id: user.id, email: user.email });
  const recien = sp.listo === "1" ? candidates.find((c) => c.registrationId === sp.inscripcion) : null;
  const aviso =
    sp.estado && ESTADOS.has(sp.estado)
      ? KIT_SELF_CONFIRM_MESSAGE[sp.estado as Exclude<KitSelfConfirmState, "CAN_CONFIRM">]
      : null;

  if (recien) {
    return (
      <Shell>
        <Card className="space-y-3 p-6">
          <p className="text-xl font-semibold text-ck-text">¡Listo, {recien.firstName}! Ya estás acreditado.</p>
          <p className="text-ck-text-secondary">
            El día de la maratón, entrá desde tu cuenta para ver las consignas y subir tus fotos.
          </p>
          <Button href={participantLivePath(recien.registrationId)} size="lg">
            Ir a mi pantalla de la maratón
          </Button>
        </Card>
      </Shell>
    );
  }

  if (candidates.length === 0) {
    return (
      <Shell>
        <p className="text-ck-text-secondary">
          Con <strong className="text-ck-text">{user.email}</strong> no encontramos ninguna inscripción
          con envío del kit a domicilio.
        </p>
        <p className="text-sm text-ck-text-muted">
          Si te inscribiste con otro email, cerrá sesión y entrá con ese. Si participás en una
          sede, te acreditás ahí el día del evento.
        </p>
        <Button href="/mi-cuenta" variant="outline">
          Ir a mi cuenta
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      {aviso ? (
        <p className="rounded-[var(--ck-radius-control)] border border-amber-400/50 bg-amber-400/10 p-3 text-sm text-ck-text" role="status">
          {aviso}
        </p>
      ) : null}
      <p className="text-ck-text-secondary">
        Confirmá que el kit llegó a tus manos y quedás acreditado para la maratón.
      </p>
      {candidates.map((c) => (
        <CandidateCard key={c.registrationId} candidate={c} />
      ))}
    </Shell>
  );
}

function CandidateCard({ candidate: c }: { candidate: KitSelfConfirmCandidate }) {
  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="font-semibold text-ck-text">{c.editionName}</p>
        <p className="text-sm text-ck-text-muted">
          {c.visibleCode ? `Participante ${c.visibleCode} · ` : ""}
          Envío a {c.city}
        </p>
      </div>
      {c.state === "CAN_CONFIRM" ? (
        <form action={confirmarKitRecibidoAction}>
          <input type="hidden" name="registrationId" value={c.registrationId} />
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            Recibí mi kit · acreditarme
          </Button>
        </form>
      ) : c.state === "ALREADY_ACCREDITED" ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-300">{KIT_SELF_CONFIRM_MESSAGE.ALREADY_ACCREDITED}</p>
          <Button href={participantLivePath(c.registrationId)} variant="outline">
            Ir a mi pantalla de la maratón
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ck-text-secondary">{KIT_SELF_CONFIRM_MESSAGE[c.state]}</p>
      )}
    </Card>
  );
}
