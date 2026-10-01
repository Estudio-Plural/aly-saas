"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckIcon } from "lucide-react";

/**
 * Encabezado de Probar, igual en las dos pestañas: H1, un solo subtítulo y las
 * pestañas en el orden del flujo (1. Situaciones difíciles | 2. Conversar). La 1
 * lleva check cuando la última prueba pasó los chequeos de seguridad.
 */
export function ProbarNav({
  workspaceSlug,
  assistantName,
  testHecho = false,
}: {
  workspaceSlug: string;
  assistantName?: string;
  testHecho?: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: `/${workspaceSlug}/chat/casos`, label: "1. Situaciones difíciles", hecho: testHecho },
    { href: `/${workspaceSlug}/chat`, label: "2. Conversar", hecho: false },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Probar</h1>
        <p className="mt-1 text-neutral-700">
          Revisa cómo responde {assistantName?.trim() || "tu asistente"} en situaciones difíciles y
          después conversa libremente.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-neutral-200" aria-label="Pasos de Probar">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {tab.label}
              {tab.hecho && (
                <CheckIcon aria-label="Hecho" className="h-4 w-4 text-green-600" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
