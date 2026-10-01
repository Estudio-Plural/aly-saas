"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";

/**
 * Encabezado de la app (dashboard, admin y cada asistente).
 * Izquierda: «Pl&ral IA Conversational» → /dashboard, y dentro de un asistente
 * «/ {asistente}» con «para {programa}» en gris. Derecha: menú de la persona.
 * Solo lo usan los layouts; no recibe datos que no se puedan mostrar a quien mira:
 * `orgName` solo llega cuando quien mira es del equipo Plural.
 */
export function AppHeader({
  email,
  esPlural,
  portalUrl,
  assistantName,
  programName,
  orgName,
  count,
}: {
  email: string;
  esPlural: boolean;
  portalUrl: string;
  /** Dentro de un asistente: su nombre. */
  assistantName?: string;
  /** Dentro de un asistente: el programa al que acompaña. */
  programName?: string;
  /** Solo para el equipo Plural: la organización del asistente. */
  orgName?: string;
  /** Cuántos asistentes ve la persona; con más de 1 aparece «Todos tus asistentes». */
  count?: number;
}) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="container mx-auto flex h-14 items-center gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link
            href="/dashboard"
            className="flex flex-shrink-0 items-center gap-2 rounded-md text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
            aria-label="Plural IA Conversacional: inicio"
          >
            <PluralLockup />
            <span className="hidden text-[15px] font-medium text-neutral-600 sm:inline">
              Conversacional
            </span>
          </Link>
          {assistantName && (
            <>
              <span className="text-neutral-300" aria-hidden="true">
                /
              </span>
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm font-semibold text-neutral-900">
                  {assistantName}
                </span>
                {programName && (
                  <span className="hidden truncate text-sm text-neutral-500 md:inline">
                    para {programName}
                  </span>
                )}
              </span>
              {esPlural && orgName && (
                <span className="hidden flex-shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600 lg:inline">
                  {orgName}
                </span>
              )}
            </>
          )}
        </div>

        {assistantName && count !== undefined && count > 1 && (
          <Link
            href="/dashboard"
            className="hidden flex-shrink-0 text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline sm:inline"
          >
            {esPlural ? "Todos los asistentes" : "Todos tus asistentes"}
          </Link>
        )}

        <UserMenu email={email} esPlural={esPlural} portalUrl={portalUrl} />
      </div>
    </header>
  );
}

