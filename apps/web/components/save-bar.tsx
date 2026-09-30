"use client";

import { Button } from "@/components/ui/button";

/** Barra de guardado fija al pie: el único botón primario de la pantalla. */
export function SaveBar({
  isDirty,
  isSaving,
  onSave,
  label = "Guardar",
  enabled,
}: {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  label?: string;
  /** Fuerza el botón activo aunque no haya cambios (p. ej. primera confirmación). */
  enabled?: boolean;
}) {
  const canSave = enabled || isDirty;
  return (
    <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50/95 px-1 py-3 backdrop-blur">
      {isDirty && <span className="text-xs text-amber-700">Cambios sin guardar</span>}
      <Button onClick={onSave} disabled={isSaving || !canSave}>
        {isSaving ? "Guardando…" : canSave ? label : "Guardado"}
      </Button>
    </div>
  );
}
