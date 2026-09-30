"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveBar } from "@/components/save-bar";
import { InfoIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { uid } from "@/lib/utils";
import type { HelpRoute } from "@/lib/design";
import { useDesignSave } from "@/lib/use-design-save";

const FIELDS: {
  key: keyof Omit<HelpRoute, "id">;
  label: string;
  placeholder: string;
  wide?: boolean;
}[] = [
  { key: "name", label: "Nombre", placeholder: "Línea de salud mental" },
  { key: "contact", label: "Teléfono o canal", placeholder: "106 · WhatsApp 300 000 0000" },
  { key: "hours", label: "Horario", placeholder: "24 horas" },
  { key: "territory", label: "Territorio", placeholder: "Todos los territorios" },
  {
    key: "when",
    label: "Cuándo usarla",
    placeholder: "Crisis emocional o ideas de hacerse daño",
    wide: true,
  },
];

const emptyRoute = (): HelpRoute => ({
  id: uid(),
  name: "",
  contact: "",
  hours: "",
  when: "",
  territory: "",
});

function isBlank(route: HelpRoute): boolean {
  return FIELDS.every(({ key }) => !route[key].trim());
}

export function HelpRoutesClient({
  workspaceSlug,
  initial,
}: {
  workspaceSlug: string;
  assistantName: string;
  initial: HelpRoute[] | null;
}) {
  const [routes, setRoutes] = useState<HelpRoute[]>(
    initial?.length ? initial : [emptyRoute()]
  );
  const [isDirty, setIsDirty] = useState(false);
  const { save, isSaving } = useDesignSave(workspaceSlug);

  const setField = (id: string, key: keyof HelpRoute, value: string) => {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const toSave = routes
      .filter((route) => !isBlank(route))
      .map((route) => ({
        ...route,
        name: route.name.trim(),
        contact: route.contact.trim(),
        hours: route.hours.trim(),
        when: route.when.trim(),
        territory: route.territory.trim(),
      }));
    if (toSave.some((route) => !route.name || !route.contact)) {
      toast.error("Cada ruta necesita un nombre y un teléfono o canal");
      return;
    }
    const ok = await save({ help_routes: toSave }, "Rutas de ayuda guardadas");
    if (ok) {
      setRoutes(toSave.length ? toSave : [emptyRoute()]);
      setIsDirty(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Rutas de ayuda</h1>
        <p className="mt-1 text-neutral-600">
          Las líneas y servicios a los que el asistente puede derivar cuando alguien
          necesita más apoyo.
        </p>
      </div>

      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          El asistente solo da las rutas que pongas acá. Si está vacío, pide a la
          persona buscar ayuda en su territorio sin inventar números.
        </p>
      </div>

      {routes.map((route, index) => (
        <Card key={route.id} className="border-neutral-200 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">
              {route.name.trim() || `Ruta ${index + 1}`}
            </h2>
            <button
              type="button"
              aria-label={`Quitar ruta ${index + 1}`}
              onClick={() => {
                setRoutes((prev) => prev.filter((r) => r.id !== route.id));
                setIsDirty(true);
              }}
              className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
            >
              <Trash2Icon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className={`space-y-1.5 ${field.wide ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={`${route.id}-${field.key}`} className="text-sm">
                  {field.label}
                </Label>
                <Input
                  id={`${route.id}-${field.key}`}
                  value={route[field.key]}
                  placeholder={field.placeholder}
                  maxLength={field.key === "when" ? 500 : 200}
                  onChange={(e) => setField(route.id, field.key, e.target.value)}
                  className="bg-white placeholder:italic"
                />
              </div>
            ))}
          </div>
        </Card>
      ))}

      <button
        type="button"
        onClick={() => {
          setRoutes((prev) => [...prev, emptyRoute()]);
          setIsDirty(true);
        }}
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-900 hover:underline"
      >
        <PlusIcon className="h-4 w-4" /> Agregar otra ruta
      </button>

      <SaveBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} />
    </div>
  );
}
