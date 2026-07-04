import OrganizerLayoutClient from "@/components/panels/OrganizerLayoutClient";

export default function OrganizadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrganizerLayoutClient>{children}</OrganizerLayoutClient>;
}
