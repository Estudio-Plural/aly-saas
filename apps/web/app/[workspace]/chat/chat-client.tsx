"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SendIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage, OnboardingStep } from "@/lib/workspaces";

type Mode = "onboarding" | "llm";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function interpolate(content: string, answers: Record<string, string>): string {
  return content.replace(/\{(\w+)\}/g, (match, key) => answers[key] ?? match);
}

function localMessage(text: string, sender: "user" | "assistant"): ChatMessage {
  return {
    id: crypto.randomUUID(),
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
  llmConfigured,
}: {
  workspaceSlug: string;
  assistantName: string;
  flowSteps: OnboardingStep[];
  initialMessages: ChatMessage[];
  llmConfigured: boolean;
}) {
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

  // Estado del flujo de onboarding (solo cliente; el transcript se persiste)
  const flowIndexRef = useRef(0);
  const answersRef = useRef<Record<string, string>>({});
  const startedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const persistMessages = async (
    toPersist: { role: "user" | "assistant"; text: string }[]
  ) => {
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
      if (step.type === "question") {
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
    setIsTyping(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "message", message: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo obtener respuesta del asistente");
        return;
      }

      // Sin API key configurada el endpoint responde JSON; con LLM, streamea texto.
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const reply = data.messages?.find(
          (msg: ChatMessage) => msg.sender === "assistant"
        );
        if (reply) setMessages((prev) => [...prev, reply]);
        return;
      }

      if (!res.body) {
        toast.error("El asistente no devolvió respuesta");
        return;
      }

      setIsStreaming(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const messageId = crypto.randomUUID();
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
      toast.error("Error de conexión con el asistente");
    } finally {
      setIsTyping(false);
      setIsStreaming(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isBusy) return;
    setInputValue("");
    setMessages((prev) => [...prev, localMessage(text, "user")]);

    if (mode === "onboarding") {
      const currentStep = flowSteps[flowIndexRef.current];
      if (currentStep?.type === "question" && currentStep.variable) {
        answersRef.current = { ...answersRef.current, [currentStep.variable]: text };
      }
      await persistMessages([{ role: "user", text }]);
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
      answersRef.current = {};
      flowIndexRef.current = 0;
      if (flowSteps.length > 0) {
        setMode("onboarding");
        await advanceFlow(0);
      } else {
        setMode("llm");
      }
      toast.success("Conversación reiniciada");
    } catch {
      toast.error("No se pudo reiniciar la conversación");
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Vista Previa del Chat
          </h1>
          <p className="text-neutral-700 mt-1">
            Probá tu asistente con tu flujo de onboarding y tu base de conocimiento
          </p>
        </div>
        <Button
          onClick={handleReset}
          disabled={isResetting || isBusy}
          variant="outline"
          className="px-6 py-3 h-auto text-base font-semibold"
        >
          <RotateCcwIcon className="mr-2 h-5 w-5" />
          {isResetting ? "Reiniciando..." : "Reiniciar Conversación"}
        </Button>
      </div>

      {/* Chat Interface */}
      <div className="max-w-3xl mx-auto">
        <Card className="h-[700px] flex flex-col overflow-hidden shadow-lg border border-neutral-200">
          {/* Chat Header */}
          <div className="bg-blue-600 text-white px-6 py-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold text-xl">
                {assistantName.charAt(0)}
              </span>
            </div>
            <div>
              <div className="font-bold text-lg">{assistantName}</div>
              <div className="text-sm text-blue-100">Asistente virtual</div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto bg-neutral-50 p-6 space-y-6">
            {messages.length === 0 && !isTyping && (
              <div className="text-center text-sm text-neutral-500 pt-10">
                Escribí un mensaje para empezar la conversación
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
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
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
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-white text-neutral-900 border border-neutral-200 shadow-sm"
                      }`}
                    >
                      {message.sender === "assistant" ? (
                        <div className="text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_strong]:font-semibold [&_a]:text-blue-600 [&_a]:underline [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:text-[0.85em]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.text}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs text-neutral-500 mt-1.5 px-2 ${
                        message.sender === "user" ? "text-right" : "text-left"
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString("es-AR", {
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
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="text-white font-bold text-sm">
                      {assistantName.charAt(0)}
                    </span>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 shadow-md">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full animate-bounce" />
                      <div
                        className="w-2.5 h-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2.5 h-2.5 bg-gradient-to-br from-pink-500 to-blue-500 rounded-full animate-bounce"
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
            <div className="flex gap-3">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Escribí un mensaje..."
                disabled={isBusy}
                className="flex-1 h-12 px-5 border-2 border-neutral-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isBusy}
                aria-label="Enviar mensaje"
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg rounded-xl"
              >
                <SendIcon className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-3 px-1">
              {llmConfigured
                ? "Presioná Enter para enviar • La conversación se guarda en tu workspace"
                : "Presioná Enter para enviar • Configurá OPENROUTER_API_KEY para respuestas reales del asistente"}
            </p>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200 p-4">
        <div className="flex gap-3">
          <div className="text-blue-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900 mb-1">
              Acerca de esta vista previa
            </h3>
            <p className="text-sm text-neutral-700">
              Las conversaciones nuevas arrancan con tu flujo de Onboarding y después
              responde el asistente usando los documentos de texto de tu Base de
              Conocimiento. Todo se guarda en la base de datos del workspace.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
