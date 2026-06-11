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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon, BotIcon, UsersIcon, FileTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify, type Workspace } from "@/lib/workspaces";

export function DashboardClient({
  initialWorkspaces,
}: {
  initialWorkspaces: Workspace[];
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    slug: "",
    assistant_name: "Aly",
  });

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name.trim()) {
      toast.error("Poné un nombre para tu asistente");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorkspace.name.trim(),
          slug: newWorkspace.slug,
          assistant_name: newWorkspace.assistant_name.trim() || "Aly",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear el asistente");
        return;
      }
      setWorkspaces((prev) => [...prev, data.workspace]);
      setIsCreateOpen(false);
      setNewWorkspace({ name: "", slug: "", assistant_name: "Aly" });
      toast.success(`Asistente "${data.workspace.name}" creado`);
      router.refresh();
    } catch {
      toast.error("Error de conexión al crear el asistente");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenWorkspace = (slug: string) => {
    router.push(`/${slug}/settings`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
            Tus Asistentes
          </h1>
          <p className="text-neutral-600 mt-2 text-lg">
            Seleccioná un workspace para gestionar tu asistente de IA
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="h-12 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:scale-105"
            >
              <PlusIcon className="mr-2 h-5 w-5" />
              Crear Asistente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Asistente</DialogTitle>
              <DialogDescription>
                Configurá tu asistente de IA personalizado con tu propio conocimiento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Workspace</Label>
                <Input
                  id="name"
                  placeholder="Mi Empresa"
                  value={newWorkspace.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setNewWorkspace({
                      ...newWorkspace,
                      name: newName,
                      slug: slugify(newName),
                    });
                  }}
                />
              </div>

              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-xs font-medium text-neutral-600 mb-1">URL del workspace</p>
                <p className="text-sm font-mono text-neutral-900">
                  app.aly.com/<span className="font-semibold text-blue-600">{newWorkspace.slug || "tu-workspace"}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assistant_name">Nombre del Asistente</Label>
                <Input
                  id="assistant_name"
                  placeholder="Aly"
                  value={newWorkspace.assistant_name}
                  onChange={(e) =>
                    setNewWorkspace({ ...newWorkspace, assistant_name: e.target.value })
                  }
                />
                <p className="text-xs text-neutral-500">
                  Cómo se presenta el bot en las conversaciones
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateWorkspace} disabled={isCreating}>
                {isCreating ? "Creando..." : "Crear Asistente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workspaces Grid */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <Card
            key={workspace.id}
            className="cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-blue-400/50 p-8 group relative overflow-hidden"
            onClick={() => handleOpenWorkspace(workspace.slug)}
          >
            <CardHeader className="p-0 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                    <BotIcon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-neutral-900 mb-1">
                      {workspace.name}
                    </CardTitle>
                    <CardDescription className="text-base text-neutral-600">
                      {workspace.assistant_name}
                    </CardDescription>
                  </div>
                </div>
                <div
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    workspace.subscription_status === "active"
                      ? "bg-green-100 text-green-700"
                      : workspace.subscription_status === "trial"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {workspace.subscription_status === "active"
                    ? "Activo"
                    : workspace.subscription_status === "trial"
                    ? "Trial"
                    : "Cancelado"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-3 gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <FileTextIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-2xl font-bold text-neutral-900">
                    {workspace.stats.documents}
                  </span>
                  <span className="text-sm text-neutral-600">Docs</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-violet-50 flex items-center justify-center">
                    <UsersIcon className="h-5 w-5 text-violet-600" />
                  </div>
                  <span className="text-2xl font-bold text-neutral-900">
                    {workspace.stats.users}
                  </span>
                  <span className="text-sm text-neutral-600">Usuarios</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                    <BotIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className="text-2xl font-bold text-neutral-900">
                    {workspace.stats.conversations}
                  </span>
                  <span className="text-sm text-neutral-600">Chats</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {workspaces.length === 0 && (
        <div className="text-center py-16">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <BotIcon className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-neutral-900 mb-3">
            No tenés asistentes todavía
          </h3>
          <p className="text-neutral-600 mb-6 text-lg">
            Creá tu primer asistente de IA para empezar
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="lg"
            className="h-12 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:scale-105"
          >
            <PlusIcon className="mr-2 h-5 w-5" />
            Crear Mi Primer Asistente
          </Button>
        </div>
      )}
    </div>
  );
}
