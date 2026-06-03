"use client";

import { useState, useEffect, useRef, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SendIcon, PlayIcon } from "lucide-react";
import { getWorkspaceBySlug } from "@/lib/workspaces";

type Message = {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: string; // Use string instead of Date to avoid hydration mismatch
};

const DEMO_CONVERSATION = [
  {
    text: "Hola, ¿cómo puedo ayudarte hoy?",
    sender: "assistant" as const,
    delay: 1000,
  },
  {
    text: "Hola! ¿Qué productos tenés disponibles?",
    sender: "user" as const,
    delay: 2000,
  },
  {
    text: "¡Claro! Tenemos una amplia variedad de productos. Contamos con categorías como electrónica, hogar, deportes y moda. ¿Hay alguna categoría en particular que te interese?",
    sender: "assistant" as const,
    delay: 2500,
  },
  {
    text: "Me interesa ver productos de electrónica",
    sender: "user" as const,
    delay: 1500,
  },
  {
    text: "Perfecto! En nuestra sección de electrónica encontrarás smartphones, tablets, laptops, auriculares y accesorios. También tenemos ofertas especiales esta semana. ¿Te gustaría que te muestre algún producto específico o las ofertas actuales?",
    sender: "assistant" as const,
    delay: 3000,
  },
];

export default function ChatPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = use(params);
  const workspace = getWorkspaceBySlug(workspaceSlug);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: `¡Hola! Soy ${workspace.assistant_name}, tu asistente virtual. ¿En qué puedo ayudarte?`,
      sender: "assistant",
      timestamp: "2026-06-01T14:30:00",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const addMessage = (text: string, sender: "user" | "assistant") => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || isSimulating) return;

    addMessage(inputValue, "user");
    setInputValue("");

    // Simulate assistant response
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      addMessage(
        "Gracias por tu mensaje. Esta es una respuesta de demostración. En producción, aquí aparecería la respuesta real del asistente basada en tu configuración.",
        "assistant"
      );
    }, 2000);
  };

  const handleSimulateConversation = async () => {
    if (isSimulating) return;

    setIsSimulating(true);
    setMessages([
      {
        id: "sim-start",
        text: `¡Hola! Soy ${workspace.assistant_name}, tu asistente virtual. ¿En qué puedo ayudarte?`,
        sender: "assistant",
        timestamp: new Date().toISOString(),
      },
    ]);

    for (const demoMsg of DEMO_CONVERSATION) {
      await new Promise((resolve) => setTimeout(resolve, demoMsg.delay));

      if (demoMsg.sender === "assistant") {
        setIsTyping(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setIsTyping(false);
      }

      addMessage(demoMsg.text, demoMsg.sender);
    }

    setIsSimulating(false);
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
            Probá cómo se ve tu asistente en conversación
          </p>
        </div>
        <Button
          onClick={handleSimulateConversation}
          disabled={isSimulating}
          className="bg-green-600 hover:bg-green-700 text-white shadow-md px-6 py-3 h-auto text-base font-semibold"
        >
          <PlayIcon className="mr-2 h-5 w-5" />
          {isSimulating ? "Simulando..." : "Simular Conversación"}
        </Button>
      </div>

      {/* Chat Interface */}
      <div className="max-w-3xl mx-auto">
        <Card className="h-[700px] flex flex-col overflow-hidden shadow-lg border border-neutral-200">
          {/* Chat Header */}
          <div className="bg-blue-600 text-white px-6 py-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold text-xl">
                {workspace.assistant_name.charAt(0)}
              </span>
            </div>
            <div>
              <div className="font-bold text-lg">{workspace.assistant_name}</div>
              <div className="text-sm text-blue-100">Asistente virtual</div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto bg-neutral-50 p-6 space-y-6">
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
                        {workspace.assistant_name.charAt(0)}
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
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.text}
                      </p>
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
                      {workspace.assistant_name.charAt(0)}
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
                disabled={isSimulating}
                className="flex-1 h-12 px-5 border-2 border-neutral-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSimulating}
                aria-label="Enviar mensaje"
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg rounded-xl"
              >
                <SendIcon className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-3 px-1">
              Presioná Enter para enviar • Este es un entorno de prueba
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
              Esta es una simulación de cómo se verá tu asistente en WhatsApp.
              Los mensajes y respuestas son ejemplos. Para configurar el
              comportamiento real del asistente, usá las secciones de
              Conocimiento y Onboarding.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
