import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { resolveFotofficePostLoginDestination } from "@/lib/post-login";
import { FotofficeHomeEntry } from "@/components/fotoffice-home-entry";

export default async function HomePage() {
  const user = await getAuthUser();
  if (user) {
    const dest = await resolveFotofficePostLoginDestination({ userId: user.id });
    redirect(dest.path);
  }
  return <FotofficeHomeEntry />;
}
