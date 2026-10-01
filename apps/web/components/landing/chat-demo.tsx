"use client";

import { Bot, User } from "lucide-react";

// Conversación de ejemplo (estática): muestra una respuesta con tus materiales
// y un límite con derivación a una línea de apoyo.
export function ChatDemo() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
      {/* Header del chat */}
      <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-neutral-900 text-white">
          <Bot className="size-[18px]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-900">Lía · Cuidar a quien cuida</div>
          <div className="text-xs text-neutral-500">Por WhatsApp</div>
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
              En resumen: haz una lista de situaciones difíciles de la semana y piensa qué harías diferente.
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
            A veces siento que ya no puedo más.
          </div>
        </div>

        <div className="flex items-start justify-end gap-2.5">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-sm">
            <p>Gracias por contármelo. Esto es importante y no tienes que cargarlo a solas.</p>
            <p className="mt-2">
              Puedes llamar gratis a la línea de apoyo de tu programa, a cualquier hora. ¿Quieres que sigamos hablando mientras tanto?
            </p>
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
            <Bot className="size-3.5" />
          </div>
        </div>
      </div>

      {/* Pie estático: deja claro que es un ejemplo, no un chat funcional */}
      <div className="border-t border-neutral-100 bg-white px-4 py-3 text-center text-xs text-neutral-400">
        Ejemplo de conversación
      </div>
    </div>
  );
}
