import { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { exigirAcceso } from "@/lib/sesion";

const PORTAL_URL = process.env.PORTAL_URL ?? "https://suite.estudio-plural.co/app";

// También lo usa /admin (admin/layout.tsx lo reexporta).
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const acceso = await exigirAcceso();
  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader email={acceso.email} esPlural={acceso.esPlural} portalUrl={PORTAL_URL} />
      <main className="container mx-auto px-4 py-8 md:py-10">{children}</main>
    </div>
  );
}
