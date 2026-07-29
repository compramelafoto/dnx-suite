import { ResetPasswordForm } from "./ResetPasswordForm";

type Props = { params: Promise<{ token: string }> };

export default async function ResetPasswordPage({ params }: Props) {
  const { token } = await params;
  return <ResetPasswordForm token={token} />;
}
