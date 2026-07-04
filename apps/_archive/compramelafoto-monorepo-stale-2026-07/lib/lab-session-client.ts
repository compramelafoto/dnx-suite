export type LabSession = {
  labId: number;
};

export async function ensureLabSession(): Promise<LabSession | null> {
  if (typeof window === "undefined") return null;

  const savedLabId = sessionStorage.getItem("labId");
  if (savedLabId) {
    const id = Number(savedLabId);
    if (Number.isFinite(id)) {
      return { labId: id };
    }
  }

  try {
    const res = await fetch("/api/lab/status", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const labId = Number(data?.labId);
    if (!Number.isFinite(labId)) return null;

    sessionStorage.setItem("labId", String(labId));
    if (!sessionStorage.getItem("lab")) {
      sessionStorage.setItem(
        "lab",
        JSON.stringify({ labId, role: data?.userRole || "LAB" })
      );
    }
    if (data) {
      sessionStorage.setItem(
        "labStatus",
        JSON.stringify({
          approvalStatus: data.approvalStatus,
          canOperate: data.canOperate,
          needsMpConnection: data.needsMpConnection,
          needsTermsAcceptance: data.needsTermsAcceptance,
          termsVersion: data.termsVersion,
        })
      );
    }

    return { labId };
  } catch (err) {
    console.error("Error verificando sesión de laboratorio:", err);
    return null;
  }
}
