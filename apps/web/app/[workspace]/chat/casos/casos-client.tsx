"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2Icon,
  InfoIcon,
  LightbulbIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MAX_CASOS_PROPIOS,
  NO_DISPONIBLE,
  SIN_RESPUESTA,
  arregloDe,
  formatoUsd,
  type Caso,
  type Chequeo,
  type Corrida,
  type Estimado,
  type ResultadoCaso,
} from "@/lib/casos";
import { ProbarNav } from "../probar-nav";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * «30 sep, 16:42» en hora de Colombia. A mano (solo partes numéricas de Intl): el texto
 * de toLocaleString cambia entre el ICU de Node y el del navegador y rompe la hidratación.
 */
function fecha(iso: string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${Number(partes.day)} ${MESES[Number(partes.month) - 1]}, ${partes.hour}:${partes.minute}`;
}

/** Un chequeo que falla es «Riesgo» si es de seguridad; si no, «Sugerencia». */
function ChequeoFila({ chequeo, workspaceSlug }: { chequeo: Chequeo; workspaceSlug: string }) {
  const arreglo = chequeo.ok ? null : arregloDe(chequeo);
  return (
    <li className="flex items-start gap-2 text-sm">
      {chequeo.ok ? (
        <CheckCircle2Icon aria-label="Bien" className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
      ) : chequeo.seguridad ? (
        <ShieldAlertIcon aria-label="Riesgo" className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
      ) : (
        <LightbulbIcon aria-label="Sugerencia" className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500" />
      )}
      <span className="min-w-0">
        {!chequeo.ok && (
          <span
            className={`mr-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${
              chequeo.seguridad ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {chequeo.seguridad ? "Riesgo" : "Sugerencia"}
          </span>
        )}
        <span className="font-medium text-neutral-900">{chequeo.etiqueta}.</span>{" "}
        <span className="text-neutral-700">{chequeo.porque}</span>
        {!chequeo.ok && chequeo.seguridad && (
          <span className="block text-amber-800">Revisa esto antes de conectar WhatsApp.</span>
        )}
        {arreglo && (
          <Link
            href={`/${workspaceSlug}/${arreglo.seccion}`}
            className="mt-0.5 block font-medium text-neutral-900 underline-offset-2 hover:underline"
          >
            {arreglo.texto}
          </Link>
        )}
      </span>
    </li>
  );
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function contar(chequeos: Chequeo[]) {
  return {
    riesgos: chequeos.filter((c) => c.seguridad && !c.ok).length,
    sugerencias: chequeos.filter((c) => !c.seguridad && !c.ok).length,
  };
}

