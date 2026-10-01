"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LightbulbIcon } from "lucide-react";

/**
 * Campo de texto con «ejemplo editable»: el ejemplo NO es un valor del
 * programa. Se muestra aparte, con otro estilo, y la organización decide si
 * lo usa como punto de partida. Mientras el campo esté vacío, el asistente
 * usa el ejemplo (y el panel lo dice). Con texto, el ejemplo queda plegado en
 * «Ver ejemplo».
 */
export function ExampleField({
  id,
  label,
  hint,
  value,
  example,
  onChange,
  rows = 3,
  maxLength = 2000,
  assistantName,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  example?: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  /** Nombre del asistente, para «Si lo dejas vacío, {asistente} usa esto:». */
  assistantName?: string;
}) {
  const isEmpty = !value.trim();
  const who = assistantName?.trim() || "tu asistente";
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-neutral-900">
        {label}
      </Label>
      {hint && <p className="text-xs text-neutral-600">{hint}</p>}
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder="Escribe con tus palabras…"
        className="resize-y border-neutral-300 bg-white placeholder:italic"
      />
      {example && isEmpty && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <LightbulbIcon className="h-3.5 w-3.5" /> Si lo dejas vacío, {who} usa esto:
          </p>
          <p className="mt-1 text-sm italic text-neutral-600">{example}</p>
          <button
            type="button"
            onClick={() => onChange(example)}
            className="mt-2 text-xs font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
          >
            Usar este ejemplo y editarlo
          </button>
        </div>
      )}
      {example && !isEmpty && (
        <details className="group text-xs text-neutral-500">
          <summary className="cursor-pointer select-none hover:text-neutral-800">
            Ver ejemplo
          </summary>
          <p className="mt-1 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm italic text-neutral-600">
            {example}
          </p>
        </details>
      )}
    </div>
  );
}
