"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2Icon,
  CircleIcon,
  CompassIcon,
  MenuIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import {
  DESIGN_STEPS,
  isDesignDone,
  type ProgramProgress,
} from "@/lib/design";

type NavItem = { name: string; href: string; done?: boolean };
type NavSection = { title: string; done: boolean; href?: string; items: NavItem[] };

function Check({ done, className = "" }: { done: boolean; className?: string }) {
  return done ? (
    <CheckCircle2Icon
      aria-label="Hecho"
      className={`h-4 w-4 flex-shrink-0 text-green-600 ${className}`}
    />
  ) : (
    <CircleIcon
      aria-label="Pendiente"
      className={`h-4 w-4 flex-shrink-0 text-neutral-300 ${className}`}
    />
  );
}

/**
 * Menú del programa por ciclo de vida: Diseñar → Probar → Conectar WhatsApp →
 * Operar, cada sección con su check de «hecho» (estado real de la DB). En
 * móvil se colapsa detrás del botón «Menú».
 */
export function WorkspaceSidebar({
  workspace,
  progress,
}: {
  workspace: string;
  progress: ProgramProgress;
}) {
  const pathname = usePathname();
  // El menú móvil queda abierto solo en la página donde se abrió: al navegar
  // se cierra solo.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  const base = `/${workspace}`;
  const sections: NavSection[] = [
    {
      title: "Diseñar",
      done: isDesignDone(progress),
      items: DESIGN_STEPS.map((step) => ({
        name: step.label,
        href: `${base}/${step.path}`,
        done: progress.design[step.key],
      })),
    },
    { title: "Probar", done: progress.test, href: `${base}/chat`, items: [] },
    {
      title: "Conectar WhatsApp",
      done: progress.connect,
      href: `${base}/whatsapp`,
      items: [],
    },
    {
      title: "Operar",
      done: progress.operate,
      items: [
        { name: "Cifras", href: `${base}/operar` },
        { name: "Conversaciones", href: `${base}/conversations` },
        { name: "Protocolo ante riesgo", href: `${base}/operar/protocolo` },
      ],
    },
  ];

  const allItems = [
    { name: "Primeros pasos", href: base },
    ...sections.flatMap((s) => (s.href ? [{ name: s.title, href: s.href }] : s.items)),
    { name: "Ajustes", href: `${base}/settings` },
  ];
  const current =
    allItems.find((item) => item.href === pathname)?.name ??
    allItems.find((item) => item.href !== base && pathname.startsWith(`${item.href}/`))?.name ??
    "Menú";

  // Una sección con pestañas (Probar: chat y casos) queda activa en sus subpáginas.
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
      active
        ? "bg-neutral-100 font-medium text-neutral-900"
        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
    }`;

  const nav = (
    <nav aria-label="Secciones del programa" className="space-y-5">
      <Link
        href={base}
        className={linkClass(pathname === base)}
        aria-current={pathname === base ? "page" : undefined}
      >
        <CompassIcon className="h-4 w-4 flex-shrink-0" />
        Primeros pasos
      </Link>

      {sections.map((section, index) =>
        section.href ? (
          <Link
            key={section.title}
            href={section.href}
            className={`${linkClass(isActive(section.href))} font-medium`}
            aria-current={isActive(section.href) ? "page" : undefined}
          >
            <span className="w-4 text-center text-xs text-neutral-500">{index + 1}</span>
            <span className="flex-1">{section.title}</span>
            <Check done={section.done} />
          </Link>
        ) : (
          <div key={section.title}>
            <div className="flex items-center gap-2.5 px-3 pb-1 text-sm font-medium text-neutral-900">
              <span className="w-4 text-center text-xs text-neutral-500">{index + 1}</span>
              <span className="flex-1">{section.title}</span>
              <Check done={section.done} />
            </div>
            <ul className="ml-[1.4rem] space-y-0.5 border-l border-neutral-200 pl-2">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={linkClass(pathname === item.href)}
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    <span className="flex-1">{item.name}</span>
                    {item.done !== undefined && <Check done={item.done} />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      <div className="border-t border-neutral-200 pt-3">
        <Link
          href={`${base}/settings`}
          className={linkClass(pathname === `${base}/settings`)}
          aria-current={pathname === `${base}/settings` ? "page" : undefined}
        >
          <SettingsIcon className="h-4 w-4 flex-shrink-0" />
          Ajustes
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* Móvil: menú colapsable */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpenAt(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="menu-programa"
          className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-900"
        >
          {open ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          <span className="flex-1 text-left">{open ? "Cerrar menú" : current}</span>
        </button>
        {open && (
          <div
            id="menu-programa"
            className="mt-2 rounded-lg border border-neutral-200 bg-white p-2"
          >
            {nav}
          </div>
        )}
      </div>

      {/* Escritorio */}
      <aside className="hidden w-64 flex-shrink-0 md:block">{nav}</aside>
    </>
  );
}
