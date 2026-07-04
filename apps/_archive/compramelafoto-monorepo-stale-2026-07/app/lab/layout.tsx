import LabLayoutClient from "@/components/panels/LabLayoutClient";

export default function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LabLayoutClient>{children}</LabLayoutClient>;
}
