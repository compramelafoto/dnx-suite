"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Icon } from "@repo/design-system";
import { deleteFotorankContest } from "../../../actions/contests";

interface DeleteContestButtonProps {
  contestId: string;
  contestTitle: string;
  variant?: "ghost" | "danger";
  className?: string;
  children?: React.ReactNode;
  /** Modo compacto: muestra solo icono (mantiene aria-label). */
  iconOnly?: boolean;
}

export function DeleteContestButton({
  contestId,
  contestTitle,
  variant = "danger",
  className = "",
  children,
  iconOnly = false,
}: DeleteContestButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    const confirmed = window.confirm(
      `¿Eliminar el concurso "${contestTitle}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await deleteFotorankContest(contestId);
      if (result.ok) {
        router.push("/concursos");
        router.refresh();
      } else {
        alert(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant === "danger" ? "destructive" : "ghost"}
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={className}
      aria-label={`Eliminar concurso ${contestTitle}`}
      title="Eliminar"
    >
      <span className="inline-flex items-center gap-2">
        <Icon name="delete" size="sm" />
        {!iconOnly ? children ?? "Eliminar" : null}
      </span>
    </Button>
  );
}
