"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityIcon, DownloadIcon, ShieldAlertIcon } from "lucide-react";
import {
  duracionHumana,
  MIN_CONVERSACIONES_POR_TEMA,
  MUESTRA_MINIMA,
  type Cifras,
  type Conteo,
} from "@aly-saas/operar";
import { PERIODOS, type PeriodoKey } from "@/lib/operar";
import type { EstadoReporte } from "@/lib/data/operar";
import { OperarNav } from "./operar-nav";

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function Cifra({ titulo, valor, base }: { titulo: string; valor: string; base: string }) {
  return (
    <Card className="px-4 gap-1">
      <p className="text-xs font-medium text-neutral-600">{titulo}</p>
      <p className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">{valor}</p>
      <p className="text-xs text-neutral-600">{base}</p>
    </Card>
  );
}

/** Barras horizontales con el valor al lado (sin ejes ni leyenda). */
function Barras({ items, vacio }: { items: Conteo[]; vacio: string }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  if (items.every((i) => i.valor === 0)) {
    return <p className="text-sm text-neutral-600">{vacio}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.etiqueta} className="grid grid-cols-[minmax(0,50%)_1fr_auto] items-center gap-3">
          <span className="truncate text-sm text-neutral-800" title={item.etiqueta}>
            {item.etiqueta}
          </span>
          <span className="h-2.5 rounded-full bg-neutral-100">
            <span
              className="block h-2.5 rounded-full bg-neutral-800"
              style={{ width: `${(item.valor / max) * 100}%` }}
            />
          </span>
          <span className="w-8 text-right text-sm tabular-nums text-neutral-700">{item.valor}</span>
        </li>
      ))}
    </ul>
  );
}

