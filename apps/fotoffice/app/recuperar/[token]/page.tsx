import { ResetPasswordForm } from "./ResetPasswordForm";

type Props = { params: Promise<{ token: string }> };

export default async function ResetPasswordPage({ params }: Props) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-12 bg-[var(--fo-bg)]">
      <ResetPasswordForm token={token} />
    </main>
  );
}