function ResumenCorrida({
  corrida,
  workspaceSlug,
  assistantName,
  esPlural,
}: {
  corrida: Corrida;
  workspaceSlug: string;
  assistantName: string;
  esPlural: boolean;
}) {
  const { riesgos, sugerencias } = contar(corrida.resultados.flatMap((r) => r.chequeos));
  const conRiesgo = corrida.resultados.filter((r) => r.chequeos.some((c) => c.seguridad && !c.ok));
  const sinRespuesta = corrida.resultados.filter((r) => r.error).length;
  const detalle = (
    <p className="mt-1 text-sm text-neutral-600">
      Última prueba: {fecha(corrida.corridaEn)} · {plural(riesgos, "riesgo", "riesgos")} ·{" "}
      {plural(sugerencias, "sugerencia", "sugerencias")}
      {sinRespuesta > 0 && ` · ${plural(sinRespuesta, "sin respuesta", "sin respuesta")}`}
    </p>
  );
  const soloPlural = esPlural && corrida.simulada && (
    <p className="mt-1 text-xs text-neutral-500">Solo Plural: respuestas simuladas (desarrollo).</p>
  );

  if (conRiesgo.length > 0) {
    return (
      <Card className="flex gap-3 border border-amber-200 bg-amber-50 p-4">
        <ShieldAlertIcon className="h-5 w-5 flex-shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="font-semibold text-amber-900">
            {conRiesgo.length === 1
              ? "1 respuesta puede poner en riesgo a alguien."
              : `${conRiesgo.length} respuestas pueden poner en riesgo a alguien.`}{" "}
            Corrígelas y vuelve a probar.
          </p>
          <a
            href={`#caso-${conRiesgo[0].caso.id}`}
            className="mt-1 inline-block text-sm font-medium text-amber-900 underline underline-offset-2"
          >
            Ver la primera →
          </a>
          {detalle}
          {soloPlural}
        </div>
      </Card>
    );
  }

  if (sinRespuesta > 0) {
    // Falla técnica: gris neutro, no ámbar.
    return (
      <Card className="flex gap-3 border border-neutral-200 bg-neutral-50 p-4">
        <InfoIcon className="h-5 w-5 flex-shrink-0 text-neutral-500" />
        <div className="min-w-0">
          <p className="text-sm text-neutral-800">{NO_DISPONIBLE}</p>
          {detalle}
          {soloPlural}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <ShieldCheckIcon className="h-5 w-5 flex-shrink-0 text-green-700" />
        <div className="min-w-0">
          <p className="font-semibold text-green-900">
            Listo: {assistantName} maneja bien las situaciones de riesgo.
          </p>
          {detalle}
          {soloPlural}
        </div>
      </div>
      <Button asChild className="flex-shrink-0">
        <Link href={`/${workspaceSlug}/whatsapp`}>Siguiente paso: conectar WhatsApp →</Link>
      </Button>
    </Card>
  );
}

function CasoCard({
  caso,
  resultado,
  workspaceSlug,
  onBorrar,
}: {
  caso: Caso;
  resultado: ResultadoCaso | undefined;
  workspaceSlug: string;
  onBorrar?: () => void;
}) {
  const { riesgos, sugerencias } = contar(resultado?.chequeos ?? []);
  return (
    <Card id={`caso-${caso.id}`} className="scroll-mt-24 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-900">{caso.titulo}</h3>
          <p className="mt-1 text-sm text-neutral-700">
            <span className="text-neutral-500">La persona escribe:</span> «{caso.mensaje}»
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {resultado && !resultado.error && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                riesgos
                  ? "bg-amber-100 text-amber-800"
                  : sugerencias
                    ? "bg-neutral-100 text-neutral-700"
                    : "bg-green-100 text-green-800"
              }`}
            >
              {riesgos
                ? plural(riesgos, "riesgo", "riesgos")
                : sugerencias
                  ? plural(sugerencias, "sugerencia", "sugerencias")
                  : "✓ Bien"}
            </span>
          )}
          {onBorrar && (
            <ConfirmDialog
              title="¿Borrar esta situación?"
              description="Deja de probarse en las próximas pruebas."
              confirmLabel="Borrar"
              onConfirm={onBorrar}
            >
              <Button variant="ghost" size="sm" aria-label="Borrar situación" className="h-8 w-8 p-0 text-neutral-500 hover:text-red-600">
                <TrashIcon className="h-4 w-4" />
              </Button>
            </ConfirmDialog>
          )}
        </div>
      </div>

      {!resultado ? (
        <p className="mt-3 text-sm text-neutral-500">Todavía no se ha probado.</p>
      ) : resultado.error ? (
        // Falla técnica: gris neutro y siempre el mismo texto (las pruebas viejas guardaron otro).
        <p className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
          <InfoIcon className="h-4 w-4 flex-shrink-0" /> {SIN_RESPUESTA}
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="mb-1 text-xs font-medium text-neutral-500">Responde</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">{resultado.respuesta}</p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {resultado.chequeos.map((c) => (
              <ChequeoFila key={c.id} chequeo={c} workspaceSlug={workspaceSlug} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function CasosClient({
  workspaceSlug,
  assistantName,
  initialCasos,
  initialCorrida,
  initialEstimado,
  simuladas,
  esPlural,
}: {
  workspaceSlug: string;
  assistantName: string;
  initialCasos: Caso[];
  initialCorrida: Corrida | null;
  initialEstimado: Estimado;
  simuladas: boolean;
  esPlural: boolean;
}) {
  const [casos, setCasos] = useState(initialCasos);
  const [corrida, setCorrida] = useState(initialCorrida);
  const [estimado, setEstimado] = useState(initialEstimado);
  const [corriendo, setCorriendo] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [agregando, setAgregando] = useState(false);

  const nombre = assistantName.trim() || "Tu asistente";
  const api = `/api/workspaces/${workspaceSlug}/casos`;
  const propios = casos.filter((c) => !c.fijo);
  const resultadoDe = (id: string) => corrida?.resultados.find((r) => r.caso.id === id);

  const correr = async () => {
    setCorriendo(true);
    try {
      const res = await fetch(`${api}/correr`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.corrida) setCorrida(data.corrida);
      if (!res.ok) {
        toast.error(data?.error ?? NO_DISPONIBLE);
        return;
      }
      const c = data.corrida as Corrida;
      if (c.seguridadOk) toast.success(`Listo: ${nombre} maneja bien las situaciones de riesgo`);
      else if (c.resultados.some((r) => r.error)) toast.error(NO_DISPONIBLE);
      else toast.warning("Hay respuestas para corregir");
    } catch {
      toast.error(NO_DISPONIBLE);
    } finally {
      setCorriendo(false);
    }
  };

  const agregar = async () => {
    const mensaje = nuevo.trim();
    if (!mensaje) return;
    setAgregando(true);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No pudimos agregarla. Intenta de nuevo.");
        return;
      }
      setCasos(data.casos);
      setEstimado(data.estimado);
      setNuevo("");
      toast.success("Agregado. Pruébalo con el botón de arriba.");
    } catch {
      toast.error("No pudimos agregarla. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setAgregando(false);
    }
  };

  const borrar = async (id: string) => {
    const res = await fetch(`${api}/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "No pudimos borrarla. Intenta de nuevo.");
      return;
    }
    setCasos(data.casos);
    setEstimado(data.estimado);
  };

  return (
    <div className="space-y-6">
      <ProbarNav
        workspaceSlug={workspaceSlug}
        assistantName={assistantName}
        testHecho={corrida?.seguridadOk ?? false}
      />

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-neutral-700">
          <p className="text-base font-semibold text-neutral-900">
            Revisa {casos.length} situaciones difíciles
          </p>
          <p>
            {nombre} responde cada mensaje como si fuera la primera vez que alguien le escribe.
            Tarda menos de un minuto.
          </p>
          <p className="text-neutral-600">Esta prueba es la que marca «Probar» como hecho.</p>
          {esPlural && (
            <p className="text-xs text-neutral-500">
              Solo Plural:{" "}
              {simuladas
                ? "respuestas simuladas (desarrollo), no se gasta nada."
                : `${estimado.modelo} · costo estimado ${formatoUsd(estimado.usd)}${estimado.aproximado ? " (aproximado)" : ""}.`}
            </p>
          )}
        </div>
        {/* Si ya pasó, el primario es «conectar WhatsApp» (en el resumen): este queda en outline. */}
        <Button
          onClick={correr}
          disabled={corriendo}
          size="lg"
          variant={corrida?.seguridadOk ? "outline" : "default"}
          className="flex-shrink-0"
        >
          {corriendo ? (
            <>
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> Probando… (1 min)
            </>
          ) : (
            <>
              <PlayIcon className="mr-2 h-4 w-4" /> Probar las situaciones
            </>
          )}
        </Button>
      </Card>

      {corrida && (
        <ResumenCorrida
          corrida={corrida}
          workspaceSlug={workspaceSlug}
          assistantName={nombre}
          esPlural={esPlural}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Situaciones que siempre revisamos</h2>
        {casos
          .filter((c) => c.fijo)
          .map((caso) => (
            <CasoCard key={caso.id} caso={caso} resultado={resultadoDe(caso.id)} workspaceSlug={workspaceSlug} />
          ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Tus situaciones</h2>
          <p className="text-sm text-neutral-600">
            Mensajes que te preocupa que reciba tu programa. Se prueban junto con los demás.
          </p>
        </div>
        {propios.map((caso) => (
          <CasoCard
            key={caso.id}
            caso={caso}
            resultado={resultadoDe(caso.id)}
            workspaceSlug={workspaceSlug}
            onBorrar={() => borrar(caso.id)}
          />
        ))}
        {propios.length < MAX_CASOS_PROPIOS && (
          <Card className="space-y-3 p-5">
            <label htmlFor="caso-nuevo" className="text-sm font-medium text-neutral-900">
              Agregar una situación
            </label>
            <Textarea
              id="caso-nuevo"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              placeholder="Ej: Mi hijo no quiere ir al colegio y ya no sé qué hacer"
              maxLength={1000}
              rows={2}
            />
            <Button variant="outline" onClick={agregar} disabled={agregando || !nuevo.trim()}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              {agregando ? "Agregando…" : "Agregar situación"}
            </Button>
          </Card>
        )}
      </section>

      <p className="text-sm text-neutral-600">
        Revisamos cada respuesta de forma automática: teléfonos que no están en tus{" "}
        <Link href={`/${workspaceSlug}/rutas`} className="underline underline-offset-2">
          rutas de ayuda
        </Link>
        , nombres de archivos, promesas de avisar o agendar, promesas de privacidad y más de una
        pregunta a la vez.
      </p>
    </div>
  );
}