/** Columnas por hora del día (0–23). */
function Horas({ items }: { items: Conteo[] }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Mensajes por hora del día">
        {items.map((item) => (
          <div
            key={item.etiqueta}
            className="flex-1 rounded-t-sm bg-neutral-800"
            style={{ height: `${Math.max(item.valor ? 4 : 0, (item.valor / max) * 100)}%` }}
            title={`${item.etiqueta}: ${plural(item.valor, "mensaje", "mensajes")}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-neutral-500 tabular-nums">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

function Seccion({ titulo, base, children }: { titulo: string; base: string; children: React.ReactNode }) {
  return (
    <Card className="px-5 gap-3">
      <div>
        <h3 className="font-semibold text-neutral-900">{titulo}</h3>
        <p className="text-xs text-neutral-600">{base}</p>
      </div>
      {children}
    </Card>
  );
}

export function OperarClient({
  workspaceSlug,
  assistantName,
  periodo,
  hayReales,
  cifras,
  protocoloActivo,
  reporte,
}: {
  workspaceSlug: string;
  assistantName: string;
  periodo: PeriodoKey;
  hayReales: boolean;
  cifras: Cifras;
  protocoloActivo: boolean;
  reporte: EstadoReporte;
}) {
  const c = cifras;
  const descarga = `/api/workspaces/${workspaceSlug}/operar/resumen-semanal`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Operar</h1>
        <p className="text-neutral-700 mt-1">
          Cómo le va a {assistantName} con las personas reales. Solo cifras: sin nombres, números ni
          mensajes.
        </p>
      </div>

      <OperarNav workspaceSlug={workspaceSlug} />

      {!hayReales ? (
        <Card className="p-12 text-center">
          <ActivityIcon className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <p className="font-semibold text-neutral-900 mb-1">Todavía no hay conversaciones reales</p>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            Cuando conectes WhatsApp aparecen acá; mientras tanto, prueba tu asistente.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild>
              <Link href={`/${workspaceSlug}/chat`}>Probar tu asistente</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${workspaceSlug}/whatsapp`}>Conectar WhatsApp</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
              {PERIODOS.map((p) => (
                <Link
                  key={p.key}
                  href={`/${workspaceSlug}/operar?periodo=${p.key}`}
                  aria-current={p.key === periodo ? "true" : undefined}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    p.key === periodo
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
            <Button asChild variant="outline">
              <a href={descarga} download>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Descargar resumen de la semana
              </a>
            </Button>
          </div>

          {reporte.status === "sent" && (
            <p className="text-xs text-neutral-600 -mt-3">
              El resumen de la semana pasada se mandó por correo a{" "}
              {plural(reporte.recipientsCount, "persona", "personas")} de tu equipo.
            </p>
          )}

          {c.conversaciones === 0 ? (
            <Card className="p-8 text-center">
              <p className="font-semibold text-neutral-900 mb-1">No hubo conversaciones en este período</p>
              <p className="text-sm text-neutral-600">Prueba con un período más largo.</p>
            </Card>
          ) : (
            <>
              <section aria-label="¿Llega? ¿Conversa?" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Cifra
                  titulo="Personas que escribieron"
                  valor={String(c.personas)}
                  base={`en ${plural(c.conversaciones, "conversación", "conversaciones")}`}
                />
                <Cifra
                  titulo="Conversaciones"
                  valor={String(c.conversaciones)}
                  base="empezaron en este período"
                />
                <Cifra
                  titulo="Conversan"
                  valor={
                    c.enganche.base >= MUESTRA_MINIMA
                      ? `${Math.round((c.enganche.conversan / c.enganche.base) * 100)}%`
                      : String(c.enganche.conversan)
                  }
                  base={`${c.enganche.conversan} de ${plural(c.enganche.base, "conversación", "conversaciones")} · solo saludaron ${c.enganche.soloSaludan}`}
                />
                <Cifra
                  titulo="Mensajes por persona"
                  valor={String(c.mensajesPorPersona.mediana ?? 0)}
                  base={`mediana, de ${plural(c.mensajesPorPersona.base, "persona", "personas")}`}
                />
                <Cifra
                  titulo="Tiempo de respuesta"
                  valor={duracionHumana(c.respuesta.medianaSegundos)}
                  base={`mediana, de ${plural(c.respuesta.base, "respuesta", "respuestas")}`}
                />
                <Card className="px-4 gap-1">
                  <p className="text-xs font-medium text-neutral-600">Situaciones sensibles</p>
                  <p className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                    {c.sensibles.conversaciones}
                  </p>
                  <p className="text-xs text-neutral-600">
                    de {plural(c.sensibles.base, "conversación analizada", "conversaciones analizadas")}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-neutral-700">
                    <ShieldAlertIcon className="mt-px h-3.5 w-3.5 flex-shrink-0 text-neutral-500" />
                    {protocoloActivo ? (
                      <span>Se avisan según tu protocolo.</span>
                    ) : (
                      <span>
                        Las revisa el equipo de Plural.{" "}
                        <Link href={`/${workspaceSlug}/operar/protocolo`} className="underline">
                          Definir protocolo
                        </Link>
                      </span>
                    )}
                  </p>
                </Card>
              </section>
              {c.conversaciones < MUESTRA_MINIMA && (
                <p className="text-xs text-neutral-600 -mt-3">
                  Con menos de {MUESTRA_MINIMA} conversaciones mostramos conteos, no porcentajes: todavía
                  es pronto para leer tendencias.
                </p>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                <Seccion
                  titulo="¿De qué hablan?"
                  base={`Temas que se repiten en ${MIN_CONVERSACIONES_POR_TEMA} conversaciones o más · de ${plural(c.temas.base, "conversación analizada", "conversaciones analizadas")}`}
                >
                  <Barras items={c.temas.items} vacio="Todavía no hay temas que se repitan." />
                  {c.temas.ocultos > 0 && (
                    <p className="text-xs text-neutral-600">
                      {plural(c.temas.ocultos, "tema aparece", "temas aparecen")} en una sola conversación y no{" "}
                      {c.temas.ocultos === 1 ? "se muestra" : "se muestran"}: podría identificar a alguien.
                    </p>
                  )}
                </Seccion>
                <Seccion
                  titulo="¿Hasta dónde llegan en el programa?"
                  base={`Momento más avanzado de cada conversación · de ${plural(c.momentos.base, "conversación analizada", "conversaciones analizadas")}`}
                >
                  <Barras
                    items={[
                      ...c.momentos.items,
                      { etiqueta: "Sin arrancar el programa", valor: c.momentos.sinArrancar },
                    ]}
                    vacio="Todavía no hay conversaciones analizadas."
                  />
                </Seccion>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Seccion
                  titulo="¿Qué día escriben?"
                  base={`Mensajes de las personas · de ${plural(c.cuando.base, "mensaje", "mensajes")}`}
                >
                  <Barras items={c.cuando.porDia} vacio="Sin mensajes." />
                </Seccion>
                <Seccion
                  titulo="¿A qué hora?"
                  base={`Mensajes de las personas por hora · de ${plural(c.cuando.base, "mensaje", "mensajes")}`}
                >
                  <Horas items={c.cuando.porHora} />
                </Seccion>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
