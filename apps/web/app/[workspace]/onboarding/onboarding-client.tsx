"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  MessageCircle,
  CheckCircle,
  Trash2,
  GripVertical,
  Save,
  SendIcon,
  RotateCcwIcon,
  AlertTriangleIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OnboardingStep } from "@/lib/workspaces";

type Step = OnboardingStep;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function interpolate(content: string, answers: Record<string, string>): string {
  return content.replace(/\{(\w+)\}/g, (match, key) => answers[key] ?? match);
}

function usedVariables(content: string): string[] {
  return [...content.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

/** El nombre de la respuesta debe servir como {variable}: minúsculas y _ */
function sanitizeVariable(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

/** Separa el flujo en pasos editables + el paso Fin (siempre único y al final). */
function normalizeSteps(steps: Step[]): { body: Step[]; end: Step } {
  const body = steps.filter((step) => step.type !== "end");
  const end = steps.find((step) => step.type === "end") ?? {
    id: "end",
    type: "end" as const,
    content: "¡Listo! Ya podés hacerme cualquier consulta.",
  };
  return { body, end };
}

const TEMPLATE_STEPS: Step[] = [
  { id: "1", type: "question", content: "¿Cómo te llamas?", variable: "name" },
  { id: "2", type: "message", content: "¡Hola {name}! Bienvenido a nuestro programa." },
  { id: "3", type: "end", content: "Onboarding completado" },
];

// ─── Card de paso editable (edición directa, sin modo "Editar") ───────────────

function SortableStepCard({
  step,
  index,
  availableVars,
  onChange,
  onDelete,
}: {
  step: Step;
  index: number;
  availableVars: string[];
  onChange: (patch: Partial<Step>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isQuestion = step.type === "question";
  const missingVars = usedVariables(step.content).filter(
    (variable) => !availableVars.includes(variable)
  );
  const isEmpty = !step.content.trim();

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`p-4 border-2 transition-all ${
          isQuestion ? "border-blue-200 bg-blue-50/30" : "border-green-200 bg-green-50/30"
        }`}
      >
        {/* Header: drag + tipo + número + borrar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              aria-label="Reordenar paso"
              className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-neutral-200/50 rounded"
            >
              <GripVertical className="h-4 w-4 text-neutral-400" />
            </button>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isQuestion ? "bg-blue-600" : "bg-green-600"
              }`}
            >
              {isQuestion ? (
                <MessageSquare className="h-4 w-4 text-white" />
              ) : (
                <MessageCircle className="h-4 w-4 text-white" />
              )}
            </div>
            <span
              className={`text-xs font-semibold ${
                isQuestion ? "text-blue-700" : "text-green-700"
              }`}
            >
              {isQuestion ? "PREGUNTA" : "MENSAJE"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-neutral-400">#{index + 1}</span>
            <Button
              onClick={onDelete}
              size="sm"
              variant="ghost"
              aria-label="Eliminar paso"
              className="h-7 w-7 p-0 text-neutral-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Contenido: siempre editable */}
        <Textarea
          value={step.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder={
            isQuestion
              ? "Escribí la pregunta para el usuario..."
              : "Escribí el mensaje..."
          }
          rows={2}
          maxLength={2000}
          className="resize-none bg-white text-sm"
        />

        {/* Pregunta: dónde se guarda la respuesta (sin jerga técnica) */}
        {isQuestion && (
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-neutral-600 whitespace-nowrap">
              Guardar la respuesta como
            </label>
            <Input
              value={step.variable ?? ""}
              onChange={(e) => onChange({ variable: sanitizeVariable(e.target.value) })}
              placeholder="nombre"
              className="h-8 w-36 text-sm bg-white"
            />
          </div>
        )}

        {/* Chips para insertar respuestas anteriores */}
        {availableVars.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs text-neutral-500">Insertar respuesta:</span>
            {availableVars.map((variable) => (
              <button
                key={variable}
                onClick={() => onChange({ content: `${step.content}{${variable}}` })}
                className="text-xs font-mono px-2 py-0.5 rounded-full bg-white border border-neutral-300 text-neutral-700 hover:border-blue-400 hover:text-blue-700 transition-colors"
              >
                {`{${variable}}`}
              </button>
            ))}
          </div>
        )}

        {/* Avisos */}
        {missingVars.length > 0 && (
          <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-700">
            <AlertTriangleIcon className="h-3.5 w-3.5 mt-px flex-shrink-0" />
            <span>
              {missingVars.map((v) => `{${v}}`).join(", ")} no viene de ninguna pregunta
              anterior: el usuario lo va a ver tal cual.
            </span>
          </div>
        )}
        {isEmpty && (
          <p className="text-xs text-amber-700 mt-2">
            Completá este paso para poder guardar el flujo.
          </p>
        )}
      </Card>
    </div>
  );
}

// ─── Preview interactiva: corre el flujo de verdad ────────────────────────────

type PreviewMessage = { id: string; text: string; sender: "user" | "assistant" };

function FlowPreview({ steps, assistantName }: { steps: Step[]; assistantName: string }) {
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const indexRef = useRef(0);
  const answersRef = useRef<Record<string, string>>({});
  const startedRef = useRef(false);
  const runIdRef = useRef(0);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const sessionSnapshotRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const serialize = (flow: Step[]) =>
    JSON.stringify(flow.map((s) => [s.type, s.content, s.variable ?? ""]));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isTyping]);

  const advance = async (fromIndex: number) => {
    const myRun = runIdRef.current;
    const flow = stepsRef.current;
    const texts: string[] = [];
    let i = fromIndex;
    let finished = false;

    while (i < flow.length) {
      const step = flow[i];
      const text = interpolate(step.content, answersRef.current).trim();
      if (step.type === "question") {
        if (text) texts.push(text);
        break;
      }
      if (text) texts.push(text);
      i++;
      if (step.type === "end") {
        finished = true;
        break;
      }
    }
    if (i >= flow.length) finished = true;
    indexRef.current = i;

    for (const text of texts) {
      setIsTyping(true);
      await sleep(500);
      if (runIdRef.current !== myRun) return;
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, sender: "assistant" },
      ]);
    }
    setIsTyping(false);
    if (finished) setIsDone(true);
  };

  const restart = () => {
    runIdRef.current++;
    setMessages([]);
    setIsDone(false);
    setIsTyping(false);
    setInputValue("");
    answersRef.current = {};
    indexRef.current = 0;
    sessionSnapshotRef.current = serialize(stepsRef.current);
    advance(0);
  };

  // Arranque automático (guard para StrictMode)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    sessionSnapshotRef.current = serialize(stepsRef.current);
    advance(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isTyping || isDone) return;
    setInputValue("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text, sender: "user" }]);

    const step = stepsRef.current[indexRef.current];
    if (step?.type === "question" && step.variable?.trim()) {
      answersRef.current = { ...answersRef.current, [step.variable.trim()]: text };
    }
    advance(indexRef.current + 1);
  };

  const flowChanged =
    messages.length > 0 && serialize(steps) !== sessionSnapshotRef.current;

  return (
    <Card className="h-full flex flex-col overflow-hidden border border-neutral-200">
      {/* Header estilo chat */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 font-bold">{assistantName.charAt(0)}</span>
          </div>
          <div>
            <div className="font-semibold text-sm">{assistantName}</div>
            <div className="text-xs text-blue-100">Probá tu flujo acá</div>
          </div>
        </div>
        <Button
          onClick={restart}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-blue-700 hover:text-white h-8"
        >
          <RotateCcwIcon className="h-4 w-4 mr-1.5" />
          Reiniciar
        </Button>
      </div>

      {flowChanged && (
        <button
          onClick={restart}
          className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 text-left hover:bg-amber-100 transition-colors"
        >
          El flujo cambió desde que empezó esta prueba — tocá acá para reiniciarla.
        </button>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto bg-neutral-50 p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                message.sender === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-neutral-900 border border-neutral-200 shadow-sm"
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.text}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          </div>
        )}

        {isDone && (
          <div className="flex justify-center pt-2">
            <div className="bg-purple-100 border border-purple-300 rounded-full px-4 py-1.5">
              <p className="text-xs font-semibold text-purple-700">
                ✓ Fin del flujo — desde acá responde {assistantName} con tu base de
                conocimiento
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-neutral-200 p-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isDone ? "Reiniciá la prueba para volver a empezar" : "Escribí tu respuesta..."
            }
            disabled={isTyping || isDone}
            className="flex-1 h-10"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping || isDone}
            aria-label="Enviar respuesta"
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700"
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Builder principal ────────────────────────────────────────────────────────

export function OnboardingClient({
  workspaceSlug,
  assistantName,
  initialSteps,
}: {
  workspaceSlug: string;
  assistantName: string;
  initialSteps: Step[];
}) {
  const initial = normalizeSteps(initialSteps.length ? initialSteps : TEMPLATE_STEPS);
  const [body, setBody] = useState<Step[]>(initial.body);
  const [endStep, setEndStep] = useState<Step>(initial.end);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialSteps));
  const [isSaving, setIsSaving] = useState(false);

  const allSteps = [...body, endStep];
  const isDirty = JSON.stringify(allSteps) !== savedSnapshot;
  const hasEmptySteps = body.some((step) => !step.content.trim());

  const definedVarsBefore = (index: number) =>
    body
      .slice(0, index)
      .filter((step) => step.type === "question" && step.variable?.trim())
      .map((step) => step.variable!.trim());
  const allVars = definedVarsBefore(body.length);

  const updateStep = (id: string, patch: Partial<Step>) => {
    setBody((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...patch } : step))
    );
  };

  const deleteStep = (id: string) => {
    setBody((prev) => prev.filter((step) => step.id !== id));
  };

  const addStep = (type: "question" | "message") => {
    setBody((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        content: "",
        variable: type === "question" ? "" : undefined,
      },
    ]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBody((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveFlow = async () => {
    setIsSaving(true);
    try {
      // Limpieza: variables vacías afuera, solo preguntas las llevan
      const steps = allSteps.map((step) => ({
        id: step.id,
        type: step.type,
        content: step.content,
        ...(step.type === "question" && step.variable?.trim()
          ? { variable: step.variable.trim() }
          : {}),
      }));
      const res = await fetch(`/api/workspaces/${workspaceSlug}/onboarding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo guardar el flujo");
        return;
      }
      setSavedSnapshot(JSON.stringify(allSteps));
      toast.success("Flujo guardado: ya corre en la Vista Previa del Chat");
    } catch {
      toast.error("Error de conexión al guardar el flujo");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Flujo de Onboarding</h1>
          <p className="text-neutral-600 mt-1">
            Diseñá la conversación inicial con tus usuarios y probala en vivo a la derecha.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasEmptySteps && (
            <span className="text-xs text-amber-700">Hay pasos sin completar</span>
          )}
          <Button
            onClick={saveFlow}
            disabled={!isDirty || hasEmptySteps || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Guardando..." : isDirty ? "Guardar" : "Guardado ✓"}
          </Button>
        </div>
      </div>

      {/* Main Content: 2 columns */}
      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* Left: Editor */}
        <div className="space-y-4 overflow-y-auto pr-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={body.map((step) => step.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {body.map((step, index) => (
                  <SortableStepCard
                    key={step.id}
                    step={step}
                    index={index}
                    availableVars={definedVarsBefore(index)}
                    onChange={(patch) => updateStep(step.id, patch)}
                    onDelete={() => deleteStep(step.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Paso Fin: fijo, siempre al final */}
          <Card className="p-4 border-2 border-purple-200 bg-purple-50/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center ml-7">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-purple-700">FIN</span>
              <span className="text-xs text-neutral-500">— siempre es el último paso</span>
            </div>
            <Textarea
              value={endStep.content}
              onChange={(e) => setEndStep((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Mensaje de cierre (opcional)"
              rows={2}
              maxLength={2000}
              className="resize-none bg-white text-sm"
            />
            {allVars.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-neutral-500">Insertar respuesta:</span>
                {allVars.map((variable) => (
                  <button
                    key={variable}
                    onClick={() =>
                      setEndStep((prev) => ({
                        ...prev,
                        content: `${prev.content}{${variable}}`,
                      }))
                    }
                    className="text-xs font-mono px-2 py-0.5 rounded-full bg-white border border-neutral-300 text-neutral-700 hover:border-purple-400 hover:text-purple-700 transition-colors"
                  >
                    {`{${variable}}`}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-500 mt-2">
              Después de este mensaje, {assistantName} responde solo, usando tu base de
              conocimiento.
            </p>
          </Card>

          {/* Agregar pasos (se insertan antes del Fin) */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => addStep("question")}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-9"
            >
              <PlusIcon className="h-3.5 w-3.5 mr-1.5" />
              Pregunta
            </Button>
            <Button
              onClick={() => addStep("message")}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white h-9"
            >
              <PlusIcon className="h-3.5 w-3.5 mr-1.5" />
              Mensaje
            </Button>
          </div>

          {/* Info Card */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-blue-900 mb-1">¿Cómo funciona?</p>
                <ul className="text-blue-800 space-y-1 text-xs">
                  <li>
                    • <strong>Pregunta:</strong> el asistente pregunta y guarda la
                    respuesta con el nombre que elijas
                  </li>
                  <li>
                    • <strong>Mensaje:</strong> el asistente envía un mensaje; con los
                    chips podés usar respuestas anteriores
                  </li>
                  <li>
                    • <strong>Fin:</strong> cierra el onboarding; después el asistente
                    responde consultas por su cuenta
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Preview interactiva */}
        <div className="min-h-[560px]">
          <FlowPreview steps={allSteps} assistantName={assistantName} />
        </div>
      </div>
    </div>
  );
}