/** Lockup «Pl&ral IA» de la suite (estilos en plural-tokens.css). */
function PluralLockup() {
  return (
    <span className="pl-lockup text-[17px]" role="img" aria-label="Plural IA">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 235.96 71.32" aria-hidden="true">
        <path d="M116.45 61.78C114.71 57.81 115.04 53.35 116.12 49.14C117.19 45.09 118.93 41.03 119.84 36.9C121.57 30.22 120.5 23.86 116.7 21.23C113.06 19.01 110.41 21.71 111.4 26C113.06 32.68 117.77 44.93 112.07 56.69C110.99 58.76 109.58 60.75 108.01 62.42C99.08 71.32 84.12 69.57 78.91 59.71C75.44 53.91 78.33 44.13 85.11 39.92C88.5 37.77 90.73 37.53 93.79 36.02C102.89 31.65 103.8 21.16 97.76 16.7C91.89 12.81 84.28 18.77 85.94 22.75C86.85 24.81 89.82 25.29 91.56 25.69C99.41 27.83 96.19 37.06 88.83 36.42C79.98 35.31 78 21.95 85.69 15.59C88.58 13.28 92.72 12.25 96.35 13.44C99.74 14.48 102.47 17.34 103.47 20.68C105.12 26.24 102.89 31.73 98.59 35.55C96.11 37.93 93.13 39.6 90.57 41.83C89.08 43.1 87.75 44.69 87.09 46.52C84.03 55.26 96.27 62.42 104.29 55.74C109.92 51.13 111.07 42.14 109.34 32.84C108.67 29.5 107.85 26.16 108.1 22.75C108.18 20.68 108.67 18.53 109.83 16.78C112.81 12.01 120.25 11.22 124.39 15.51C129.51 20.84 127.78 31.25 123.31 39.6C121.49 43.26 119.09 46.83 117.94 50.81C116.78 54.71 116.86 59.32 119.59 62.58C120.25 63.37 121.16 64.09 122.15 64.01C123.48 63.93 124.39 62.58 124.3 61.38C124.3 60.19 123.56 59.08 122.73 58.12C121.9 57.25 120.91 56.45 120.25 55.42C118.43 52.96 118.68 49.3 120.75 46.99C125.54 41.67 135.38 44.69 135.8 55.74C135.8 61.7 133.07 67.43 126.78 68.3C122.48 68.7 118.18 65.68 116.45 61.78" />
        <path d="M38.74 20.95C38.74 14.27 34.86 10.48 27.72 10.48L12.19 10.48L12.19 31.34L27.72 31.34C34.86 31.34 38.74 27.63 38.74 20.95M51.02 20.95C51.02 33.32 43.07 41.81 28.27 41.81L12.19 41.81L12.19 64.3L0 64.3L0 0L28.27 0C43.07 0 51.02 8.49 51.02 20.95" />
        <path d="M57.8 0h11.38v64.29h-11.38Z" />
        <path d="M171.65 17.16L171.65 27.63L168.76 27.63C160.36 27.63 155.31 31.79 155.31 40.64L155.31 64.3L143.93 64.3L143.93 17.7L154.95 17.7L154.95 26.01C157.2 20.77 161.63 16.98 168.85 16.98C169.85 16.98 170.66 16.98 171.65 17.16" />
        <path d="M205.17 45.87L205.17 41.63C204 42.71 202.28 43.25 199.84 43.53L193.7 44.25C187.38 44.97 185.3 47.23 185.3 50.93C185.3 54.81 187.92 57.25 193.16 57.25C199.21 57.25 205.17 54 205.17 45.87M206.7 64.3C205.98 63.03 205.62 60.86 205.44 58.61C202.37 62.94 197.31 65.38 190.45 65.38C180.52 65.38 173.65 60.41 173.65 51.38C173.65 43.62 178.35 38.11 191.53 36.84L198.58 36.21C202.91 35.67 205.17 34.31 205.17 30.88C205.17 27.27 203.27 25.1 196.68 25.1C190.18 25.1 187.47 26.82 187.02 32.51L175.82 32.51C176.45 22.67 182.23 16.62 196.77 16.62C210.68 16.62 216.19 22.21 216.19 30.61L216.19 55.45C216.19 58.79 216.82 62.49 218.08 64.3L206.7 64.3" />
        <path d="M224.59 0h11.38v64.29h-11.38Z" />
      </svg>
      <span className="pl-ia" aria-hidden="true">
        IA
      </span>
    </span>
  );
}

/** Menú de la persona: su correo, volver al portal, Organizaciones (Plural) y Salir. */
function UserMenu({
  email,
  esPlural,
  portalUrl,
}: {
  email: string;
  esPlural: boolean;
  portalUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra con clic afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const inicial = (email[0] ?? "?").toUpperCase();
  const item =
    "flex min-h-10 w-full items-center rounded-md px-3 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 outline-none focus-visible:bg-neutral-100";

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-1 pr-2 text-sm text-neutral-700 hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white"
          aria-hidden="true"
        >
          {inicial}
        </span>
        <span className="hidden max-w-[12rem] truncate md:inline">{email}</span>
        <span className="sr-only md:hidden">Tu cuenta</span>
        <ChevronDownIcon className="h-4 w-4 text-neutral-500" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs text-neutral-500" title={email}>
            {email}
          </p>
          <a role="menuitem" href={portalUrl} className={item}>
            Volver a Plural IA
          </a>
          {esPlural && (
            <Link role="menuitem" href="/admin" className={item} onClick={() => setOpen(false)}>
              Organizaciones
            </Link>
          )}
          <div className="my-1 border-t border-neutral-100" />
          {/* La puerta de la suite cierra la sesión en /_auth/logout (pide confirmar). */}
          <a role="menuitem" href="/_auth/logout" className={item}>
            Salir
          </a>
        </div>
      )}
    </div>
  );
}
