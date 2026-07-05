"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  ReferralsMeProvider,
  ReferralsMeGate,
  ReferralsTermsModal,
} from "@/components/referrals/ReferralsMeProvider";
import {
  ReferralsSharePanel,
  ReferralsTrainingPanel,
  ReferralsReferredPanel,
  ReferralsFinancesPanel,
  ReferralCommercialBlockConnected,
} from "@/components/referrals/ReferralsMePanels";

function GiftIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="8" y="28" width="48" height="32" rx="2" fill="#F97316" opacity="0.2" stroke="#F97316" strokeWidth="2" />
      <path d="M32 28v32M18 28h28M32 28c0-6 4-12 10-12 4 0 6 2 6 6s-2 6-6 6H32M32 28c0-6-4-12-10-12-4 0-6 2-6 6s2 6 6 6h10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
      <rect x="26" y="14" width="12" height="6" rx="1" fill="#F97316" />
      <path d="M32 20v8M28 18l4 2 4-2" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type ReferidosTabProps = {
  mercadopagoLink?: string;
  centerHref?: string;
  showCenterNotice?: boolean;
  showIntro?: boolean;
};

function ReferidosTabContent({
  centerHref = "/dashboard/referrals",
  showCenterNotice = true,
  showIntro = true,
}: Omit<ReferidosTabProps, "mercadopagoLink">) {
  return (
    <div className="space-y-6">
      {showCenterNotice && (
        <Card className="p-5 border-[#c27b3d]/20 bg-[#fffaf5]">
          <p className="text-sm text-[#4b5563]">
            Ahora podés gestionar tus referidos desde el nuevo Panel de Referidos.
          </p>
          <div className="mt-3">
            <Link href={centerHref}>
              <Button variant="secondary" size="sm">
                Ir al Panel de Referidos
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {showIntro && (
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-shrink-0 text-orange-500">
            <GiftIcon className="w-14 h-14" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a]">Programa de referidos</h2>
            <p className="text-sm text-[#6b7280] mt-0.5">
              Un solo enlace para invitar fotógrafos u organizadores y cobrar comisiones por sus
              ventas.
            </p>
          </div>
        </div>
      )}

      <ReferralsMeGate>
        <div className="space-y-6">
          <ReferralCommercialBlockConnected />
          <ReferralsSharePanel />
          <ReferralsTrainingPanel />
          <ReferralsReferredPanel />
          <ReferralsFinancesPanel />
        </div>
      </ReferralsMeGate>
      <ReferralsTermsModal />
    </div>
  );
}

export default function ReferidosTab({
  mercadopagoLink = "/fotografo/configuracion?tab=mercadopago",
  centerHref = "/dashboard/referrals",
  showCenterNotice = true,
  showIntro = true,
}: ReferidosTabProps) {
  return (
    <ReferralsMeProvider mercadopagoLink={mercadopagoLink}>
      <ReferidosTabContent
        centerHref={centerHref}
        showCenterNotice={showCenterNotice}
        showIntro={showIntro}
      />
    </ReferralsMeProvider>
  );
}
