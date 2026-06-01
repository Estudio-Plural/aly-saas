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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SaveIcon, TrashIcon } from "lucide-react";

// Mock data - después se reemplaza con query real a Supabase
const MOCK_WORKSPACE = {
  id: "1",
  slug: "demo",
  name: "Demo Workspace",
  assistant_name: "Aly",
  subscription_status: "trial",
  created_at: "2026-06-01",
};

export default function SettingsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const [workspace, setWorkspace] = useState(MOCK_WORKSPACE);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implementar guardado real con Supabase
    console.log("Saving workspace:", workspace);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simular delay
    setIsSaving(false);
  };

  const handleDelete = () => {
    // TODO: Implementar borrado con confirmación
    if (confirm("¿Estás seguro de eliminar este workspace? Esta acción no se puede deshacer.")) {
      console.log("Deleting workspace:", params.workspace);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Configuración General
        </h1>
        <p className="text-neutral-700 mt-1">
          Gestioná los datos básicos de tu asistente
        </p>
      </div>

      {/* Información del Workspace */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Workspace</CardTitle>
          <CardDescription>
            El nombre y slug identifican tu workspace en la plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Workspace</Label>
            <Input
              id="name"
              value={workspace.name}
              onChange={(e) =>
                setWorkspace({ ...workspace, name: e.target.value })
              }
              placeholder="Mi Empresa"
            />
            <p className="text-xs text-neutral-500">
              Este nombre se muestra en el dashboard y notificaciones
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              value={workspace.slug}
              onChange={(e) =>
                setWorkspace({
                  ...workspace,
                  slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                })
              }
              placeholder="mi-empresa"
            />
            <p className="text-xs text-neutral-500">
              URL: app.aly.com/{workspace.slug}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuración del Asistente */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración del Asistente</CardTitle>
          <CardDescription>
            Personalizá cómo se presenta tu asistente de IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assistant_name">Nombre del Asistente</Label>
            <Input
              id="assistant_name"
              value={workspace.assistant_name}
              onChange={(e) =>
                setWorkspace({ ...workspace, assistant_name: e.target.value })
              }
              placeholder="Aly"
            />
            <p className="text-xs text-neutral-500">
              Este nombre aparece en las respuestas del bot y en el chat
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">
                  {workspace.assistant_name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-neutral-900 mb-1">
                  {workspace.assistant_name}
                </div>
                <div className="text-sm text-neutral-700">
                  ¡Hola! Soy {workspace.assistant_name}, tu asistente de IA. ¿En qué
                  puedo ayudarte hoy?
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suscripción */}
      <Card>
        <CardHeader>
          <CardTitle>Suscripción</CardTitle>
          <CardDescription>Información sobre tu plan actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Plan Actual</div>
              <div className="text-sm text-neutral-600 mt-1">
                {workspace.subscription_status === "trial"
                  ? "Trial (14 días restantes)"
                  : workspace.subscription_status === "active"
                  ? "Pro - $49/mes"
                  : "Free"}
              </div>
            </div>
            <Button variant="outline">Mejorar Plan</Button>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleDelete}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <TrashIcon className="mr-2 h-4 w-4" />
          Eliminar Workspace
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <SaveIcon className="mr-2 h-4 w-4" />
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      <Separator className="my-8" />

      {/* Info adicional */}
      <div className="text-sm text-neutral-500">
        <p>Workspace ID: {workspace.id}</p>
        <p>Creado el: {new Date(workspace.created_at).toLocaleDateString("es-AR")}</p>
      </div>
    </div>
  );
}
