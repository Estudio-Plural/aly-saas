"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { CorePrompt } from "@/lib/workspaces";

const FIELDS: {
  key: keyof CorePrompt;
  label: string;
  description: string;
  placeholder: string;
}[] = [
  {
    key: "mission",
    label: "Misión",
    description: "¿Para qué existe este asistente? ¿A quién acompaña y hacia qué objetivo?",
    placeholder: "Ej: Acompañar a cada persona a través de un programa de...",
  },
  {
    key: "scope",
    label: "Alcance",
    description: "¿Qué temas sí y cuáles no? ¿Qué límites tiene? ¿Cuándo deriva a una persona?",
    placeholder: "Ej: Hablás solo de los temas del programa. No das consejos médicos...",
  },
  {
    key: "success_criteria",
    label: "Interacción exitosa",
    description: "¿Cuándo considerás que una conversación fue exitosa?",
    placeholder: "Ej: La persona entendió la idea central y definió un próximo paso...",
  },
  {
    key: "key_actions",
    label: "Acciones clave",
    description: "¿Qué acciones concretas debería realizar la persona a lo largo del programa?",
    placeholder: "Ej: Completar cada momento del programa, aplicar las herramientas...",
  },
];

export function IdentityClient({
  workspaceSlug,
  assistantName,
  initialCorePrompt,
}: {
  workspaceSlug: string;
  assistantName: string;
  initialCorePrompt: CorePrompt;
}) {
  const [corePrompt, setCorePrompt] = useState(initialCorePrompt);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const updateField = (key: keyof CorePrompt, value: string) => {
    setCorePrompt((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (Object.values(corePrompt).some((value) => value.trim().length < 3)) {
      toast.error("Todos los campos necesitan al menos 3 caracteres");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/program`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ core_prompt: corePrompt }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "No se pudo guardar la identidad");
        return;
      }
      setIsDirty(false);
      toast.success("Identidad guardada");
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Identidad del Asistente
          </h1>
          <p className="text-neutral-600 mt-1">
            El prompt núcleo que define el carácter y el objetivo de {assistantName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs text-amber-700">Cambios sin guardar</span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="bg-neutral-900 hover:bg-neutral-800 text-white font-medium shadow-sm"
          >
            <SaveIcon className="mr-2 h-4 w-4" />
            {isSaving ? "Guardando..." : isDirty ? "Guardar Cambios" : "Guardado ✓"}
          </Button>
        </div>
      </div>

      <Card className="border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-xl">Prompt núcleo</CardTitle>
          <CardDescription className="text-base">
            Estas respuestas se inyectan en todas las conversaciones del asistente.
            Definen cómo se comporta más allá de cualquier guion puntual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-3">
              <Label
                htmlFor={field.key}
                className="text-sm font-medium text-neutral-900"
              >
                {field.label}
              </Label>
              <Textarea
                id={field.key}
                value={corePrompt[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                maxLength={2000}
                className="border-neutral-300 focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all resize-y"
              />
              <p className="text-xs text-neutral-600">{field.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
