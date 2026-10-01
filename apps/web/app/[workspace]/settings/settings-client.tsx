"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import type { Workspace } from "@/lib/workspaces";

export function SettingsClient({
  initialWorkspace,
  puedeAdministrar,
  whatsappConectado,
}: {
  initialWorkspace: Workspace;
  /** Admin de la organización o equipo Plural: puede eliminar y crear asistentes. */
  puedeAdministrar: boolean;
  /** Con WhatsApp conectado, para eliminar hay que escribir el nombre del asistente. */
  whatsappConectado: boolean;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [saved, setSaved] = useState(initialWorkspace);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    workspace.name !== saved.name || workspace.assistant_name !== saved.assistant_name;

  const updateField = (fields: Partial<Pick<Workspace, "name" | "assistant_name">>) => {
    setWorkspace((prev) => ({ ...prev, ...fields }));
  };

  const handleSave = async () => {
    if (!workspace.name.trim() || !workspace.assistant_name.trim()) {
      toast.error("El nombre del asistente y el del programa no pueden quedar vacíos");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${saved.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspace.name.trim(),
          // El schema exige el slug: se manda el actual, sin cambios (la dirección no se toca).
          slug: saved.slug,
          assistant_name: workspace.assistant_name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudieron guardar los cambios");
        return;
      }
      setWorkspace(data.workspace);
      setSaved(data.workspace);
      toast.success("Cambios guardados");
      if (data.workspace.slug !== saved.slug) {
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

  const handleDelete = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/workspaces/${saved.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo eliminar el asistente");
        return false;
      }
      toast.success(`Eliminaste a ${saved.assistant_name}`);
      router.push("/dashboard");
      router.refresh();
      return true;
    } catch {
      toast.error("Error de conexión al eliminar");
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Ajustes</h1>
          <p className="text-neutral-600 mt-1">
            El nombre de {saved.assistant_name} y el de tu programa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && <span className="text-xs text-neutral-600">Cambios sin guardar</span>}
          <Button onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? "Guardando…" : isDirty ? "Guardar cambios" : "Guardado"}
          </Button>
        </div>
      </div>

      <Card className="border-neutral-200">
        <CardHeader>
          <CardTitle className="text-lg">Nombres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="assistant_name">Nombre del asistente</Label>
            <Input
              id="assistant_name"
              value={workspace.assistant_name}
              onChange={(e) => updateField({ assistant_name: e.target.value })}
              placeholder="Ej: Sofía"
              maxLength={100}
              className="h-11"
            />
            <p className="text-xs text-neutral-600">
              Así se presenta en WhatsApp. Su saludo lo cambias en{" "}
              <Link href={`/${saved.slug}/bienvenida`} className="underline">
                Bienvenida y consentimiento
              </Link>
              .
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre del programa</Label>
            <Input
              id="name"
              value={workspace.name}
              onChange={(e) => updateField({ name: e.target.value })}
              placeholder="Ej: Cuidar a quien cuida"
              maxLength={100}
              className="h-11"
            />
            <p className="text-xs text-neutral-600">
              Así aparece en tu lista y en los correos del resumen semanal.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-neutral-600">
        Tu programa lo acompaña Estudio Plural. Para cambios en tu contrato, escríbenos a{" "}
        <a href="mailto:hola@estudio-plural.co" className="underline">
          hola@estudio-plural.co
        </a>
        .
      </p>

      {puedeAdministrar && (
        <>
          <div>
            <Button asChild variant="outline">
              <Link href="/dashboard?nuevo=1">
                <PlusIcon className="mr-2 h-4 w-4" />
                Crear otro asistente
              </Link>
            </Button>
          </div>

          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg">Eliminar este asistente</CardTitle>
              <CardDescription>
                Se borran el diseño, el material y todas las conversaciones. No se puede deshacer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteDialog
                assistantName={saved.assistant_name}
                requireTypedName={whatsappConectado}
                onConfirm={handleDelete}
              />
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-neutral-500">
        Creado el{" "}
        {new Date(saved.created_at).toLocaleDateString("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

/**
 * Confirmación para eliminar. Si el asistente ya atiende personas por WhatsApp, hay que
 * escribir su nombre: así nadie lo borra con un clic distraído.
 */
function DeleteDialog({
  assistantName,
  requireTypedName,
  onConfirm,
}: {
  assistantName: string;
  requireTypedName: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const matches = typed.trim().toLocaleLowerCase("es") === assistantName.trim().toLocaleLowerCase("es");
  const canConfirm = !isDeleting && (!requireTypedName || matches);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <TrashIcon className="mr-2 h-4 w-4" />
          Eliminar asistente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar a {assistantName}?</DialogTitle>
          <DialogDescription>
            Se borran el diseño, el material y todas las conversaciones. No se puede deshacer.
            {requireTypedName &&
              ` ${assistantName} está conectado a WhatsApp: las personas que le escriban dejarán de recibir respuesta.`}
          </DialogDescription>
        </DialogHeader>
        {requireTypedName && (
          <div className="space-y-2">
            <Label htmlFor="confirmar-nombre">
              Para confirmar, escribe <strong>{assistantName}</strong>
            </Label>
            <Input
              id="confirmar-nombre"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={async () => {
              setIsDeleting(true);
              const ok = await onConfirm();
              setIsDeleting(false);
              if (ok) setOpen(false);
            }}
          >
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
