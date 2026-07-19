"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { Storyboard } from "@/lib/workspaces";

const MOMENTS: {
  key: keyof Storyboard;
  title: string;
  description: string;
  placeholder: string;
}[] = [
  {
    key: "opening",
    title: "Arranque",
    description: "Cómo empieza la conversación con cada persona.",
    placeholder: "Ej: Bienvenida cálida y diagnóstico del punto de partida...",
  },
  {
    key: "development",
    title: "Qué pasa",
    description: "El desarrollo: qué conversa y comparte el asistente.",
    placeholder: "Ej: Comparte ideas y herramientas, conversa sobre cómo aplicarlas...",
  },
  {
    key: "next_steps",
    title: "Qué debe pasar después",
    description: "El resultado concreto que tiene que quedar del intercambio.",
    placeholder: "Ej: La persona define un próximo paso concreto y alcanzable...",
  },
  {
    key: "closing",
    title: "Cómo termina",
    description: "El cierre de cada interacción y lo que sigue.",
    placeholder: "Ej: Celebrar el avance y acordar cuándo retomar el contacto...",
  },
];

export function StoryboardSection({
  workspaceSlug,
  initialStoryboard,
}: {
  workspaceSlug: string;
  initialStoryboard: Storyboard;
}) {
  const [storyboard, setStoryboard] = useState(initialStoryboard);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const updateMoment = (key: keyof Storyboard, value: string) => {
    setStoryboard((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (Object.values(storyboard).some((value) => value.trim().length < 3)) {
      toast.error("Todos los momentos necesitan al menos 3 caracteres");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/program`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboard }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "No se pudo guardar el storyboard");
        return;
      }
      setIsDirty(false);
      toast.success("Storyboard guardado");
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-5 border-neutral-200 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Storyboard</h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            El arco que sigue la conversación, en 4 momentos. El asistente lo usa
            como guía en todo el programa.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-700">Cambios sin guardar</span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            size="sm"
            className="bg-neutral-900 hover:bg-neutral-800 text-white"
          >
            <SaveIcon className="h-4 w-4 mr-2" />
            {isSaving ? "Guardando..." : isDirty ? "Guardar" : "Guardado ✓"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {MOMENTS.map((moment, index) => (
          <div key={moment.key} className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">{index + 1}</span>
              </div>
              <span className="text-sm font-semibold text-neutral-900">
                {moment.title}
              </span>
            </div>
            <Textarea
              value={storyboard[moment.key]}
              onChange={(e) => updateMoment(moment.key, e.target.value)}
              placeholder={moment.placeholder}
              rows={4}
              maxLength={2000}
              className="resize-y bg-white text-sm border-neutral-300 focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
            />
            <p className="text-xs text-neutral-600 mt-1.5">{moment.description}</p>
            {index < MOMENTS.length - 1 && (
              <ArrowRightIcon className="hidden xl:block absolute top-2 -right-2.5 h-4 w-4 text-neutral-400" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
