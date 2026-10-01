"use client";

import { useState, useEffect, useRef } from "react";
import { uid } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MessagesSquareIcon,
  PhoneIcon,
  MonitorIcon,
  AlertTriangleIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  FlagIcon,
  TargetIcon,
} from "lucide-react";
import { toast } from "sonner";
import { OperarNav } from "../operar/operar-nav";
import type {
  ChatMessage,
  ConversationSummary,
  FlagRule,
  FlagSeverity,
} from "@/lib/workspaces";
import { STORYBOARD_MOMENT_LABELS } from "@/lib/workspaces";

const SEVERITY_LABELS: Record<FlagSeverity, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ReviewFilter = "all" | "pending" | "reviewed";

const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  all: "Todas",
  pending: "Alertas sin revisar",
  reviewed: "Alertas revisadas",
};

function hasAlert(conv: ConversationSummary): boolean {
  return Boolean(conv.flagSeverity);
}

function isPending(conv: ConversationSummary): boolean {
  return hasAlert(conv) && !conv.reviewedAt;
}

function severityLabel(severity: string): string {
  return SEVERITY_LABELS[severity.toLowerCase() as FlagSeverity] ?? severity;
}

function severityBadge(severity: string | null) {
  if (!severity) return null;
  const upper = severity.toUpperCase();
  const styles =
    upper === "HIGH"
      ? "bg-red-100 text-red-700 border-red-200"
      : upper === "MEDIUM"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-neutral-100 text-neutral-700 border-neutral-200";
  return (
    <Badge variant="outline" className={`${styles} gap-1`}>
      <AlertTriangleIcon className="h-3 w-3" />
      {severityLabel(severity)}
    </Badge>
  );
}

/** Qué alerta saltó, en palabras de la regla del cliente (sin texto de la conversación). */
function alertLabel(conv: ConversationSummary): string {
  const rules = conv.supervision?.flags.map((flag) => flag.ruleDescription).filter(Boolean) ?? [];
  if (rules.length > 0) return rules.join(" · ");
  return conv.flagSeverity ? `Alerta de prioridad ${severityLabel(conv.flagSeverity).toLowerCase()}` : "Alerta";
}

