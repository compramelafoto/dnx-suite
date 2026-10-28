import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/**
 * Las piezas de interfaz que el diseñador traía de CompraMeLaFoto (`components/ui`), con las
 * clases de FOTOFFICE. Mismas propiedades, para no tocar el resto del diseñador.
 */

function unir(...clases: Array<string | undefined | false>) {
  return clases.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline"; children: ReactNode }) {
  return (
    <button
      className={unir(variant === "primary" ? "fo-btn fo-btn-primary text-sm" : "fo-btn fo-btn-secondary text-sm", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={unir("fo-card p-4", className)} {...props}>
      {children}
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={unir("fo-input", className)} {...props}>
      {children}
    </select>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={unir("fo-input", className)} {...props} />;
}
