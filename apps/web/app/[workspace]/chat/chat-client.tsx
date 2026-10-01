"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SendIcon, RotateCcwIcon, FileTextIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { ProbarNav } from "./probar-nav";
import { extractVariable } from "@/lib/extract-variable";
import { uid } from "@/lib/utils";
import {
  attachmentKind,
  type ChatMessage,
  type StoryboardAttachment,
} from "@/lib/workspaces";
import {
  PREGUNTA_CONSENTIMIENTO,
  DESPEDIDA_RECHAZO,
  evaluarConsentimiento,
  matchOption,
  type PreviewStep,
} from "@/lib/design";

// "ended": la persona rechazó el consentimiento; la conversación termina.
type Mode = "onboarding" | "llm" | "ended";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * «30 sep a las 16:42» en hora de Colombia. A mano (solo partes numéricas de Intl): el
 * texto de toLocaleString cambia entre el ICU de Node y el del navegador y rompe la hidratación.
 */
function fechaInicio(iso: string): string {
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
  return `${Number(partes.day)} ${MESES[Number(partes.month) - 1]} a las ${partes.hour}:${partes.minute}`;
}

/** Para empezar sin pensar qué escribir. */
const SUGERENCIAS = ["Hola, ¿qué es esto?", "¿Me das un teléfono de ayuda?", "Me siento muy mal"];

/** Con estos mensajes de la persona ya hay suficiente para pasar al siguiente paso. */
const MENSAJES_PARA_SEGUIR = 4;

function interpolate(content: string, answers: Record<string, string>): string {
  return content.replace(/\{(\w+)\}/g, (match, key) => answers[key] ?? match);
}

// Marcador con el que el asistente "envía" un material del storyboard.
// El bloque de identidad se lo enseña; acá se convierte en el archivo real.
const ATTACHMENT_MARKER = /\[\[adjunto:([0-9a-fA-F-]+)\]\]/g;

type MessageSegment =
  | { kind: "text"; value: string }
  | { kind: "attachment"; id: string };

