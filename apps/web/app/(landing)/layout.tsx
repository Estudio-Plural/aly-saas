import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";

export const metadata: Metadata = {
  title: "Plural — Programas conversacionales con IA para WhatsApp",
  description:
    "Convertí tu conocimiento en un programa conversacional que acompaña a cada persona. Sin código, con RAG real y multi-tenant desde día uno.",
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
