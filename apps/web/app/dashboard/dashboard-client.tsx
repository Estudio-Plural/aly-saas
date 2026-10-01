"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon, PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DESIGN_STEPS, isDesignDone, nextStepPath, type ProgramProgress } from "@/lib/design";
import type { Workspace } from "@/lib/workspaces";

/** Organización del equipo para los asistentes de prueba (migración 011). */
const ORG_DEMO = "plural-demo";

type Item = { ws: Workspace; progress: ProgramProgress };
type Grupo = { orgId: string; orgName: string; items: Item[] };

// ─── Ayudas locales ─────────────────────────────────────────────────────────

/**
 * En qué va el asistente (una línea) y cuál es su siguiente paso.
 * Mismo orden que el ciclo de vida del menú: Diseñar → Probar → Conectar → Operar.
 */
function estadoCiclo(
  progress: ProgramProgress,
  ws: Workspace
): { linea: string; siguiente: { label: string; href: string } | null } {
  const base = `/${ws.slug}`;
  if (!isDesignDone(progress)) {
    const listos = DESIGN_STEPS.filter((s) => progress.design[s.key]).length;
    const paso = DESIGN_STEPS.find((s) => !progress.design[s.key])!;
    return {
      linea: `En diseño · ${listos} de ${DESIGN_STEPS.length} listos`,
      siguiente: { label: paso.label, href: `${base}/${paso.path}` },
    };
  }
  if (!progress.test) {
    return {
      linea: "Listo para probar",
      siguiente: { label: "Probar con casos difíciles", href: `${base}/${nextStepPath(progress)}` },
    };
  }
  if (!progress.connect) {
    return {
      linea: "Probado · falta conectar WhatsApp",
      siguiente: { label: "Conectar WhatsApp", href: `${base}/whatsapp` },
    };
  }
  const personas = ws.stats.users;
  return {
    linea:
      progress.operate && personas > 0
        ? `Activo · ${personas} ${personas === 1 ? "persona" : "personas"}`
        : "Activo en WhatsApp",
    siguiente: { label: "Ver cómo va", href: `${base}/operar` },
  };
}

const porActividad = (a: Item, b: Item) => b.ws.updated_at.localeCompare(a.ws.updated_at);

/** Agrupa por organización: alfabético, con las pruebas internas de Plural al final. */
function agrupar(items: Item[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const item of items) {
    const g = grupos.get(item.ws.org_id) ?? {
      orgId: item.ws.org_id,
      orgName: item.ws.org_name,
      items: [],
    };
    g.items.push(item);
    grupos.set(item.ws.org_id, g);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, items: [...g.items].sort(porActividad) }))
    .sort((a, b) => {
      if (a.orgId === ORG_DEMO) return 1;
      if (b.orgId === ORG_DEMO) return -1;
      return a.orgName.localeCompare(b.orgName, "es");
    });
}

const cuantos = (n: number) => `${n} ${n === 1 ? "asistente" : "asistentes"}`;

const normalizar = (texto: string) =>
  texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** «hace 3 días», «ayer», «hace 5 minutos». */
function haceCuanto(iso: string): string {
  const segundos = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });
  const pasos: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unidad, s] of pasos) {
    if (Math.abs(segundos) >= s) return rtf.format(Math.round(segundos / s), unidad);
  }
  return "hace un momento";
}

const inicial = (nombre: string) => (nombre.trim()[0] ?? "?").toUpperCase();

// ─── Pantalla ───────────────────────────────────────────────────────────────

