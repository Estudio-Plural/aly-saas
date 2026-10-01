"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SaveBar } from "@/components/save-bar";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { uid } from "@/lib/utils";
import { nextAfterDesignStep, type HelpRoute } from "@/lib/design";
import { useDesignSave } from "@/lib/use-design-save";

const FIELDS: {
  key: keyof Omit<HelpRoute, "id">;
  label: string;
  placeholder: string;
  help?: string;
  wide?: boolean;
}[] = [
  { key: "name", label: "Nombre", placeholder: "Ej.: Línea 106" },
  { key: "contact", label: "Teléfono o canal", placeholder: "Ej.: 106 o WhatsApp 300 000 0000" },
  { key: "hours", label: "Horario", placeholder: "Ej.: 24 horas" },
  {
    key: "territory",
    label: "Dónde aplica",
    placeholder: "Ej.: Bogotá",
    help: "Déjalo vacío si aplica en todos los territorios.",
  },
  {
    key: "when",
    label: "Cuándo usarla",
    placeholder: "Ej.: Crisis emocional o ideas de hacerse daño",
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
  assistantName,
  initial,
  next: nextProp,
}: {
  workspaceSlug: string;
  assistantName: string;
  initial: HelpRoute[] | null;
  /** Siguiente paso según el progreso real (lo calcula la página). */
  next?: { label: string; path: string };
}) {
  const assistant = assistantName.trim() || "tu asistente";
  const [routes, setRoutes] = useState<HelpRoute[]>(initial ?? []);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(initial !== null);
  // Rutas a las que les falta nombre o teléfono al intentar guardar.
  const [incomplete, setIncomplete] = useState<Set<string>>(new Set());
  const { save, isSaving } = useDesignSave(workspaceSlug);
  const next = nextProp ?? nextAfterDesignStep("routes");

  const setField = (id: string, key: keyof HelpRoute, value: string) => {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setIsDirty(true);
  };

  const addRoute = () => {
    setRoutes((prev) => [...prev, emptyRoute()]);
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
    const missing = new Set(
      toSave.filter((route) => !route.name || !route.contact).map((route) => route.id)
    );
    setIncomplete(missing);
    if (missing.size) return;
    const ok = await save({ help_routes: toSave }, "Rutas de ayuda guardadas");
    if (ok) {
      setRoutes(toSave);
      setIsDirty(false);
      setSaved(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Rutas de ayuda</h1>
        <p className="mt-1 text-neutral-600">
          Las líneas y servicios a los que {assistant} puede derivar cuando alguien necesita más
          apoyo. Solo da las rutas que pongas aquí.
        </p>
      </div>

      {routes.length === 0 ? (
        <Card className="border-dashed border-neutral-300 p-6 text-center shadow-none">
          <p className="mx-auto max-w-lg text-sm text-neutral-700">
            Todavía no hay rutas de ayuda. Mientras no agregues una, {assistant} le pide a la
            persona buscar ayuda en su territorio, sin inventar números.
          </p>
          <Button onClick={addRoute} variant="outline" className="mt-4">
            <PlusIcon className="mr-1.5 h-4 w-4" /> Agregar una ruta de ayuda
          </Button>
        </Card>
      ) : (
        <>
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
                {FIELDS.map((field) => {
                  const missing =
                    incomplete.has(route.id) &&
                    (field.key === "name" || field.key === "contact") &&
                    !route[field.key].trim();
                  return (
                    <div
                      key={field.key}
                      className={`space-y-1.5 ${field.wide ? "sm:col-span-2" : ""}`}
                    >
                      <Label htmlFor={`${route.id}-${field.key}`} className="text-sm">
                        {field.label}
                      </Label>
                      <Input
                        id={`${route.id}-${field.key}`}
                        value={route[field.key]}
                        placeholder={field.placeholder}
                        maxLength={field.key === "when" ? 500 : 200}
                        aria-invalid={missing || undefined}
                        aria-describedby={field.help ? `${route.id}-${field.key}-help` : undefined}
                        onChange={(e) => setField(route.id, field.key, e.target.value)}
                        className="bg-white placeholder:italic"
                      />
                      {field.help && (
                        <p
                          id={`${route.id}-${field.key}-help`}
                          className="text-xs text-neutral-500"
                        >
                          {field.help}
                        </p>
                      )}
                      {missing && (
                        <p className="text-xs text-red-700">
                          {field.key === "name"
                            ? "Escribe el nombre."
                            : "Escribe el teléfono o canal."}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          <button
            type="button"
            onClick={addRoute}
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-900 hover:underline"
          >
            <PlusIcon className="h-4 w-4" /> Agregar otra ruta
          </button>
        </>
      )}

      {(routes.length > 0 || isDirty || saved) && (
        <SaveBar
          isDirty={isDirty}
          isSaving={isSaving}
          onSave={handleSave}
          saved={saved}
          next={{ label: next.label, href: `/${workspaceSlug}/${next.path}` }}
        />
      )}
    </div>
  );
}
