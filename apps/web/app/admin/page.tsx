import { notFound } from "next/navigation";
import { exigirAcceso } from "@/lib/sesion";
import { listOrgsDetalle } from "@/lib/data/orgs";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizaciones" };

// Solo equipo Plural. A un cliente, 404: no necesita saber que esto existe.
export default async function AdminPage() {
  const acceso = await exigirAcceso();
  if (!acceso.esPlural) notFound();
  return <AdminClient initialOrgs={await listOrgsDetalle(acceso)} />;
}
