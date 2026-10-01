"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pestañas de Operar: Cómo va | Conversaciones | Protocolo ante riesgo (las mismas del menú). */
export function OperarNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/${workspaceSlug}/operar`, label: "Cómo va" },
    { href: `/${workspaceSlug}/conversations`, label: "Conversaciones" },
    { href: `/${workspaceSlug}/operar/protocolo`, label: "Protocolo ante riesgo" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200" aria-label="Cómo va tu programa">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
