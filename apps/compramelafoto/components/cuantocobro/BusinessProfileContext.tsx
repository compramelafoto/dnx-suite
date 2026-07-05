"use client";

import BusinessProfileModal from "@/components/cuantocobro/BusinessProfileModal";
import {
  CC_BUSINESS_PROFILE_UPDATED_EVENT,
  loadBusinessProfile,
  type CuantoCobroBusinessProfile,
} from "@/lib/cuantocobro/business-profile";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BusinessProfileContextValue = {
  profile: CuantoCobroBusinessProfile | null;
  refreshProfile: () => void;
  openBusinessProfileModal: (options?: { highlightSection?: "address" }) => void;
};

const BusinessProfileContext = createContext<BusinessProfileContextValue | null>(null);

export function BusinessProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<CuantoCobroBusinessProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [highlightSection, setHighlightSection] = useState<"address" | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refreshProfile = useCallback(() => {
    setProfile(loadBusinessProfile());
  }, []);

  useEffect(() => {
    refreshProfile();
    setHydrated(true);
  }, [refreshProfile]);

  useEffect(() => {
    if (!hydrated) return;

    const onUpdated = () => refreshProfile();
    window.addEventListener(CC_BUSINESS_PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(CC_BUSINESS_PROFILE_UPDATED_EVENT, onUpdated);
  }, [hydrated, refreshProfile]);

  const value = useMemo(
    () => ({
      profile,
      refreshProfile,
      openBusinessProfileModal: (options?: { highlightSection?: "address" }) => {
        setHighlightSection(options?.highlightSection ?? null);
        setModalOpen(true);
      },
    }),
    [profile, refreshProfile],
  );

  return (
    <BusinessProfileContext.Provider value={value}>
      {children}
      <BusinessProfileModal
        open={modalOpen}
        highlightSection={highlightSection}
        onClose={() => {
          setModalOpen(false);
          setHighlightSection(null);
        }}
        storedProfile={profile}
        onSaved={(saved) => {
          setProfile(saved);
          setModalOpen(false);
          setHighlightSection(null);
        }}
      />
    </BusinessProfileContext.Provider>
  );
}

export function useCuantoCobroBusinessProfile(): BusinessProfileContextValue {
  const ctx = useContext(BusinessProfileContext);
  if (!ctx) {
    throw new Error("useCuantoCobroBusinessProfile debe usarse dentro de BusinessProfileProvider");
  }
  return ctx;
}
