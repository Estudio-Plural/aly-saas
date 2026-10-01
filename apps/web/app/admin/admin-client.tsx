"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrgDetalle } from "@/lib/data/orgs";

const normalizar = (texto: string) =>
  texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

async function llamar(url: string, method: string, body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "No se pudo guardar");
      return false;
    }
    return true;
  } catch {
    toast.error("Error de conexión");
    return false;
  }
}

type Portal = { url: string; sincronizado: boolean } | null;

/**
 * Admin mínimo del equipo Plural: organizaciones, quién entra y de quién es cada asistente.
 * Con `portal`, las organizaciones y quién entra vienen del portal de Plural IA: acá solo
 * se cambia el rol y de qué organización es cada asistente.
 */
export function AdminClient({
  initialOrgs,
  portal,
}: {
  initialOrgs: OrgDetalle[];
  portal: Portal;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const orgs = initialOrgs;
  const q = normalizar(busqueda);
  // Filtra en el navegador la lista que ya llegó (solo equipo Plural).
  const visibles = q
    ? orgs.filter(
        (o) =>
          normalizar(o.nombre).includes(q) ||
          o.miembros.some((m) => normalizar(m.email).includes(q))
      )
    : orgs;

  const crearOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreando(true);
    if (await llamar("/api/admin/orgs", "POST", { nombre })) {
      toast.success(`Creada: ${nombre.trim()}`);
      setNombre("");
      router.refresh();
    }
    setCreando(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Organizaciones</h1>
        <p className="mt-2 text-neutral-600">
          Quién entra a cada organización y de qué organización es cada asistente. El equipo de
          Plural entra siempre y ve todo.
        </p>
      </div>

      {portal ? (
        <Card className="p-5 space-y-1 text-sm text-neutral-700">
          <p>
            Las organizaciones y quién entra se administran en el{" "}
            <a href={portal.url} className="underline underline-offset-2">
              portal de Plural IA
            </a>
            : crea la organización, contrátale Conversacional y agrega a las personas allá. Aparecen acá solas.
          </p>
          {!portal.sincronizado && (
            <p className="text-amber-700">
              El portal no respondió: esta lista puede estar desactualizada. Recarga en un minuto.
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <form onSubmit={crearOrg} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-60 space-y-2">
              <Label htmlFor="org-nombre">Nueva organización</Label>
              <Input
                id="org-nombre"
                placeholder="Fundación Ejemplo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={120}
              />
            </div>
            <Button type="submit" disabled={creando || nombre.trim().length < 2}>
              {creando ? "Creando..." : "Crear organización"}
            </Button>
          </form>
        </Card>
      )}

      <div className="max-w-md">
        <Label htmlFor="buscar-org" className="sr-only">
          Buscar
        </Label>
        <Input
          id="buscar-org"
          type="search"
          placeholder="Busca una organización o un correo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="h-10 bg-white"
        />
      </div>

      {visibles.length === 0 && q && (
        <p className="text-sm text-neutral-600">Nada coincide con «{busqueda.trim()}».</p>
      )}

      {visibles.map((org) => (
        <OrgCard
          key={org.id}
          org={org}
          orgs={orgs}
          delPortal={portal !== null}
          onChange={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function OrgCard({
  org,
  orgs,
  delPortal,
  onChange,
}: {
  org: OrgDetalle;
  orgs: OrgDetalle[];
  delPortal: boolean;
  onChange: () => void;
}) {
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"miembro" | "admin">("miembro");
  const base = `/api/admin/orgs/${encodeURIComponent(org.id)}/members`;

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await llamar(base, "POST", { email, rol })) {
      toast.success(`${email.trim()} ya puede entrar a ${org.nombre}`);
      setEmail("");
      onChange();
    }
  };

  const quitar = async (correo: string) => {
    if (await llamar(`${base}?email=${encodeURIComponent(correo)}`, "DELETE")) {
      toast.success(`${correo} ya no entra a ${org.nombre}`);
      onChange();
    }
  };

  const cambiarRol = async (correo: string, nuevo: "miembro" | "admin") => {
    if (await llamar(base, "PATCH", { email: correo, rol: nuevo })) {
      toast.success(
        nuevo === "admin" ? `${correo} ahora administra` : `${correo} ahora es miembro`
      );
      onChange();
    }
  };

  const mover = async (workspaceId: string, destino: string) => {
    if (await llamar(`/api/admin/workspaces/${workspaceId}`, "PATCH", { org_id: destino })) {
      toast.success("Asistente movido");
      onChange();
    }
  };

  // Mover un asistente cambia quién lo ve: se confirma antes. Cancelar deja el select como estaba
  // (el select es controlado por org.id, así que basta con no llamar a la API).
  const [moviendo, setMoviendo] = useState<{ id: string; nombre: string; destino: string } | null>(
    null
  );
  const nombreDe = (id: string) => orgs.find((o) => o.id === id)?.nombre ?? id;

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900" title={org.id}>
          {org.nombre}
        </h2>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-700">Quién entra</h3>
        {org.miembros.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Nadie todavía (solo el equipo de Plural).
            {delPortal && " Agrega a las personas en el portal."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {org.miembros.map((m) => (
              <li key={m.email} className="flex items-center justify-between py-2 text-sm">
                {delPortal ? (
                  <>
                    <span>{m.email}</span>
                    <span className="flex items-center gap-2">
                      <Label htmlFor={`rol-${org.id}-${m.email}`} className="sr-only">
                        Rol de {m.email}
                      </Label>
                      <select
                        id={`rol-${org.id}-${m.email}`}
                        value={m.rol}
                        onChange={(e) => cambiarRol(m.email, e.target.value as "miembro" | "admin")}
                        className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-sm"
                      >
                        <option value="miembro">Miembro</option>
                        <option value="admin">Administra (puede borrar asistentes)</option>
                      </select>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {m.email}{" "}
                      <span className="text-neutral-500">
                        · {m.rol === "admin" ? "administra" : "miembro"}
                      </span>
                    </span>
                    <ConfirmDialog
                      title={`¿Quitar a ${m.email}?`}
                      description={`Ya no va a poder entrar a los asistentes de ${org.nombre}.`}
                      confirmLabel="Quitar"
                      onConfirm={() => quitar(m.email)}
                    >
                      <Button variant="ghost" size="sm">
                        Quitar
                      </Button>
                    </ConfirmDialog>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {!delPortal && (
          <form onSubmit={agregar} className="flex flex-wrap items-center gap-2 pt-1">
            <Label htmlFor={`email-${org.id}`} className="sr-only">
              Correo
            </Label>
            <Input
              id={`email-${org.id}`}
              type="email"
              placeholder="persona@organizacion.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-56"
            />
            <Label htmlFor={`rol-${org.id}`} className="sr-only">
              Rol
            </Label>
            <select
              id={`rol-${org.id}`}
              value={rol}
              onChange={(e) => setRol(e.target.value as "miembro" | "admin")}
              className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="miembro">Miembro</option>
              <option value="admin">Administra</option>
            </select>
            <Button type="submit" variant="outline" size="sm" disabled={!email.includes("@")}>
              Agregar
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-700">Asistentes</h3>
        {org.programas.length === 0 ? (
          <p className="text-sm text-neutral-600">Todavía no tiene asistentes.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {org.programas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a href={`/${p.slug}`} className="underline underline-offset-2">
                  {p.name}
                </a>
                <span className="flex items-center gap-2">
                  <Label htmlFor={`mover-${p.id}`} className="text-neutral-500 font-normal">
                    Es de
                  </Label>
                  <select
                    id={`mover-${p.id}`}
                    value={org.id}
                    onChange={(e) => {
                      if (e.target.value !== org.id)
                        setMoviendo({ id: p.id, nombre: p.name, destino: e.target.value });
                    }}
                    className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-sm"
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={moviendo !== null} onOpenChange={(open) => !open && setMoviendo(null)}>
        <DialogContent>
          {moviendo && (
            <>
              <DialogHeader>
                <DialogTitle>
                  ¿Mover «{moviendo.nombre}» a {nombreDe(moviendo.destino)}?
                </DialogTitle>
                <DialogDescription>
                  Las personas de {org.nombre} dejarán de verlo y las de{" "}
                  {nombreDe(moviendo.destino)} podrán verlo y editarlo.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMoviendo(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const m = moviendo;
                    setMoviendo(null);
                    void mover(m.id, m.destino);
                  }}
                >
                  Mover
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
