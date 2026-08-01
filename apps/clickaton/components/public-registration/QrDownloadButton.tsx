"use client";

type Props = {
  dataUrl: string;
  fileName: string;
  label?: string;
  className?: string;
};

export function QrDownloadButton({
  dataUrl,
  fileName,
  label = "Descargar mi QR",
  className,
}: Props) {
  return (
    <button
      type="button"
      className={
        className ??
        "inline-flex min-h-11 items-center justify-center rounded-[var(--ck-radius-control)] border-2 border-[#F9B114] bg-transparent px-5 text-sm font-semibold text-[#F9B114] transition hover:bg-[#F9B114] hover:text-[#111]"
      }
      onClick={() => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }}
    >
      {label}
    </button>
  );
}
