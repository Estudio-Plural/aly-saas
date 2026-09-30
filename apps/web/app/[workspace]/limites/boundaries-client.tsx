"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SaveBar } from "@/components/save-bar";
import { LockIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { uid } from "@/lib/utils";
import { SAFETY_RULES, type Boundaries, type BoundaryRule } from "@/lib/design";
import { useDesignSave } from "@/lib/use-design-save";

const SUGGESTIONS = [
  "No recomienda medicamentos ni dosis",
  "No da opiniones políticas ni religiosas",
  "No reemplaza la atención de un profesional de salud",
  "No pide datos personales como documento o dirección",
];

export function BoundariesClient({
  workspaceSlug,
  assistantName,
  initial,
}: {
  workspaceSlug: string;
  assistantName: string;
  initial: Boundaries | null;
}) {
  const [rules, setRules] = useState<BoundaryRule[]>(initial?.rules ?? []);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmed, setConfirmed] = useState(initial !== null);
  const { save, isSaving } = useDesignSave(workspaceSlug);

  const update = (next: BoundaryRule[]) => {
    setRules(next);
    setIsDirty(true);
  };

  const handleSave = async () => {
    const clean = rules
      .map((rule) => ({ ...rule, text: rule.text.trim() }))
      .filter((rule) => rule.text);
    if (clean.some((rule) => rule.text.length > 500)) {
      toast.error("Cada regla puede tener hasta 500 caracteres");
      return;
    }
    const ok = await save({ boundaries: { rules: clean } }, "Reglas guardadas");
    if (ok) {
      setRules(clean);
      setIsDirty(false);
      setConfirmed(true);
    }
  };

  const unusedSuggestions = SUGGESTIONS.filter(
    (text) => !rules.some((rule) => rule.text.trim() === text)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Qué no hace el asistente
        </h1>
        <p className="mt-1 text-neutral-600">
          Los límites de {assistantName}. Las reglas de seguridad ya vienen puestas y
          no se pueden quitar; debajo agregas las de tu organización.
        </p>
      </div>

      <Card className="border-neutral-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Reglas de seguridad</h2>
        <ul className="mt-4 space-y-4">
          {SAFETY_RULES.map((rule) => (
            <li key={rule.id} className="flex gap-3">
              <LockIcon
                aria-label="Fija"
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500"
              />
              <div>
                <p className="text-sm font-medium text-neutral-900">{rule.label}</p>
                <p className="text-xs text-neutral-600">{rule.why}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-neutral-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Reglas de tu organización</h2>
        <p className="mt-0.5 text-sm text-neutral-600">
          Escribe cada regla como una frase corta: «No…».
        </p>

        {rules.length > 0 && (
          <ul className="mt-4 space-y-2">
            {rules.map((rule, index) => (
              <li key={rule.id} className="flex items-center gap-2">
                <Input
                  value={rule.text}
                  aria-label={`Regla ${index + 1}`}
                  maxLength={500}
                  onChange={(e) =>
                    update(
                      rules.map((r) => (r.id === rule.id ? { ...r, text: e.target.value } : r))
                    )
                  }
                  className="bg-white"
                />
                <button
                  type="button"
                  aria-label={`Quitar regla ${index + 1}`}
                  onClick={() => update(rules.filter((r) => r.id !== rule.id))}
                  className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => update([...rules, { id: uid(), text: "" }])}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-neutral-900 hover:underline"
        >
          <PlusIcon className="h-4 w-4" /> Agregar una regla
        </button>

        {unusedSuggestions.length > 0 && (
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="text-xs text-neutral-500">Ideas frecuentes (toca para agregar):</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unusedSuggestions.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => update([...rules, { id: uid(), text }])}
                  className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs italic text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                >
                  + {text}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <SaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        enabled={!confirmed}
        label={confirmed ? "Guardar" : "Confirmar reglas"}
      />
    </div>
  );
}
