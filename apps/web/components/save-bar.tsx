"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Barra de guardado fija al pie: el único botón primario de la pantalla.
 *
 * Estados (cuando se pasa `saved`):
 *   - sin cambios y nunca guardado → «Guardar» habilitado (guardar confirma el paso);
 *   - sin cambios y ya guardado    → «✓ Guardado» + «Siguiente: {paso} →»;
 *   - con cambios                  → «Cambios sin guardar» + «Guardar».
 * Mientras haya cambios sin guardar, el navegador avisa antes de salir.
 */
export function SaveBar({
  isDirty,
  isSaving,
  onSave,
  label = "Guardar",
  enabled,
  saved,
  next,
}: {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  label?: string;
  /** Fuerza el botón activo aunque no haya cambios (p. ej. primera confirmación). */
  enabled?: boolean;
  /** Si esta sección ya se guardó alguna vez. */
  saved?: boolean;
  /** El paso que sigue, para ofrecerlo cuando ya está todo guardado. */
  next?: { label: string; href: string };
}) {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Algunos navegadores todavía exigen returnValue para mostrar el aviso.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const canSave = Boolean(enabled) || isDirty || saved === false;
  const showSaved = !canSave && saved === true;

  return (
    <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50/95 px-1 py-3 backdrop-blur">
      {isDirty && <span className="text-xs text-neutral-600">Cambios sin guardar</span>}
      {showSaved ? (
        <>
          <span className="flex items-center gap-1 text-sm text-green-700">
            <CheckIcon className="h-4 w-4" /> Guardado
          </span>
          {next && (
            <Button asChild>
              <Link href={next.href}>
                Siguiente: {next.label}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </>
      ) : (
        <Button onClick={onSave} disabled={isSaving || !canSave}>
          {isSaving ? "Guardando…" : canSave ? label : "Guardado"}
        </Button>
      )}
    </div>
  );
}
