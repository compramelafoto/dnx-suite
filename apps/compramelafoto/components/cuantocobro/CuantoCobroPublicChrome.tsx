"use client";

import CuantoCobroLogo from "@/components/cuantocobro/CuantoCobroLogo";
import Link from "next/link";

export default function CuantoCobroPublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="cc-header">
        <div className="container-custom cc-header__inner">
          <CuantoCobroLogo variant="header" href="/cuantocobro" />
        </div>
      </header>
      {children}
      <footer className="cc-public-footer">
        <div className="container-custom cc-public-footer__inner">
          <p className="cc-public-footer__text m-0">
            Una herramienta de{" "}
            <Link href="/" className="cc-public-footer__link">
              ComprameLaFoto
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}
