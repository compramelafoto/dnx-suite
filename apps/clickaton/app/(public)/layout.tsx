import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
} from "@/lib/admin/auth";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getClickatonAuthUser();
  const authUser = user
    ? {
        name: user.name,
        email: user.email,
        logoUrl: user.logoUrl,
        isAdmin: hasClickatonAdminAccess(user),
      }
    : null;

  return (
    <>
      <SiteHeader authUser={authUser} />
      <main id="contenido-principal">{children}</main>
      <SiteFooter />
    </>
  );
}
