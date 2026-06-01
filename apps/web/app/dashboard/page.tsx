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

// Mock data - después se reemplaza con query real a Supabase
const MOCK_WORKSPACES = [
  {
    id: "1",
    slug: "demo",
    name: "Demo Workspace",
    assistant_name: "Aly",
    subscription_status: "trial",
    created_at: "2026-06-01",
    stats: {
      documents: 5,
      conversations: 120,
      users: 8,
    },
  },
  {
    id: "2",
    slug: "apapachar",
    name: "Apapáchar",
    assistant_name: "Aly",
    subscription_status: "active",
    created_at: "2026-03-15",
    stats: {
      documents: 12,
      conversations: 450,
      users: 35,
    },
  },
];

export default function DashboardPage() {
  const [workspaces] = useState(MOCK_WORKSPACES);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    slug: "",
    assistant_name: "Aly",
  });

  const handleCreateWorkspace = () => {
    // TODO: Implementar creación real con Supabase
    console.log("Creating workspace:", newWorkspace);
    setIsCreateOpen(false);
    setNewWorkspace({ name: "", slug: "", assistant_name: "Aly" });
  };

  const handleOpenWorkspace = (slug: string) => {
    // TODO: Navegar a /[workspace]/settings
    console.log("Opening workspace:", slug);
    window.location.href = `/${slug}/settings`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Mis Asistentes
          </h1>
          <p className="text-neutral-700 mt-1">
            Seleccioná un workspace para gestionar tu asistente de IA
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <PlusIcon className="mr-2 h-4 w-4" />
              Nuevo Asistente
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
                  onChange={(e) =>
                    setNewWorkspace({ ...newWorkspace, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  placeholder="mi-empresa"
                  value={newWorkspace.slug}
                  onChange={(e) =>
                    setNewWorkspace({
                      ...newWorkspace,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                />
                <p className="text-xs text-neutral-500">
                  URL: app.aly.com/{newWorkspace.slug || "tu-workspace"}
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
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateWorkspace}>Crear Asistente</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workspaces Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <Card
            key={workspace.id}
            className="cursor-pointer transition-all hover:shadow-lg hover:border-blue-400"
            onClick={() => handleOpenWorkspace(workspace.slug)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                    <BotIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-neutral-900">
                      {workspace.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-neutral-600">
                      {workspace.assistant_name}
                    </CardDescription>
                  </div>
                </div>
                <div
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
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
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col items-center gap-1">
                  <FileTextIcon className="h-4 w-4 text-neutral-600" />
                  <span className="font-semibold text-neutral-900">
                    {workspace.stats.documents}
                  </span>
                  <span className="text-xs text-neutral-600">Docs</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <UsersIcon className="h-4 w-4 text-neutral-600" />
                  <span className="font-semibold text-neutral-900">
                    {workspace.stats.users}
                  </span>
                  <span className="text-xs text-neutral-600">Usuarios</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <BotIcon className="h-4 w-4 text-neutral-600" />
                  <span className="font-semibold text-neutral-900">
                    {workspace.stats.conversations}
                  </span>
                  <span className="text-xs text-neutral-600">Chats</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {workspaces.length === 0 && (
        <div className="text-center py-12">
          <BotIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            No tenés asistentes todavía
          </h3>
          <p className="text-neutral-600 mb-4">
            Creá tu primer asistente de IA para empezar
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Crear Mi Primer Asistente
          </Button>
        </div>
      )}
    </div>
  );
}
