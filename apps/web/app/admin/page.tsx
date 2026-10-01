import { notFound } from "next/navigation";
import { exigirAcceso } from "@/lib/sesion";
import { listOrgsDetalle } from "@/lib/data/orgs";
import { miembrosDelPortal, sincronizarMiembros } from "@/lib/miembros";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizaciones" };

const PORTAL_ADMIN_URL = process.env.PORTAL_ADMIN_URL ?? "https://suite.estudio-plural.co/app/admin";

// Solo equipo Plural. A un cliente, 404: no necesita saber que esto existe.
export default async function AdminPage() {
  const acceso = await exigirAcceso();
  if (!acceso.esPlural) notFound();
  const delPortal = miembrosDelPortal();
  // Al abrir el admin se ve lo último del portal, sin esperar el freno de 1 min.
  const sincronizado = delPortal ? await sincronizarMiembros({ forzar: true }) : true;
  return (
    <AdminClient
      initialOrgs={await listOrgsDetalle(acceso)}
      portal={delPortal ? { url: PORTAL_ADMIN_URL, sincronizado } : null}
    />
  );
}