export function DashboardClient({
  initialWorkspaces,
  progress,
  orgs,
  selectedOrg,
  isPlural,
  abrirCrear,
}: {
  initialWorkspaces: Workspace[];
  /** Avance de cada asistente, en el mismo orden que initialWorkspaces. */
  progress: ProgramProgress[];
  /** Organizaciones visibles (el equipo Plural ve todas). */
  orgs: { id: string; nombre: string }[];
  /** Filtro activo (?org=); null = todas. */
  selectedOrg: string | null;
  isPlural: boolean;
  /** ?nuevo=1: abre el diálogo de crear al entrar. */
  abrirCrear: boolean;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(abrirCrear);
  const items = useMemo<Item[]>(
    () => initialWorkspaces.map((ws, i) => ({ ws, progress: progress[i] })),
    [initialWorkspaces, progress]
  );

  const onCreateOpenChange = (open: boolean) => {
    setIsCreateOpen(open);
    // Si llegó con ?nuevo=1 y cancela, se limpia la dirección (al recargar no se reabre).
    if (!open && abrirCrear) {
      router.replace(selectedOrg ? `/dashboard?org=${encodeURIComponent(selectedOrg)}` : "/dashboard");
    }
  };

  const dialog = (
    <CreateDialog
      open={isCreateOpen}
      onOpenChange={onCreateOpenChange}
      orgs={orgs}
      defaultOrg={
        selectedOrg ??
        (isPlural && orgs.some((o) => o.id === ORG_DEMO) ? ORG_DEMO : orgs[0]?.id ?? "")
      }
    />
  );

  const botonCrear = (
    <Button variant="outline" size="lg" onClick={() => setIsCreateOpen(true)} className="px-4">
      <PlusIcon />
      Crear asistente
    </Button>
  );

  if (isPlural) {
    return (
      <>
        <VistaPlural
          items={items}
          selectedOrg={selectedOrg}
          selectedOrgName={orgs.find((o) => o.id === selectedOrg)?.nombre ?? null}
          botonCrear={botonCrear}
        />
        {dialog}
      </>
    );
  }

  // Cliente sin asistentes: solo el estado vacío, con su única acción.
  if (items.length === 0) {
    return (
      <>
        <div className="mx-auto max-w-xl py-12 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Crea tu primer asistente
          </h1>
          <p className="mt-3 text-neutral-600">
            Un asistente acompaña a las personas de tu programa por WhatsApp: responde con tu
            material, sabe qué no hacer y a dónde derivar en una situación de riesgo. Lo diseñas,
            lo pruebas aquí mismo y después lo conectas a WhatsApp.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button size="lg" onClick={() => setIsCreateOpen(true)} className="h-10 px-5">
              <PlusIcon />
              Crear asistente
            </Button>
            <a
              href="mailto:hola@estudio-plural.co"
              className="text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
            >
              ¿Prefieres que lo armemos contigo? Escríbenos a hola@estudio-plural.co
            </a>
          </div>
        </div>
        {dialog}
      </>
    );
  }

  const variasOrgs = orgs.length > 1 && !selectedOrg;
  const grupos = variasOrgs ? agrupar(items) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Tus asistentes</h1>
          <p className="mt-2 text-neutral-600">
            Cada asistente acompaña a las personas de un programa por WhatsApp.
          </p>
        </div>
        {botonCrear}
      </div>

      {grupos ? (
        grupos.map((g) => (
          <section key={g.orgId} className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-500">
              {g.orgName} · {cuantos(g.items.length)}
            </h2>
            <ListaTarjetas items={g.items} />
          </section>
        ))
      ) : (
        <ListaTarjetas items={[...items].sort(porActividad)} />
      )}
      {dialog}
    </div>
  );
}

// ─── Vista cliente: tarjetas ────────────────────────────────────────────────

