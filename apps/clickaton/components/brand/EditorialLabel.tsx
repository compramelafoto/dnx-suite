import { cn } from "@/lib/cn";

type EditorialLabelProps = {
  children: string;
  className?: string;
  tone?: "default" | "yellow" | "dark";
};

export function EditorialLabel({
  children,
  className,
  tone = "default",
}: EditorialLabelProps) {
  return (
    <span
      className={cn(
        "ck-mono inline-flex items-center gap-2 border-2 px-2.5 py-1",
        tone === "default" && "border-ck-border-strong bg-ck-white text-ck-black",
        tone === "yellow" && "border-ck-border-strong bg-ck-yellow text-ck-black",
        tone === "dark" && "border-ck-yellow bg-ck-black text-ck-yellow",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}
