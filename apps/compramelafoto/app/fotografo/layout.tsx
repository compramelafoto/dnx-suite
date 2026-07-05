import FotografoLayoutClient from "@/components/panels/FotografoLayoutClient";

export default function FotografoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FotografoLayoutClient>{children}</FotografoLayoutClient>;
}