function ListaTarjetas({ items }: { items: Item[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.ws.id}>
          <TarjetaAsistente item={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Toda la tarjeta lleva al Inicio del asistente (enlace estirado sobre el nombre);
 * «Siguiente: …» es un enlace propio que va directo al paso pendiente.
 */
function TarjetaAsistente({ item }: { item: Item }) {
  const { ws, progress } = item;
  const { linea, siguiente } = estadoCiclo(progress, ws);
  return (
    <div className="relative flex h-full gap-4 rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300 hover:shadow-sm has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-neutral-900/30">
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-base font-semibold text-white"
        aria-hidden="true"
      >
        {inicial(ws.assistant_name)}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/${ws.slug}`}
          className="block truncate text-lg font-semibold text-neutral-900 outline-none after:absolute after:inset-0 after:rounded-xl"
        >
          {ws.assistant_name}
        </Link>
        <p className="truncate text-sm text-neutral-500">para {ws.name}</p>
        <p className="mt-3 text-sm text-neutral-700">{linea}</p>
        {siguiente && (
          <Link
            href={siguiente.href}
            className="relative z-10 mt-1 inline-block text-sm font-medium text-neutral-900 underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            Siguiente: {siguiente.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Vista del equipo Plural: búsqueda + filas por organización ─────────────

function VistaPlural({
  items,
  selectedOrg,
  selectedOrgName,
  botonCrear,
}: {
  items: Item[];
  selectedOrg: string | null;
  selectedOrgName: string | null;
  botonCrear: React.ReactNode;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [verPruebas, setVerPruebas] = useState(false);

  const q = normalizar(busqueda);
  // Se busca sobre la lista que ya llegó filtrada por acceso; nunca se pide más.
  const visibles = q
    ? items.filter(({ ws }) =>
        [ws.assistant_name, ws.name, ws.org_name].some((t) => normalizar(t).includes(q))
      )
    : items;
  const grupos = agrupar(visibles);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Asistentes</h1>
          {selectedOrg && (
            <p className="mt-2 text-sm text-neutral-600">
              Solo {selectedOrgName ?? "esta organización"} ·{" "}
              <Link href="/dashboard" className="underline underline-offset-4 hover:text-neutral-900">
                Ver todas
              </Link>
            </p>
          )}
        </div>
        {botonCrear}
      </div>

      <div className="relative max-w-md">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <Label htmlFor="buscar-asistente" className="sr-only">
          Buscar
        </Label>
        <Input
          id="buscar-asistente"
          type="search"
          placeholder="Busca un asistente, programa u organización"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="h-10 bg-white pl-9"
        />
      </div>

      {grupos.length === 0 && (
        <p className="py-8 text-sm text-neutral-600">
          {q ? `Ningún asistente coincide con «${busqueda.trim()}».` : "Todavía no hay asistentes aquí."}
        </p>
      )}

      {grupos.map((g) => {
        const esDemo = g.orgId === ORG_DEMO;
        // Las pruebas internas van colapsadas, salvo que se busque o se filtre por ellas.
        const abierto = !esDemo || verPruebas || q !== "" || selectedOrg === ORG_DEMO;
        return (
          <section key={g.orgId} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-neutral-500">
                {esDemo ? "Pruebas de Plural" : g.orgName} · {cuantos(g.items.length)}
              </h2>
              {!selectedOrg && abierto && (
                <Link
                  href={`/dashboard?org=${encodeURIComponent(g.orgId)}`}
                  className="text-xs text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
                >
                  Ver solo esta
                </Link>
              )}
            </div>
            {abierto ? (
              <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {g.items.map((item) => (
                  <li key={item.ws.id}>
                    <FilaAsistente item={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                onClick={() => setVerPruebas(true)}
                className="flex items-center gap-1 rounded-md text-sm text-neutral-600 underline-offset-4 outline-none hover:text-neutral-900 hover:underline focus-visible:ring-2 focus-visible:ring-neutral-900/30"
              >
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                Mostrar pruebas internas ({g.items.length})
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FilaAsistente({ item }: { item: Item }) {
  const { ws, progress } = item;
  const { linea } = estadoCiclo(progress, ws);
  return (
    <Link
      href={`/${ws.slug}`}
      className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/30"
    >
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700"
        aria-hidden="true"
      >
        {inicial(ws.assistant_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-neutral-900">
          {ws.assistant_name}{" "}
          <span className="font-normal text-neutral-500">para {ws.name}</span>
        </span>
        <span className="block truncate text-xs text-neutral-600">{linea}</span>
      </span>
      <span
        className="hidden flex-shrink-0 text-xs text-neutral-500 sm:block"
        title={new Date(ws.updated_at).toLocaleString("es-CO")}
        suppressHydrationWarning
      >
        {haceCuanto(ws.updated_at)}
      </span>
    </Link>
  );
}

// ─── Crear asistente ────────────────────────────────────────────────────────

function CreateDialog({
  open,
  onOpenChange,
  orgs,
  defaultOrg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgs: { id: string; nombre: string }[];
  defaultOrg: string;
}) {
  const router = useRouter();
  const [assistantName, setAssistantName] = useState("");
  const [programName, setProgramName] = useState("");
  const [org, setOrg] = useState(defaultOrg);
  const [isCreating, setIsCreating] = useState(false);
  const showOrgPicker = orgs.length > 1;

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantName.trim()) {
      toast.error("Escribe el nombre del asistente");
      return;
    }
    if (!programName.trim()) {
      toast.error("Escribe el nombre del programa");
      return;
    }
    setIsCreating(true);
    try {
      // La dirección se genera sola a partir del programa.
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: programName.trim(),
          assistant_name: assistantName.trim(),
          org_id: org || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.workspace) {
        toast.error("No se pudo crear el asistente");
        return;
      }
      // Se aterriza en el Inicio del asistente nuevo.
      router.push(`/${data.workspace.slug}`);
    } catch {
      toast.error("No se pudo crear el asistente");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={crear}>
          <DialogHeader>
            <DialogTitle>Crear asistente</DialogTitle>
            <DialogDescription>
              Después te guiamos paso a paso: lo diseñas, lo pruebas y lo conectas a WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="assistant_name">¿Cómo se llama tu asistente?</Label>
              <Input
                id="assistant_name"
                placeholder="Ej: Sofía"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                maxLength={100}
                aria-required="true"
                autoFocus
              />
              <p className="text-xs text-neutral-600">Así se presenta en WhatsApp.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="program_name">¿Para qué programa es?</Label>
              <Input
                id="program_name"
                placeholder="Ej: Cuidar a quien cuida"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                maxLength={100}
                aria-required="true"
              />
            </div>
            {showOrgPicker && (
              <div className="space-y-2">
                <Label htmlFor="new-org">¿De qué organización es?</Label>
                <select
                  id="new-org"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                >
                  {[...orgs]
                    .sort((a, b) => Number(b.id === ORG_DEMO) - Number(a.id === ORG_DEMO))
                    .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id === ORG_DEMO ? "Pruebas de Plural" : o.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creando…" : "Crear asistente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
