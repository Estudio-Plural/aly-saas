"use client";

import { Bot, User } from "lucide-react";

export function ChatDemo() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
      {/* Header del chat */}
      <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-neutral-900 text-white">
          <Bot className="size-[18px]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-900">Facilitador IA</div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            En línea
          </div>
        </div>
      </div>

      {/* Mensajes */}
      <div className="space-y-4 bg-neutral-50/50 px-4 py-6">
        <div className="flex items-start gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
            <User className="size-3.5" />
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-neutral-700 shadow-sm">
            ¿Cómo puedo prepararme mejor para la sesión de mañana?
          </div>
        </div>

        <div className="flex items-start justify-end gap-2.5">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-sm">
            <p>Te recomiendo revisar la guía de preparación del módulo 2.</p>
            <p className="mt-2">
              En resumen: armá una lista de situaciones difíciles de la semana y pensá qué harías diferente.
            </p>
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
            <Bot className="size-3.5" />
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
            <User className="size-3.5" />
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-neutral-700 shadow-sm">
            Perfecto, gracias. ¿Necesito llevar algo?
          </div>
        </div>

        <div className="flex items-start justify-end gap-2.5">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-sm">
            <p>Solo tu cuaderno de reflexiones. 📓</p>
            <p className="mt-2">Te espero mañana a las 10:00.</p>
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
            <Bot className="size-3.5" />
          </div>
        </div>

        {/* Indicador de escritura */}
        <div className="flex items-start justify-end gap-2.5">
          <div className="flex max-w-[60%] items-center gap-1 rounded-2xl rounded-tr-sm bg-neutral-100 px-4 py-3 text-neutral-500 shadow-sm">
            <span
              className="size-1.5 rounded-full bg-neutral-400 animate-typing-dot"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="size-1.5 rounded-full bg-neutral-400 animate-typing-dot"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="size-1.5 rounded-full bg-neutral-400 animate-typing-dot"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
            <Bot className="size-3.5" />
          </div>
        </div>
      </div>

      {/* Input fake */}
      <div className="border-t border-neutral-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2">
          <span className="text-sm text-neutral-400">Escribí un mensaje...</span>
        </div>
      </div>
    </div>
  );
}
