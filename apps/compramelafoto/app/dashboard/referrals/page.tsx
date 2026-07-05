import ReferralCenter from "@/components/referrals/ReferralCenter";

export const dynamic = "force-dynamic";

export default function DashboardReferralsPage() {
  return (
    <div className="container-custom py-8 md:py-10">
      <ReferralCenter />
    </div>
  );
}

