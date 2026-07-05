import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-[#111827]/10 rounded-3xl p-6 md:p-8",
        "box-border w-full max-w-full min-w-0",
        "shadow-[0_12px_24px_rgba(17,24,39,0.06)] hover:shadow-[0_18px_32px_rgba(17,24,39,0.08)] transition-shadow duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
