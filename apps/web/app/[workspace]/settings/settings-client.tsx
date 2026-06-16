"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SaveIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { slugify, type Workspace } from "@/lib/workspaces";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SettingsClient({
  initialWorkspace,
}: {
  initialWorkspace: Workspace;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [savedSlug, setSavedSlug] = useState(initialWorkspace.slug);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const updateField = (fields: Partial<Workspace>) => {
    setWorkspace((prev) => ({ ...prev, ...fields }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!workspace.name.trim() || !workspace.assistant_name.trim()) {
      toast.error("El nombre del workspace y del asistente no pueden estar vacíos");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${savedSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspace.name.trim(),
          slug: workspace.slug,
          assistant_name: workspace.assistant_name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudieron guardar los cambios");
        return;
      }
      setWorkspace(data.workspace);
      setIsDirty(false);
      toast.success("Cambios guardados");
      if (data.workspace.slug !== savedSlug) {
        setSavedSlug(data.workspace.slug);
        router.replace(`/${data.workspace.slug}/settings`);
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/workspaces/${savedSlug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "No se pudo eliminar el workspace");
        return;
      }
      toast.success(`Workspace "${workspace.name}" eliminado`);
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Error de conexión al eliminar");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Configuración General
          </h1>
          <p className="text-neutral-600 mt-1">
            Gestioná los datos básicos de tu asistente
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

      <div className="space-y-6">
          {/* Información del Workspace */}
          <Card className="border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-xl">Información del Workspace</CardTitle>
              <CardDescription className="text-base">
                El nombre y slug identifican tu workspace en la plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-sm font-medium text-neutral-900">
                  Nombre del Workspace
                </Label>
                <Input
                  id="name"
                  value={workspace.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    updateField({ name: newName, slug: slugify(newName) });
                  }}
                  placeholder="Mi Empresa"
                  className="h-11 border-neutral-300 focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
                />
                <p className="text-xs text-neutral-600">
                  Este nombre se muestra en el dashboard y notificaciones
                </p>
              </div>

              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4">
                <p className="text-xs font-medium text-neutral-600 mb-1">URL de tu workspace</p>
                <p className="text-sm font-mono text-neutral-900">
                  app.plural.com/<span className="font-semibold text-neutral-900">{workspace.slug}</span>
                </p>
                <p className="text-xs text-neutral-600 mt-2">
                  Se genera automáticamente desde el nombre
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Configuración del Asistente */}
          <Card className="border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-xl">Configuración del Asistente</CardTitle>
              <CardDescription className="text-base">
                Personalizá cómo se presenta tu asistente de IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="assistant_name" className="text-sm font-medium text-neutral-900">
                  Nombre del Asistente
                </Label>
                <Input
                  id="assistant_name"
                  value={workspace.assistant_name}
                  onChange={(e) => updateField({ assistant_name: e.target.value })}
                  placeholder="Aly"
                  className="h-11 border-neutral-300 focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
                />
                <p className="text-xs text-neutral-600">
                  Este nombre aparece en las respuestas del bot y en el chat
                </p>
              </div>

              {/* Preview Card with Gradient Border */}
              <div className="relative p-px rounded-xl bg-neutral-200">
                <div className="bg-white rounded-xl p-6">
                  <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide mb-4">
                    Vista Previa
                  </p>
                  <div className="space-y-4">
                    {/* User Message */}
                    <div className="flex justify-end">
                      <div className="rounded-2xl bg-neutral-900 px-5 py-3 max-w-[80%] shadow-md">
                        <p className="text-white text-sm">
                          Hola
                        </p>
                      </div>
                    </div>
                    {/* Assistant Response */}
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0 shadow-md">
                        <span className="text-white font-semibold text-sm">
                          {workspace.assistant_name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-neutral-600 mb-2">
                          {workspace.assistant_name}
                        </div>
                        <div className="rounded-2xl bg-neutral-100 px-5 py-3 max-w-[90%]">
                          <p className="text-neutral-900 text-sm">
                            ¡Hola! Soy {workspace.assistant_name}, tu asistente de IA. ¿En qué puedo ayudarte hoy?
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suscripción */}
          <Card className="border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-xl">Suscripción</CardTitle>
              <CardDescription className="text-base">Información sobre tu plan actual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-neutral-900">Plan Actual</div>
                    {workspace.subscription_status === "trial" && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-900 text-white shadow-sm">
                        Trial
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-600">
                    {workspace.subscription_status === "trial"
                      ? "14 días restantes"
                      : workspace.subscription_status === "active"
                      ? "Pro - $49/mes"
                      : "Free"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="h-11 px-6 border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                  Mejorar Plan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 shadow-sm">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-xl text-red-600">Zona de Peligro</CardTitle>
              <CardDescription className="text-base">
                Acciones irreversibles para tu workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmDialog
                title="¿Eliminar workspace?"
                description={`Vas a eliminar "${workspace.name}" con sus documentos y conversaciones. Esta acción no se puede deshacer.`}
                confirmLabel="Eliminar"
                onConfirm={handleDelete}
              >
                <Button
                  variant="outline"
                  className="h-11 px-6 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 transition-colors"
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Eliminar Workspace
                </Button>
              </ConfirmDialog>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Info adicional */}
          <div className="text-sm text-neutral-600">
            <p>Creado el {new Date(workspace.created_at).toLocaleDateString("es-AR")}</p>
          </div>
        </div>
    </div>
  );
}
