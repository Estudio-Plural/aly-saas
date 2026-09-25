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
  MessagesSquareIcon,
  PhoneIcon,
  MonitorIcon,
  AlertTriangleIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  BellIcon,
  CheckIcon,
  FlagIcon,
  TargetIcon,
} from "lucide-react";
import { toast } from "sonner";
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
    return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
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
      {upper}
    </Badge>
  );
}

export function ConversationsClient({
  workspaceSlug,
  assistantName,
  conversations,
  initialFlagRules,
}: {
  workspaceSlug: string;
  assistantName: string;
  conversations: ConversationSummary[];
  initialFlagRules: FlagRule[];
}) {
  const [items, setItems] = useState<ConversationSummary[]>(conversations);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.conversationId ?? null
  );
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const selected = items.find((conv) => conv.conversationId === selectedId) ?? null;
  const selectedMessages = selectedId ? messagesById[selectedId] : undefined;
  const pendingCount = items.filter((conv) => hasAlert(conv) && !conv.reviewedAt).length;
  const visible = items.filter((conv) =>
    filter === "all"
      ? true
      : filter === "pending"
        ? hasAlert(conv) && !conv.reviewedAt
        : hasAlert(conv) && Boolean(conv.reviewedAt)
  );
  // Mensajes citados como evidencia por el supervisor (se resaltan en el detalle)
  const evidenceIds = new Set(
    selected?.supervision?.flags.flatMap((flag) => flag.evidence.map((e) => e.messageId)) ?? []
  );

  const toggleReviewed = async (conv: ConversationSummary) => {
    setIsReviewing(true);
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
      toast.success(data.reviewedAt ? "Alerta marcada como revisada" : "Alerta pendiente otra vez");
    } catch {
      toast.error("Error de conexión al actualizar la alerta");
    } finally {
      setIsReviewing(false);
    }
  };

  const openConversation = async (conversationId: string) => {
    setSelectedId(conversationId);
    if (messagesById[conversationId]) return;

    setIsLoadingDetail(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/conversations/${encodeURIComponent(conversationId)}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessagesById((prev) => ({ ...prev, [conversationId]: data.messages ?? [] }));
    } catch {
      toast.error("No se pudo cargar la conversación");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Cargar el detalle de la primera conversación al montar
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    if (selectedId) openConversation(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Conversaciones
        </h1>
        <p className="text-neutral-700 mt-1">
          Todo lo que {assistantName} habló con tus usuarios, con resumen y alertas
        </p>
      </div>

      <FlagRulesCard
        workspaceSlug={workspaceSlug}
        assistantName={assistantName}
        initialRules={initialFlagRules}
      />

      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <MessagesSquareIcon className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <p className="font-semibold text-neutral-900 mb-1">
            Todavía no hay conversaciones
          </p>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            Cuando conectes WhatsApp, las conversaciones de tus usuarios van a aparecer
            acá. Mientras tanto, podés generar una desde la Vista Previa del Chat.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-[minmax(260px,2fr)_3fr] gap-4 items-start">
          {/* Lista */}
          <Card className="p-2 max-h-[700px] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
              <span className="text-xs text-neutral-600">
                {pendingCount === 0
                  ? "Sin alertas pendientes"
                  : `${pendingCount} ${pendingCount === 1 ? "alerta sin revisar" : "alertas sin revisar"}`}
              </span>
              <Select value={filter} onValueChange={(value) => setFilter(value as ReviewFilter)}>
                <SelectTrigger className="h-8 w-44 text-xs">
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
            <div className="space-y-1">
              {visible.length === 0 && (
                <p className="text-center text-sm text-neutral-600 py-8">
                  No hay conversaciones con este filtro
                </p>
              )}
              {visible.map((conv) => {
                const isActive = conv.conversationId === selectedId;
                return (
                  <button
                    key={conv.conversationId}
                    onClick={() => openConversation(conv.conversationId)}
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
                    <p className="text-xs text-neutral-600 truncate mb-1.5">
                      {conv.lastMessageRole === "assistant" ? `${assistantName}: ` : ""}
                      {conv.lastMessage}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {conv.isWebPreview ? (
                        <Badge variant="outline" className="gap-1 text-neutral-600">
                          <MonitorIcon className="h-3 w-3" /> Web
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-neutral-600">
                          <PhoneIcon className="h-3 w-3" /> WhatsApp
                        </Badge>
                      )}
                      {conv.isOpen && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          Abierta
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
                        {selected.isWebPreview
                          ? "Conversación de la vista previa web"
                          : selected.clientNumber}
                        {" · "}
                        {selected.messagesCount} mensajes
                        {" · "}
                        {new Date(selected.startedAt).toLocaleDateString("es-AR")}
                      </p>
                    </div>
                    <Badge
                      className={
                        selected.isOpen
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-neutral-100 text-neutral-600 border-neutral-200"
                      }
                    >
                      {selected.isOpen ? "Abierta" : "Cerrada"}
                    </Badge>
                  </div>

                  {(selected.summary ||
                    selected.flags ||
                    selected.supervision ||
                    selected.keywords.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
                      {selected.summary && (
                        <div>
                          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                            Resumen
                          </p>
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
                                    <span className="font-semibold">{flag.severity}</span>
                                    {" · "}
                                    {flag.ruleDescription}
                                  </p>
                                  <p className="text-amber-800">{flag.detail}</p>
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
                                ? `Revisada el ${new Date(selected.reviewedAt).toLocaleString("es-AR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`
                                : "Alerta sin revisar"}
                            </p>
                            <Button
                              size="sm"
                              variant={selected.reviewedAt ? "ghost" : "outline"}
                              onClick={() => toggleReviewed(selected)}
                              disabled={isReviewing}
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
                      Cargando conversación...
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
                            message.sender === "assistant"
                              ? "justify-end"
                              : "justify-start"
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
                            <p
                              className={`text-[11px] mt-1 ${
                                message.sender === "assistant"
                                  ? "text-neutral-400"
                                  : "text-neutral-400"
                              }`}
                            >
                              {message.sender === "assistant"
                                ? assistantName
                                : selected.userName ?? selected.clientNumber}
                              {" · "}
                              {formatWhen(message.timestamp)}
                              {evidenceIds.has(message.id) && ` · mensaje ${index + 1}, evidencia de alerta`}
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
      )}
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
            : "sin arrancar el programa"}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <TargetIcon className="h-4 w-4 text-neutral-500" />
        Criterio de éxito:{" "}
        <span className="font-medium">
          {criterio.value
            ? `cumplido (mensajes ${criterio.evidence.map((e) => e.messageIndex + 1).join(", ")})`
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
 * Editor del sistema de alertas: el dueño define en sus palabras qué marcar.
 * Las reglas se evalúan con el LLM al cerrar cada conversación.
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

  const isDirty = JSON.stringify(rules) !== JSON.stringify(savedRules);
  const hasInvalidRule = rules.some((rule) => rule.description.trim().length < 3);

  const updateRule = (id: string, patch: Partial<FlagRule>) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  };

  const addRule = () => {
    if (rules.length >= 10) {
      toast.error("Máximo 10 reglas de alerta");
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
        toast.error(data?.error ?? "No se pudieron guardar las reglas");
        return;
      }
      setRules(cleaned);
      setSavedRules(cleaned);
      toast.success("Reglas de alerta guardadas");
    } catch {
      toast.error("Error de conexión al guardar las reglas");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <BellIcon className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p className="font-semibold text-neutral-900">Sistema de alertas</p>
          <p className="text-sm text-neutral-600">
            Contale a {assistantName} en tus palabras qué conversaciones querés que te
            marque. Se evalúan automáticamente cuando una conversación termina (se cierra o
            queda inactiva un rato).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rules.length === 0 && (
          <p className="text-sm text-neutral-600 py-2">
            No hay reglas: las conversaciones se van a resumir igual, pero sin alertas.
          </p>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center gap-2">
            <Input
              value={rule.description}
              onChange={(e) => updateRule(rule.id, { description: e.target.value })}
              placeholder='Ej: "El usuario quiere cancelar su suscripción"'
              maxLength={300}
              className="flex-1"
            />
            <Select
              value={rule.severity}
              onValueChange={(value) =>
                updateRule(rule.id, { severity: value as FlagSeverity })
              }
            >
              <SelectTrigger className="w-28 flex-shrink-0">
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
              aria-label="Eliminar regla"
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
          Agregar regla
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || hasInvalidRule || isSaving}
        >
          {isSaving ? "Guardando..." : "Guardar reglas"}
        </Button>
      </div>
    </Card>
  );
}
