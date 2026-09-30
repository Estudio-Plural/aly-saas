"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
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
  formatoUsd,
  type Caso,
  type Chequeo,
  type Corrida,
  type Estimado,
  type ResultadoCaso,
} from "@/lib/casos";
import { ProbarNav } from "../probar-nav";

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChequeoFila({ chequeo }: { chequeo: Chequeo }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {chequeo.ok ? (
        <CheckCircle2Icon aria-label="Bien" className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
      ) : (
        <AlertTriangleIcon aria-label="Revisar" className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
      )}
      <span className="min-w-0">
        <span className="font-medium text-neutral-900">{chequeo.etiqueta}.</span>{" "}
        <span className="text-neutral-700">{chequeo.porque}</span>
      </span>
    </li>
  );
}

function ResumenCorrida({ corrida }: { corrida: Corrida }) {
  const seguridad = corrida.resultados
    .flatMap((r) => r.chequeos)
    .filter((c) => c.seguridad && !c.ok).length;
  const sinRespuesta = corrida.resultados.filter((r) => r.error).length;
  return (
    <Card
      className={`flex flex-col gap-1 border p-4 sm:flex-row sm:items-center sm:gap-3 ${
        corrida.seguridadOk ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      {corrida.seguridadOk ? (
        <ShieldCheckIcon className="h-5 w-5 flex-shrink-0 text-green-700" />
      ) : (
        <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-amber-700" />
      )}
      <p className={`text-sm ${corrida.seguridadOk ? "text-green-900" : "text-amber-900"}`}>
        <span className="font-semibold">
          {corrida.seguridadOk
            ? "Los chequeos de seguridad pasaron."
            : sinRespuesta
              ? `${sinRespuesta} ${sinRespuesta === 1 ? "caso quedó" : "casos quedaron"} sin respuesta.`
              : `${seguridad} ${seguridad === 1 ? "chequeo de seguridad" : "chequeos de seguridad"} para revisar.`}
        </span>{" "}
        Última corrida: {fecha(corrida.corridaEn)} · {corrida.casos} casos
        {corrida.advertencias > 0 && ` · ${corrida.advertencias} ⚠ en total`}
        {corrida.simulada && " · respuestas simuladas (desarrollo)"}
      </p>
    </Card>
  );
}

function CasoCard({
  caso,
  resultado,
  onBorrar,
}: {
  caso: Caso;
  resultado: ResultadoCaso | undefined;
  onBorrar?: () => void;
}) {
  const alertas = resultado?.chequeos.filter((c) => !c.ok).length ?? 0;
  return (
    <Card className="p-5">
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
                alertas ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
              }`}
            >
              {alertas ? `${alertas} ⚠` : "✓ Bien"}
            </span>
          )}
          {onBorrar && (
            <ConfirmDialog
              title="¿Borrar este caso?"
              description="Deja de correr en las próximas pruebas."
              confirmLabel="Borrar"
              onConfirm={onBorrar}
            >
              <Button variant="ghost" size="sm" aria-label="Borrar caso" className="h-8 w-8 p-0 text-neutral-500 hover:text-red-600">
                <TrashIcon className="h-4 w-4" />
              </Button>
            </ConfirmDialog>
          )}
        </div>
      </div>

      {!resultado ? (
        <p className="mt-3 text-sm text-neutral-500">Sin correr todavía.</p>
      ) : resultado.error ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangleIcon className="h-4 w-4" /> {resultado.error}
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="mb-1 text-xs font-medium text-neutral-500">Responde</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">{resultado.respuesta}</p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {resultado.chequeos.map((c) => (
              <ChequeoFila key={c.id} chequeo={c} />
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
}: {
  workspaceSlug: string;
  assistantName: string;
  initialCasos: Caso[];
  initialCorrida: Corrida | null;
  initialEstimado: Estimado;
  simuladas: boolean;
}) {
  const [casos, setCasos] = useState(initialCasos);
  const [corrida, setCorrida] = useState(initialCorrida);
  const [estimado, setEstimado] = useState(initialEstimado);
  const [corriendo, setCorriendo] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [agregando, setAgregando] = useState(false);

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
        toast.error(data?.error ?? "No se pudieron correr los casos");
        return;
      }
      toast.success(
        data.corrida.seguridadOk ? "Listo: los chequeos de seguridad pasaron" : "Listo: hay chequeos para revisar",
      );
    } catch {
      toast.error("Error de conexión al correr los casos");
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
        toast.error(data?.error ?? "No se pudo agregar el caso");
        return;
      }
      setCasos(data.casos);
      setEstimado(data.estimado);
      setNuevo("");
      toast.success("Caso agregado. Corre los casos para ver cómo responde.");
    } catch {
      toast.error("Error de conexión al agregar el caso");
    } finally {
      setAgregando(false);
    }
  };

  const borrar = async (id: string) => {
    const res = await fetch(`${api}/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo borrar el caso");
      return;
    }
    setCasos(data.casos);
    setEstimado(data.estimado);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Probar</h1>
        <p className="mt-1 text-neutral-700">
          Antes de conectar WhatsApp, mira cómo responde {assistantName} en los momentos donde un
          asistente suele fallar.
        </p>
      </div>

      <ProbarNav workspaceSlug={workspaceSlug} />

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">
            {estimado.casos} casos × {estimado.modelo}
          </p>
          <p>
            {simuladas
              ? "Respuestas simuladas (modo desarrollo): no se gasta nada."
              : `Costo estimado: ${formatoUsd(estimado.usd)}${estimado.aproximado ? " (aproximado)" : ""}. Cada caso es un turno completo del asistente, sin historial, y no se guarda como conversación.`}
          </p>
        </div>
        <Button onClick={correr} disabled={corriendo} size="lg" className="flex-shrink-0">
          {corriendo ? (
            <>
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> Corriendo…
            </>
          ) : (
            <>
              <PlayIcon className="mr-2 h-4 w-4" /> Correr los casos
            </>
          )}
        </Button>
      </Card>

      {corrida && <ResumenCorrida corrida={corrida} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Casos del banco</h2>
        {casos
          .filter((c) => c.fijo)
          .map((caso) => (
            <CasoCard key={caso.id} caso={caso} resultado={resultadoDe(caso.id)} />
          ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Tus casos</h2>
          <p className="text-sm text-neutral-600">
            Mensajes que te preocupan de tu programa. Corren junto con los del banco.
          </p>
        </div>
        {propios.map((caso) => (
          <CasoCard key={caso.id} caso={caso} resultado={resultadoDe(caso.id)} onBorrar={() => borrar(caso.id)} />
        ))}
        {propios.length < MAX_CASOS_PROPIOS && (
          <Card className="space-y-3 p-5">
            <label htmlFor="caso-nuevo" className="text-sm font-medium text-neutral-900">
              Agregar un caso
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
              {agregando ? "Agregando…" : "Agregar caso"}
            </Button>
          </Card>
        )}
      </section>

      <p className="text-sm text-neutral-600">
        Los chequeos son automáticos y en código: buscan teléfonos que no están en tus{" "}
        <Link href={`/${workspaceSlug}/rutas`} className="underline underline-offset-2">
          rutas de ayuda
        </Link>
        , nombres de archivos, promesas de avisar o agendar, promesas de privacidad y más de una
        pregunta a la vez. Probar queda hecho cuando la última corrida pasa los de seguridad.
      </p>
    </div>
  );
}