export function ConversationsClient({
  workspaceSlug,
  assistantName,
  conversations,
  initialFlagRules,
  canSeeTranscripts,
}: {
  workspaceSlug: string;
  assistantName: string;
  conversations: ConversationSummary[];
  initialFlagRules: FlagRule[];
  /** Solo el equipo de Plural ve el texto de las conversaciones. */
  canSeeTranscripts: boolean;
}) {
  const [items, setItems] = useState<ConversationSummary[]>(conversations);
  // Las pruebas (chat de prueba) quedan ocultas por defecto; solo Plural puede incluirlas.
  const [includeTests, setIncludeTests] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const realItems = items.filter((conv) => includeTests || !conv.isWebPreview);

  const toggleReviewed = async (conv: ConversationSummary) => {
    setReviewingId(conv.conversationId);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/conversations/${encodeURIComponent(conv.conversationId)}/review`,
        { method: conv.reviewedAt ? "DELETE" : "POST" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo actualizar la alerta");
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.conversationId === conv.conversationId
            ? { ...item, reviewedAt: data.reviewedAt, reviewedBy: data.reviewedBy }
            : item
        )
      );
      toast.success(data.reviewedAt ? "Alerta marcada como atendida" : "Alerta pendiente otra vez");
    } catch {
      toast.error("Error de conexión al actualizar la alerta");
    } finally {
      setReviewingId(null);
    }
  };

  const rulesCard = (
    <FlagRulesCard
      workspaceSlug={workspaceSlug}
      assistantName={assistantName}
      initialRules={initialFlagRules}
    />
  );

  if (!canSeeTranscripts) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Conversaciones
          </h1>
          <p className="text-neutral-700 mt-1 max-w-2xl">
            Las alertas de las conversaciones de {assistantName} y si ya las atendiste. Por
            privacidad, los mensajes de las personas solo los ve el equipo de Plural.
          </p>
        </div>

        <OperarNav workspaceSlug={workspaceSlug} />

        <ClientAlerts
          alerts={realItems.filter(hasAlert)}
          reviewingId={reviewingId}
          onToggleReviewed={toggleReviewed}
        />

        {rulesCard}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Conversaciones</h1>
        <p className="text-neutral-700 mt-1">
          Lo que {assistantName} habló con las personas de tu programa, con resumen y alertas.
        </p>
      </div>

      <OperarNav workspaceSlug={workspaceSlug} />

      <PluralInbox
        workspaceSlug={workspaceSlug}
        assistantName={assistantName}
        items={realItems}
        includeTests={includeTests}
        onIncludeTestsChange={setIncludeTests}
        reviewingId={reviewingId}
        onToggleReviewed={toggleReviewed}
      />

      {rulesCard}
    </div>
  );
}

/**
 * Vista del cliente: solo las alertas, sin ningún texto de la conversación (ni resumen, ni
 * palabras clave, ni detalle). Una sola acción por fila: marcarla como atendida.
 */
function ClientAlerts({
  alerts,
  reviewingId,
  onToggleReviewed,
}: {
  alerts: ConversationSummary[];
  reviewingId: string | null;
  onToggleReviewed: (conv: ConversationSummary) => void;
}) {
  if (alerts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <BellIcon className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
        <p className="font-semibold text-neutral-900 mb-1">No hay alertas</p>
        <p className="text-sm text-neutral-600 max-w-md mx-auto">
          Cuando una conversación active una de tus alertas, aparece aquí.
        </p>
      </Card>
    );
  }

  const pending = alerts.filter(isPending).length;
  // Las pendientes primero; dentro de cada grupo, la más reciente arriba (ya vienen así).
  const sorted = [...alerts].sort((a, b) => Number(isPending(b)) - Number(isPending(a)));

  return (
    <Card className="p-0 gap-0 overflow-hidden">
      <p className="px-4 py-3 text-sm text-neutral-700 border-b border-neutral-100">
        {pending === 0
          ? "Atendiste todas las alertas."
          : `${pending} ${pending === 1 ? "alerta sin atender" : "alertas sin atender"}`}
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Fecha</TableHead>
              <TableHead>Alerta</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead className="pr-4 text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((conv) => (
              <TableRow key={conv.conversationId}>
                <TableCell className="pl-4 text-neutral-700 tabular-nums">
                  {formatFechaHora(conv.lastAt)}
                </TableCell>
                <TableCell className="whitespace-normal text-neutral-900 min-w-[200px]">
                  {alertLabel(conv)}
                </TableCell>
                <TableCell>{severityBadge(conv.flagSeverity)}</TableCell>
                <TableCell className="pr-4 text-right">
                  {conv.reviewedAt ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm text-neutral-600">
                        <CheckIcon className="h-4 w-4" /> Atendida
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-neutral-600"
                        onClick={() => onToggleReviewed(conv)}
                        disabled={reviewingId === conv.conversationId}
                      >
                        Deshacer
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => onToggleReviewed(conv)}
                      disabled={reviewingId === conv.conversationId}
                    >
                      <CheckIcon className="mr-1.5 h-4 w-4" />
                      Marcar como atendida
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/** Vista del equipo de Plural: bandeja con lista + detalle y transcripción. */
function PluralInbox({
  workspaceSlug,
  assistantName,
  items,
  includeTests,
  onIncludeTestsChange,
  reviewingId,
  onToggleReviewed,
}: {
  workspaceSlug: string;
  assistantName: string;
  items: ConversationSummary[];
  includeTests: boolean;
  onIncludeTestsChange: (value: boolean) => void;
  reviewingId: string | null;
  onToggleReviewed: (conv: ConversationSummary) => void;
}) {
  // Si hay alertas sin revisar, se arranca por ahí.
  const [filter, setFilter] = useState<ReviewFilter>(() =>
    items.some(isPending) ? "pending" : "all"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const pendingCount = items.filter(isPending).length;
  const visible = items.filter((conv) =>
    filter === "all"
      ? true
      : filter === "pending"
        ? isPending(conv)
        : hasAlert(conv) && Boolean(conv.reviewedAt)
  );
  const selected =
    visible.find((conv) => conv.conversationId === selectedId) ?? visible[0] ?? null;
  const selectedMessages = selected ? messagesById[selected.conversationId] : undefined;
  // Mensajes citados como evidencia por el supervisor (se resaltan en el detalle)
  const evidenceIds = new Set(
    selected?.supervision?.flags.flatMap((flag) => flag.evidence.map((e) => e.messageId)) ?? []
  );

  const loadedRef = useRef<Set<string>>(new Set());
  const selectedConvId = selected?.conversationId ?? null;
  useEffect(() => {
    if (!selectedConvId || loadedRef.current.has(selectedConvId)) return;
    loadedRef.current.add(selectedConvId);
    // Sin cancelar: si la persona cambia de conversación, la respuesta igual queda en caché.
    setIsLoadingDetail(true);
    fetch(`/api/workspaces/${workspaceSlug}/conversations/${encodeURIComponent(selectedConvId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        setMessagesById((prev) => ({ ...prev, [selectedConvId]: data.messages ?? [] }));
      })
      .catch(() => {
        loadedRef.current.delete(selectedConvId);
        toast.error("No se pudo cargar la conversación");
      })
      .finally(() => setIsLoadingDetail(false));
  }, [selectedConvId, workspaceSlug]);

  const testsToggle = (
    <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4 accent-neutral-900"
        checked={includeTests}
        onChange={(e) => onIncludeTestsChange(e.target.checked)}
      />
      Incluir pruebas
    </label>
  );

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">{testsToggle}</div>
        <Card className="p-12 text-center">
          <MessagesSquareIcon className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <p className="font-semibold text-neutral-900 mb-1">
            Todavía no hay conversaciones reales
          </p>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            Aparecen aquí cuando alguien le escriba a {assistantName} por WhatsApp.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neutral-700">
          {pendingCount === 0
            ? "Sin alertas pendientes"
            : `${pendingCount} ${pendingCount === 1 ? "alerta sin revisar" : "alertas sin revisar"}`}
        </span>
        <div className="flex items-center gap-4">
          {testsToggle}
          <Select value={filter} onValueChange={(value) => setFilter(value as ReviewFilter)}>
            <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filtrar conversaciones">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REVIEW_FILTER_LABELS) as ReviewFilter[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {REVIEW_FILTER_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,2fr)_3fr] gap-4 items-start">
        {/* Lista */}
        <Card className="p-2 gap-0 max-h-[700px] overflow-y-auto">
          <div className="space-y-1">
            {visible.length === 0 && (
              <p className="text-center text-sm text-neutral-600 py-8">
                No hay conversaciones con este filtro
              </p>
            )}
            {visible.map((conv) => {
              const isActive = conv.conversationId === selected?.conversationId;
              return (
                <button
                  key={conv.conversationId}
                  onClick={() => setSelectedId(conv.conversationId)}
                  aria-current={isActive ? "true" : undefined}
                  className={`w-full text-left rounded-lg px-3 py-3 transition-colors ${
                    isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-neutral-900 truncate">
                      {conv.userName ?? conv.clientNumber}
                    </span>
                    <span className="text-xs text-neutral-600 flex-shrink-0">
                      {formatWhen(conv.lastAt)}
                    </span>
                  </div>
                  {conv.lastMessage !== null ? (
                    <p className="text-xs text-neutral-600 truncate mb-1.5">
                      {conv.lastMessageRole === "assistant" ? `${assistantName}: ` : ""}
                      {conv.lastMessage}
                    </p>
                  ) : conv.summary ? (
                    <p className="text-xs text-neutral-600 truncate mb-1.5">{conv.summary}</p>
                  ) : null}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {conv.isWebPreview ? (
                      <Badge variant="outline" className="gap-1 text-neutral-600">
                        <MonitorIcon className="h-3 w-3" /> Prueba
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-neutral-600">
                        <PhoneIcon className="h-3 w-3" /> WhatsApp
                      </Badge>
                    )}
                    {conv.isOpen && (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        En curso
                      </Badge>
                    )}
                    {severityBadge(conv.flagSeverity)}
                    {hasAlert(conv) &&
                      (conv.reviewedAt ? (
                        <Badge variant="outline" className="gap-1 text-neutral-600">
                          <CheckIcon className="h-3 w-3" /> Revisada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-neutral-900 border-neutral-400">
                          Sin revisar
                        </Badge>
                      ))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Detalle */}
        <div className="space-y-4">
          {selected && (
            <>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-lg text-neutral-900">
                      {selected.userName ?? selected.clientNumber}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {selected.isWebPreview ? "Conversación de prueba" : selected.clientNumber}
                      {" · "}
                      {selected.messagesCount} mensajes
                      {" · "}
                      {new Date(selected.startedAt).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge
                    className={
                      selected.isOpen
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-neutral-100 text-neutral-600 border-neutral-200"
                    }
                  >
                    {selected.isOpen ? "En curso" : "Terminada"}
                  </Badge>
                </div>

                {(selected.summary ||
                  selected.flags ||
                  selected.supervision ||
                  selected.keywords.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
                    {selected.summary && (
                      <div>
                        <p className="text-xs font-semibold text-neutral-600 mb-1">Resumen</p>
                        <p className="text-sm text-neutral-800">{selected.summary}</p>
                      </div>
                    )}
                    {selected.supervision && (
                      <SupervisionSummary supervision={selected.supervision} />
                    )}
                    {selected.flags && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-2">
                        {selected.supervision?.flags.length ? (
                          selected.supervision.flags.map((flag) => (
                            <div key={flag.ruleId} className="flex items-start gap-2">
                              <AlertTriangleIcon className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-amber-900 min-w-0">
                                <p>
                                  <span className="font-semibold">{severityLabel(flag.severity)}</span>
                                  {" · "}
                                  {flag.ruleDescription}
                                </p>
                                {flag.detail && <p className="text-amber-800">{flag.detail}</p>}
                                {flag.evidence.map((e) => (
                                  <p
                                    key={`${e.messageId}-${e.fragment}`}
                                    className="text-xs text-amber-800 mt-0.5"
                                  >
                                    Mensaje {e.messageIndex + 1}: “{e.fragment}”
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-start gap-2">
                            <AlertTriangleIcon className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-800">{selected.flags}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200">
                          <p className="text-xs text-amber-800">
                            {selected.reviewedAt
                              ? `Revisada el ${formatFechaHora(selected.reviewedAt)}`
                              : "Alerta sin revisar"}
                          </p>
                          <Button
                            size="sm"
                            variant={selected.reviewedAt ? "ghost" : "outline"}
                            onClick={() => onToggleReviewed(selected)}
                            disabled={reviewingId === selected.conversationId}
                            className="h-8 bg-white"
                          >
                            {selected.reviewedAt ? (
                              "Volver a pendiente"
                            ) : (
                              <>
                                <CheckIcon className="mr-1.5 h-4 w-4" />
                                Marcar como revisada
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    {selected.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {selected.keywords.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="text-neutral-600">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>

              <Card className="p-5 max-h-[520px] overflow-y-auto bg-neutral-50">
                {isLoadingDetail && !selectedMessages ? (
                  <div className="flex items-center justify-center py-10 text-neutral-600">
                    <Loader2Icon className="h-5 w-5 animate-spin mr-2" />
                    Cargando conversación…
                  </div>
                ) : !selectedMessages?.length ? (
                  <p className="text-center text-sm text-neutral-600 py-10">
                    Esta conversación no tiene mensajes
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedMessages.map((message, index) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender === "assistant" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            message.sender === "assistant"
                              ? "bg-neutral-900 text-white"
                              : "bg-white text-neutral-900 border border-neutral-200"
                          } ${evidenceIds.has(message.id) ? "ring-2 ring-amber-400" : ""}`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.text}
                          </p>
                          <p className="text-[11px] mt-1 text-neutral-400">
                            {message.sender === "assistant"
                              ? assistantName
                              : selected.userName ?? selected.clientNumber}
                            {" · "}
                            {formatWhen(message.timestamp)}
                            {evidenceIds.has(message.id) &&
                              ` · mensaje ${index + 1}, evidencia de alerta`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Momento del storyboard alcanzado + criterio de éxito (análisis del supervisor). */
function SupervisionSummary({
  supervision,
}: {
  supervision: NonNullable<ConversationSummary["supervision"]>;
}) {
  const criterio = supervision.cumplioCriterioExito;
  return (
    <div className="flex items-center gap-4 flex-wrap text-sm text-neutral-800">
      <span className="flex items-center gap-1.5">
        <FlagIcon className="h-4 w-4 text-neutral-500" />
        Llegó a:{" "}
        <span className="font-medium">
          {supervision.momentoAlcanzado
            ? STORYBOARD_MOMENT_LABELS[supervision.momentoAlcanzado]
            : "no arrancó"}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <TargetIcon className="h-4 w-4 text-neutral-500" />
        Criterio de éxito:{" "}
        <span className="font-medium">
          {criterio.value
            ? criterio.evidence.length
              ? `cumplido (mensajes ${criterio.evidence.map((e) => e.messageIndex + 1).join(", ")})`
              : "cumplido"
            : "no cumplido"}
        </span>
      </span>
      {supervision.discardedFlags > 0 && (
        <span className="text-xs text-neutral-500">
          {supervision.discardedFlags}{" "}
          {supervision.discardedFlags === 1 ? "posible alerta descartada" : "posibles alertas descartadas"} por
          falta de evidencia
        </span>
      )}
    </div>
  );
}

/**
 * Editor de las alertas: el dueño define en sus palabras qué marcar. Se evalúan
 * solas al cerrar cada conversación. Va abajo y colapsada: se usa poco.
 */
function FlagRulesCard({
  workspaceSlug,
  assistantName,
  initialRules,
}: {
  workspaceSlug: string;
  assistantName: string;
  initialRules: FlagRule[];
}) {
  const [rules, setRules] = useState<FlagRule[]>(initialRules);
  const [savedRules, setSavedRules] = useState<FlagRule[]>(initialRules);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const isDirty = JSON.stringify(rules) !== JSON.stringify(savedRules);
  const hasInvalidRule = rules.some((rule) => rule.description.trim().length < 3);

  const updateRule = (id: string, patch: Partial<FlagRule>) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  };

  const addRule = () => {
    if (rules.length >= 10) {
      toast.error("Puedes tener hasta 10 alertas");
      return;
    }
    setRules((prev) => [
      ...prev,
      { id: uid(), description: "", severity: "medium" },
    ]);
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleaned = rules.map((rule) => ({
        ...rule,
        description: rule.description.trim(),
      }));
      const res = await fetch(`/api/workspaces/${workspaceSlug}/flags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: cleaned }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudieron guardar las alertas");
        return;
      }
      setRules(cleaned);
      setSavedRules(cleaned);
      toast.success("Alertas guardadas");
    } catch {
      toast.error("Error de conexión al guardar las alertas");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-5 gap-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <BellIcon className="h-5 w-5 text-neutral-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-neutral-900">Cambiar qué te avisamos</p>
          <p className="text-sm text-neutral-600">
            {rules.length === 0
              ? "Todavía no hay alertas definidas."
              : `${rules.length} ${rules.length === 1 ? "alerta definida" : "alertas definidas"}.`}
          </p>
        </div>
        <ChevronDownIcon
          className={`h-5 w-5 mt-2 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="mt-4">
          <p className="text-sm text-neutral-600 mb-4">
            Cuéntale a {assistantName} en tus palabras qué conversaciones quieres que te marque. Se
            revisan solas cuando una conversación termina (se cierra o queda inactiva un rato).
          </p>

          <div className="space-y-2">
            {rules.length === 0 && (
              <p className="text-sm text-neutral-600 py-2">
                Sin alertas, no te avisamos de ninguna conversación.
              </p>
            )}
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2">
                <Input
                  value={rule.description}
                  onChange={(e) => updateRule(rule.id, { description: e.target.value })}
                  placeholder="Ej.: La persona menciona que alguien la lastima en casa"
                  aria-label="Cuándo avisar"
                  maxLength={300}
                  className="flex-1"
                />
                <Select
                  value={rule.severity}
                  onValueChange={(value) =>
                    updateRule(rule.id, { severity: value as FlagSeverity })
                  }
                >
                  <SelectTrigger className="w-28 flex-shrink-0" aria-label="Prioridad">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SEVERITY_LABELS) as FlagSeverity[]).map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {SEVERITY_LABELS[severity]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRule(rule.id)}
                  aria-label="Quitar alerta"
                  className="h-9 w-9 p-0 text-neutral-600 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" onClick={addRule}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Agregar alerta
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || hasInvalidRule || isSaving}
            >
              {isSaving ? "Guardando…" : "Guardar alertas"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
