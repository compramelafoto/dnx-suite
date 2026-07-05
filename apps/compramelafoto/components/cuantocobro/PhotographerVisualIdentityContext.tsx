"use client";

import {
  PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS,
  buildPhotographerVisualIdentityCssVars,
  mapUserToPhotographerVisualIdentity,
  type PhotographerVisualIdentity,
} from "@/lib/photographer/visual-identity";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

type PhotographerVisualIdentityContextValue = {
  identity: PhotographerVisualIdentity;
  loading: boolean;
  refreshIdentity: () => Promise<void>;
};

const defaultIdentity = mapUserToPhotographerVisualIdentity({
  email: "",
  name: null,
  companyName: null,
  companyOwner: null,
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  tertiaryColor: null,
  fontColor: null,
  headerBackgroundColor: null,
  footerBackgroundColor: null,
  heroBackgroundColor: null,
  pageBackgroundColor: null,
  phone: null,
  whatsapp: null,
  website: null,
  instagram: null,
});

const PhotographerVisualIdentityContext =
  createContext<PhotographerVisualIdentityContextValue | null>(null);

export function PhotographerVisualIdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<PhotographerVisualIdentity>(defaultIdentity);
  const [loading, setLoading] = useState(true);

  const refreshIdentity = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) return;
      const me = (await meRes.json()) as { user?: { id?: number } };
      const userId = me.user?.id;
      if (!userId) return;

      const profileRes = await fetch(`/api/fotografo/${userId}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!profileRes.ok) return;
      const data = (await profileRes.json()) as Parameters<typeof mapUserToPhotographerVisualIdentity>[0];
      setIdentity(mapUserToPhotographerVisualIdentity(data));
    } catch {
      setIdentity(defaultIdentity);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshIdentity();
  }, [refreshIdentity]);

  const value = useMemo(
    () => ({
      identity,
      loading,
      refreshIdentity,
    }),
    [identity, loading, refreshIdentity],
  );

  return (
    <PhotographerVisualIdentityContext.Provider value={value}>
      {children}
    </PhotographerVisualIdentityContext.Provider>
  );
}

export function usePhotographerVisualIdentity(): PhotographerVisualIdentityContextValue {
  const ctx = useContext(PhotographerVisualIdentityContext);
  if (!ctx) {
    throw new Error(
      "usePhotographerVisualIdentity debe usarse dentro de PhotographerVisualIdentityProvider",
    );
  }
  return ctx;
}

export function usePhotographerVisualIdentityStyle(
  identity: PhotographerVisualIdentity = defaultIdentity,
): CSSProperties {
  return useMemo(
    () => buildPhotographerVisualIdentityCssVars(identity) as CSSProperties,
    [identity],
  );
}

export { PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS };
