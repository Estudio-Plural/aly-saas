"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Guardado de una sección de «Diseñar» (PUT /api/workspaces/[slug]/design).
 * Tras guardar refresca los server components: el menú y Primeros pasos
 * actualizan sus checks.
 */
export function useDesignSave(workspaceSlug: string) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const save = async (body: object, successMessage: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/design`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo guardar");
        return false;
      }
      toast.success(successMessage);
      router.refresh();
      return true;
    } catch {
      toast.error("Error de conexión al guardar");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { save, isSaving };
}
