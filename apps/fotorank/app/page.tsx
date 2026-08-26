import { landingSignOutAction } from "./actions/landing-session";
import { HomeView } from "./components/public-home/HomeView";
import { canAccessFotorankOrganizerDashboard, getAuthUser } from "./lib/auth";
import { getJudgeAuthUser } from "./lib/judge-auth";
import { listPublicHomeContests } from "./lib/fotorank/publicContests";

export default async function Home() {
  let admin: Awaited<ReturnType<typeof getAuthUser>> = null;
  let judge: Awaited<ReturnType<typeof getJudgeAuthUser>> = null;
  try {
    [admin, judge] = await Promise.all([getAuthUser(), getJudgeAuthUser()]);
  } catch {
    admin = null;
    judge = null;
  }

  const publicContests = await listPublicHomeContests(6);
  let hasFotorankAdminSession = false;
  try {
    hasFotorankAdminSession = await canAccessFotorankOrganizerDashboard(admin);
  } catch {
    hasFotorankAdminSession = false;
  }

  const hasSession = Boolean(admin || judge);
  const panelHref = hasFotorankAdminSession
    ? "/mi-actividad"
    : judge
      ? "/jurado/panel"
      : "/participaciones";

  return (
    <HomeView
      contests={publicContests}
      header={{
        variant: "marketing",
        hasSession,
        userEmail: admin?.email ?? null,
        panelHref,
        signOutAction: hasSession ? landingSignOutAction : undefined,
      }}
    />
  );
}
