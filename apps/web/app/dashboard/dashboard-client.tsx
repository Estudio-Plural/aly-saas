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
import type { Workspace } from "@/lib/workspaces";

export function DashboardClient({
  initialWorkspaces,
  orgs,
  selectedOrg,
  isPlural,
}: {
  initialWorkspaces: Workspace[];
  /** Organizaciones visibles (el equipo Plural ve todas). */
  orgs: { id: string; nombre: string }[];
  /** Filtro activo (?org=); null = todas. */
  selectedOrg: string | null;
  isPlural: boolean;
}) {
  const router = useRouter();
  // Organización del programa nuevo: la filtrada, o la primera visible.
  const [newOrg, setNewOrg] = useState(selectedOrg ?? orgs[0]?.id ?? "");
  const showOrgPicker = orgs.length > 1;
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // Crear programa: dos campos. La dirección (slug) se genera sola.
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    assistant_name: "",
  });

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name.trim()) {
      toast.error("Escribe el nombre del programa");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorkspace.name.trim(),
          assistant_name: newWorkspace.assistant_name.trim() || "Aly",
          org_id: newOrg || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear el programa");
        return;
      }
      setWorkspaces((prev) => [...prev, data.workspace]);
      setIsCreateOpen(false);
      setNewWorkspace({ name: "", assistant_name: "" });
      // Se aterriza en Primeros pasos.
      router.push(`/${data.workspace.slug}`);
    } catch {
      toast.error("Error de conexión al crear el programa");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenWorkspace = (slug: string) => {
    router.push(`/${slug}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
            Tus programas
          </h1>
          <p className="text-neutral-600 mt-2 text-lg">
            Elige un programa para diseñarlo, probarlo u operarlo
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="h-12 px-6 bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm transition-colors"
            >
              <PlusIcon className="mr-2 h-5 w-5" />
              Crear programa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear programa</DialogTitle>
              <DialogDescription>
                Después te guiamos paso a paso para diseñarlo, probarlo y conectarlo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del programa</Label>
                <Input
                  id="name"
                  placeholder="Ej: Cuidar a quien cuida"
                  value={newWorkspace.name}
                  onChange={(e) =>
                    setNewWorkspace({ ...newWorkspace, name: e.target.value })
                  }
                />
              </div>
              {showOrgPicker && (
                <div className="space-y-2">
                  <Label htmlFor="new-org">Organización</Label>
                  <select
                    id="new-org"
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="assistant_name">Nombre del asistente</Label>
                <Input
                  id="assistant_name"
                  placeholder="Ej: Aly"
                  value={newWorkspace.assistant_name}
                  onChange={(e) =>
                    setNewWorkspace({ ...newWorkspace, assistant_name: e.target.value })
                  }
                />
                <p className="text-xs text-neutral-600">
                  Así se presenta en WhatsApp. Si lo dejas vacío, se llama Aly.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateWorkspace} disabled={isCreating}>
                {isCreating ? "Creando…" : "Crear programa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {showOrgPicker && (
        <div className="flex items-center gap-3">
          <Label htmlFor="org-filter" className="text-sm text-neutral-700">
            Organización
          </Label>
          <select
            id="org-filter"
            value={selectedOrg ?? ""}
            onChange={(e) =>
              router.push(e.target.value ? `/dashboard?org=${e.target.value}` : "/dashboard")
            }
            className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="">Todas</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          {isPlural && (
            <a href="/admin" className="text-sm text-neutral-600 underline underline-offset-2">
              Administrar organizaciones
            </a>
          )}
        </div>
      )}

      {/* Workspaces Grid */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <Card
            key={workspace.id}
            className="cursor-pointer transition-all duration-300 hover:shadow-md hover:border-neutral-300 p-8 group relative overflow-hidden"
            onClick={() => handleOpenWorkspace(workspace.slug)}
          >
            <CardHeader className="p-0 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-neutral-900 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                    <BotIcon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-neutral-900 mb-1">
                      {workspace.name}
                    </CardTitle>
                    <CardDescription className="text-base text-neutral-600">
                      {workspace.assistant_name}
                      {showOrgPicker && !selectedOrg ? ` · ${workspace.org_name}` : ""}
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
                  <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <FileTextIcon className="h-5 w-5 text-neutral-600" />
                  </div>
                  <span className="text-2xl font-bold text-neutral-900">
                    {workspace.stats.documents}
                  </span>
                  <span className="text-sm text-neutral-600">Docs</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <UsersIcon className="h-5 w-5 text-neutral-600" />
                  </div>
                  <span className="text-2xl font-bold text-neutral-900">
                    {workspace.stats.users}
                  </span>
                  <span className="text-sm text-neutral-600">Usuarios</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <BotIcon className="h-5 w-5 text-neutral-600" />
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
          <div className="h-20 w-20 rounded-full bg-neutral-900 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <BotIcon className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-neutral-900 mb-3">
            Todavía no tienes programas
          </h3>
          <p className="text-neutral-600 mb-6 text-lg">
            Crea tu primer programa para empezar
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="lg"
            className="h-12 px-6 bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm transition-colors"
          >
            <PlusIcon className="mr-2 h-5 w-5" />
            Crear mi primer programa
          </Button>
        </div>
      )}
    </div>
  );
}
