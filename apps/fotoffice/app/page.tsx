import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getFotofficePostLoginPath, resolvePlatformRole } from "@/lib/fotoffice-roles";
import { FotofficeHomeEntry } from "@/components/fotoffice-home-entry";

export default async function HomePage() {
  const user = await getAuthUser();
  if (user) {
    redirect(getFotofficePostLoginPath(resolvePlatformRole({ globalRole: user.globalRole, legacyRole: user.role })));
  }
  return <FotofficeHomeEntry />;
}
