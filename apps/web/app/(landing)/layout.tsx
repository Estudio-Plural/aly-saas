import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";

export const metadata: Metadata = {
  // absolute: evita que el template del layout raíz duplique el nombre del producto.
  title: {
    absolute: "Plural IA Conversacional — Conversaciones para programas de cambio de comportamiento",
  },
  description:
    "Diseña las conversaciones de tu programa: qué dice tu asistente, qué no hace y a dónde deriva a quien está en riesgo. Pruébalo contra situaciones difíciles y Plural lo conecta a WhatsApp.",
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <LandingNavbar />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
