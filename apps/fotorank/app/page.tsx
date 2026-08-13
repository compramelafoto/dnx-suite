import { landingSignOutAction } from "./actions/landing-session";
import { FotorankPartnerLogoMarquee } from "./components/partners/FotorankPartnerLogoMarquee";
import { HomeView } from "./components/public-home/HomeView";
import { canAccessFotorankOrganizerDashboard, getAuthUser } from "./lib/auth";
import { getJudgeAuthUser } from "./lib/judge-auth";
import {
  FOTORANK_HOME_MARQUEE_PLACEMENT,
  FOTORANK_HOME_MARQUEE_TITLE,
  loadFotorankHomeMarqueeAds,
  toFotorankMarqueePublicItems,
} from "./lib/fotorank/partners/home-marquee";
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

  const [publicContests, homeMarqueeAds] = await Promise.all([
    listPublicHomeContests(6),
    loadFotorankHomeMarqueeAds(),
  ]);
  const homeMarqueeItems = toFotorankMarqueePublicItems(homeMarqueeAds);
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
      brandMarquee={
        homeMarqueeItems.length > 0 ? (
          <FotorankPartnerLogoMarquee
            title={FOTORANK_HOME_MARQUEE_TITLE}
            titleId="home-brand-marquee-title"
            placementKey={FOTORANK_HOME_MARQUEE_PLACEMENT}
            items={homeMarqueeItems}
            sectionId="marcas"
          />
        ) : null
      }
    />
  );
}
