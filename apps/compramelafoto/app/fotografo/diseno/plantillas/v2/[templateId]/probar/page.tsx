import TemplateSandboxClient from "./TemplateSandboxClient";

export const dynamic = "force-dynamic";

export default async function TemplateSandboxPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <TemplateSandboxClient templateId={templateId} />;
}
