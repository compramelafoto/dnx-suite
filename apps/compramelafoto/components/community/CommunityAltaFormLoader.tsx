"use client";

import dynamic from "next/dynamic";

const CommunityAltaForm = dynamic(
  () => import("@/components/community/CommunityAltaForm").then((m) => m.default),
  { ssr: false }
);

type Props = {
  type: "PHOTOGRAPHER_SERVICE" | "EVENT_VENDOR";
  title: string;
  subtitle: string;
  partnerName?: string;
  partnerLogoUrl?: string;
};

export default function CommunityAltaFormLoader(props: Props) {
  return <CommunityAltaForm {...props} />;
}
