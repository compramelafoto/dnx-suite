/**
 * Aísla la landing del resto del sitio y aplica scope CSS (globals.css .charlasfpr-scope).
 */
export default function CharlasFprLayout({ children }: { children: React.ReactNode }) {
  return <div className="charlasfpr-scope">{children}</div>;
}