function splitAttachmentMarkers(text: string): MessageSegment[] {
  // Un marcador a medio streamear al final se oculta hasta completarse
  const clean = text.replace(/\[\[adjunto:[^\]]*$/, "");
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  for (const match of clean.matchAll(ATTACHMENT_MARKER)) {
    const before = clean.slice(lastIndex, match.index).trim();
    if (before) segments.push({ kind: "text", value: before });
    segments.push({ kind: "attachment", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  const rest = clean.slice(lastIndex).trim();
  if (rest) segments.push({ kind: "text", value: rest });
  return segments;
}

function AttachmentBubble({
  attachment,
  url,
}: {
  attachment: StoryboardAttachment | undefined;
  url: string;
}) {
  if (!attachment) {
    return (
      <p className="text-xs italic text-neutral-500">(material no disponible)</p>
    );
  }
  const kind = attachmentKind(attachment.type);
  if (kind === "imagen") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.name}
          className="rounded-lg border border-neutral-200 max-h-64 w-auto"
        />
      </a>
    );
  }
  if (kind === "video") {
    return (
      <video controls src={url} className="rounded-lg max-h-64 w-full bg-black" />
    );
  }
  if (kind === "audio") {
    return <audio controls src={url} className="w-64 max-w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 hover:bg-neutral-100 transition-colors"
    >
      <FileTextIcon className="h-6 w-6 text-neutral-600 flex-shrink-0" />
      <span className="text-sm text-neutral-900 truncate flex-1">
        {attachment.name}
      </span>
      <DownloadIcon className="h-4 w-4 text-neutral-500 flex-shrink-0" />
    </a>
  );
}

function localMessage(text: string, sender: "user" | "assistant"): ChatMessage {
  return {
    id: uid(),
    text,
    sender,
    timestamp: new Date().toISOString(),
  };
}

export function ChatClient({
  workspaceSlug,
  assistantName,
  flowSteps,
  initialMessages,
  testHecho = false,
  storyboardAttachments = [],
}: {
  workspaceSlug: string;
  assistantName: string;
  flowSteps: PreviewStep[];
  initialMessages: ChatMessage[];
  /** Las situaciones difíciles ya pasaron: el siguiente paso es WhatsApp. */
  testHecho?: boolean;
  storyboardAttachments?: StoryboardAttachment[];
}) {
  const nombre = assistantName.trim() || "tu asistente";
  const attachmentsById = new Map(
    storyboardAttachments.map((att) => [att.id, att])
  );
  // Si la conversación ya tiene mensajes, el onboarding ya corrió.
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [mode, setMode] = useState<Mode>(
    initialMessages.length === 0 && flowSteps.length > 0 ? "onboarding" : "llm"
  );
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isBusy = isTyping || isStreaming;
  // La prueba es compartida por el equipo: si ya tenía mensajes, se avisa desde cuándo.
  const [inicioPrevio, setInicioPrevio] = useState<string | null>(
    initialMessages[0]?.timestamp ?? null
  );
  const mensajesPersona = messages.filter((m) => m.sender === "user").length;

  // Estado del flujo de onboarding (solo cliente; el transcript se persiste)
  const flowIndexRef = useRef(0);
  const answersRef = useRef<Record<string, string>>({});
  const startedRef = useRef(false);
  // Antes de aceptar no se guarda nada: los mensajes esperan acá.
  const hasConsentStep = flowSteps.some((step) => step.type === "consent");
  const pendingConsentRef = useRef(hasConsentStep);
  const bufferRef = useRef<{ role: "user" | "assistant"; text: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const persistMessages = async (
    toPersist: { role: "user" | "assistant"; text: string }[]
  ) => {
    if (pendingConsentRef.current) {
      bufferRef.current.push(...toPersist);
      return;
    }
    try {
      await fetch(`/api/workspaces/${workspaceSlug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "append", messages: toPersist }),
      });
    } catch {
      // El chat sigue funcionando en memoria; solo falla la persistencia.
    }
  };

  /**
   * Avanza el flujo de onboarding desde `fromIndex`: emite mensajes del bot
   * hasta la próxima pregunta (espera respuesta) o el fin (pasa a modo LLM).
   */
  const advanceFlow = async (fromIndex: number) => {
    const botTexts: string[] = [];
    let i = fromIndex;
    let finished = false;

    while (i < flowSteps.length) {
      const step = flowSteps[i];
      const text = interpolate(step.content, answersRef.current).trim();
      if (step.type === "question" || step.type === "consent") {
        if (text) botTexts.push(text);
        break;
      }
      if (text) botTexts.push(text);
      i++;
      if (step.type === "end") {
        finished = true;
        break;
      }
    }
    if (i >= flowSteps.length) finished = true;

    flowIndexRef.current = i;

    for (const text of botTexts) {
      setIsTyping(true);
      await sleep(700);
      setIsTyping(false);
      setMessages((prev) => [...prev, localMessage(text, "assistant")]);
    }
    if (botTexts.length) {
      await persistMessages(botTexts.map((text) => ({ role: "assistant" as const, text })));
    }

    if (finished) setMode("llm");
  };

  // Arranque del onboarding en conversaciones nuevas
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (mode === "onboarding" && initialMessages.length === 0) {
      advanceFlow(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendToLlm = async (text: string) => {
    // Sin respuesta, el mensaje no se guardó: sale de la conversación y vuelve a la caja
    // para reintentarlo.
    const deshacer = () => {
      setMessages((prev) => {
        const i = prev.map((m) => m.sender === "user" && m.text === text).lastIndexOf(true);
        return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
      });
      setInputValue((actual) => actual || text);
    };
    setIsTyping(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "message", message: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? `${nombre} no respondió. Intenta de nuevo en unos minutos.`);
        deshacer();
        return;
      }

      if (!res.body) {
        toast.error(`${nombre} no respondió. Intenta de nuevo en unos minutos.`);
        deshacer();
        return;
      }

      setIsStreaming(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const messageId = uid();
      let accumulated = "";
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snapshot = accumulated;
        if (!started) {
          started = true;
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            { ...localMessage(snapshot, "assistant"), id: messageId },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, text: snapshot } : msg
            )
          );
        }
      }
    } catch {
      toast.error("No pudimos enviar el mensaje. Revisa tu conexión e intenta de nuevo.");
      deshacer();
    } finally {
      setIsTyping(false);
      setIsStreaming(false);
    }
  };

  const handleSendMessage = async (sugerencia?: string) => {
    const text = (sugerencia ?? inputValue).trim();
    if (!text || isBusy) return;
    if (!sugerencia) setInputValue("");
    setMessages((prev) => [...prev, localMessage(text, "user")]);

    if (mode === "onboarding" && flowSteps[flowIndexRef.current]?.type === "consent") {
      const decision = evaluarConsentimiento(text);
      if (decision === "acepta") {
        pendingConsentRef.current = false;
        const buffered = bufferRef.current;
        bufferRef.current = [];
        await persistMessages([...buffered, { role: "user", text }]);
        await advanceFlow(flowIndexRef.current + 1);
      } else if (decision === "rechaza") {
        // No se guarda ningún dato: el buffer se descarta.
        bufferRef.current = [];
        setMessages((prev) => [...prev, localMessage(DESPEDIDA_RECHAZO, "assistant")]);
        setMode("ended");
      } else {
        setIsTyping(true);
        await sleep(500);
        setIsTyping(false);
        setMessages((prev) => [...prev, localMessage(PREGUNTA_CONSENTIMIENTO, "assistant")]);
      }
      return;
    }

    if (mode === "onboarding") {
      const currentStep = flowSteps[flowIndexRef.current];
      // Persistir el mensaje crudo y extraer el valor limpio son independientes
      const persisting = persistMessages([{ role: "user", text }]);
      if (currentStep?.type === "question" && currentStep.variable && currentStep.options?.length) {
        answersRef.current = {
          ...answersRef.current,
          [currentStep.variable]: matchOption(currentStep.options, text),
        };
      } else if (currentStep?.type === "question" && currentStep.variable) {
        // El valor limpio, no la frase entera ("Me llamo Daniel" → "Daniel")
        setIsTyping(true);
        const value = await extractVariable(workspaceSlug, {
          question: currentStep.content,
          variable: currentStep.variable,
          answer: text,
        });
        setIsTyping(false);
        answersRef.current = { ...answersRef.current, [currentStep.variable]: value };
      }
      await persisting;
      await advanceFlow(flowIndexRef.current + 1);
    } else {
      await sendToLlm(text);
    }
  };

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await fetch(`/api/workspaces/${workspaceSlug}/chat`, { method: "DELETE" });
      setMessages([]);
      setInicioPrevio(null);
      answersRef.current = {};
      flowIndexRef.current = 0;
      pendingConsentRef.current = hasConsentStep;
      bufferRef.current = [];
      if (flowSteps.length > 0) {
        setMode("onboarding");
        await advanceFlow(0);
      } else {
        setMode("llm");
      }
      toast.success("Empezaste una prueba nueva");
    } catch {
      toast.error("No pudimos empezar de nuevo. Intenta otra vez.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      <ProbarNav workspaceSlug={workspaceSlug} assistantName={assistantName} testHecho={testHecho} />

      <div className="max-w-3xl mx-auto space-y-4">
        {inicioPrevio && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <p>
              Sigues una prueba que empezó el {fechaInicio(inicioPrevio)}. Para empezar de cero, usa
              «Empezar de nuevo» arriba del chat.
            </p>
          </div>
        )}

        <Card className="h-[calc(100dvh-14rem)] min-h-[480px] flex flex-col overflow-hidden shadow-lg border border-neutral-200 py-0 gap-0">
          {/* Encabezado del chat */}
          <div className="bg-neutral-900 text-white px-6 py-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-neutral-900 font-bold text-xl">
                {assistantName.charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-lg truncate">{assistantName}</div>
              <div className="text-sm text-neutral-400">Vista previa de WhatsApp</div>
            </div>
            {messages.length > 0 && (
              <ConfirmDialog
                title="¿Empezar de nuevo?"
                description="La prueba nueva arranca desde la bienvenida."
                confirmLabel="Empezar de nuevo"
                destructive={false}
                onConfirm={handleReset}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isResetting || isBusy}
                  className="flex-shrink-0 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                >
                  <RotateCcwIcon className="mr-1.5 h-4 w-4" />
                  {isResetting ? "Empezando…" : "Empezar de nuevo"}
                </Button>
              </ConfirmDialog>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto bg-neutral-50 p-6 space-y-6">
            {messages.length === 0 && !isTyping && (
              <div className="mx-auto max-w-md pt-8 text-center text-sm text-neutral-600">
                {flowSteps.length === 0 ? (
                  <p>
                    {nombre.charAt(0).toUpperCase() + nombre.slice(1)} todavía no tiene bienvenida
                    ni aviso de privacidad, así que la prueba empieza directo con la conversación.{" "}
                    <Link
                      href={`/${workspaceSlug}/bienvenida`}
                      className="font-medium text-neutral-900 underline underline-offset-2"
                    >
                      Escribir la bienvenida →
                    </Link>
                  </p>
                ) : (
                  <p>Escribe como lo haría una persona de tu programa.</p>
                )}
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex gap-3 max-w-[80%] ${
                    message.sender === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar for assistant */}
                  {message.sender === "assistant" && (
                    <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {assistantName.charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className="flex flex-col">
                    <div
                      className={`rounded-2xl px-5 py-3.5 ${
                        message.sender === "user"
                          ? "bg-neutral-900 text-white shadow-sm"
                          : "bg-white text-neutral-900 border border-neutral-200 shadow-sm"
                      }`}
                    >
                      {message.sender === "assistant" ? (
                        <div className="text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_strong]:font-semibold [&_a]:text-blue-600 [&_a]:underline [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:text-[0.85em]">
                          {splitAttachmentMarkers(message.text).map((segment, i) =>
                            segment.kind === "text" ? (
                              <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
                                {segment.value}
                              </ReactMarkdown>
                            ) : (
                              <AttachmentBubble
                                key={i}
                                attachment={attachmentsById.get(segment.id)}
                                url={`/api/workspaces/${workspaceSlug}/program/attachments/${segment.id}`}
                              />
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.text}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs text-neutral-600 mt-1.5 px-2 ${
                        message.sender === "user" ? "text-right" : "text-left"
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="text-white font-bold text-sm">
                      {assistantName.charAt(0)}
                    </span>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 shadow-md">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 bg-neutral-300 rounded-full animate-bounce" />
                      <div
                        className="w-2.5 h-2.5 bg-neutral-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2.5 h-2.5 bg-neutral-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white border-t-2 border-neutral-200 p-5">
            {mode === "llm" && mensajesPersona === 0 && !isBusy && (
              <div className="mb-3 flex flex-wrap gap-2">
                {SUGERENCIAS.map((texto) => (
                  <button
                    key={texto}
                    type="button"
                    onClick={() => handleSendMessage(texto)}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                  >
                    {texto}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  mode === "ended"
                    ? "La persona no aceptó. Empieza de nuevo para probar otra vez."
                    : "Escribe un mensaje…"
                }
                disabled={isBusy || mode === "ended"}
                className="flex-1 h-12 px-5 border-2 border-neutral-300 rounded-xl focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/10 text-base"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isBusy || mode === "ended"}
                aria-label="Enviar mensaje"
                className="h-12 px-6 bg-neutral-900 hover:bg-neutral-800 rounded-xl"
              >
                <SendIcon className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-xs text-neutral-600 mt-3 px-1">
              Es una prueba: no le llega a nadie.
            </p>
          </div>
        </Card>

        {mensajesPersona >= MENSAJES_PARA_SEGUIR && (
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href={testHecho ? `/${workspaceSlug}/whatsapp` : `/${workspaceSlug}/chat/casos`}>
                {testHecho
                  ? "¿Se ve bien? Siguiente: conectar WhatsApp →"
                  : "¿Se ve bien? Siguiente: revisar situaciones difíciles →"}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
