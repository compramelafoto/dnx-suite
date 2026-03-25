"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

export function Button({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const base = "fr-btn";
  const variants = {
    primary: "fr-btn-primary",
    secondary: "fr-btn-secondary",
  };

  return (
    <Link href={href}>
      <motion.span
        className={`${base} ${variants[variant]} ${className}`}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {children}
      </motion.span>
    </Link>
  );
}
