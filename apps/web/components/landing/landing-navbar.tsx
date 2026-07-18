"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { LANDING_COPY } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: LANDING_COPY.nav.features },
  { href: "#how-it-works", label: LANDING_COPY.nav.howItWorks },
  { href: "#pricing", label: LANDING_COPY.nav.pricing },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <span className="brand-mark flex size-8 items-center justify-center rounded-lg text-sm">
            P
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
            {LANDING_COPY.productName}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {LANDING_COPY.nav.dashboard}
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }))}>
            {LANDING_COPY.nav.createAssistant}
          </Link>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="border-t bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                onClick={() => setMobileOpen(false)}
              >
                {LANDING_COPY.nav.dashboard}
              </Link>
              <Link
                href="/dashboard"
                className={cn(buttonVariants(), "w-full")}
                onClick={() => setMobileOpen(false)}
              >
                {LANDING_COPY.nav.createAssistant}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
