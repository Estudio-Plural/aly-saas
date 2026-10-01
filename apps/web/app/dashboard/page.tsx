import { redirect } from "next/navigation";
import { listWorkspaces } from "@/lib/data/workspaces";
import { listOrgs } from "@/lib/data/orgs";
import { getProgramProgress } from "@/lib/data/design";
import { exigirAcceso } from "@/lib/sesion";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tus asistentes" };

const PORTAL_URL = process.env.PORTAL_URL ?? "https://suite.estudio-plural.co/app";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; nuevo?: string }>;
}) {
  const acceso = await exigirAcceso();
  const orgs = await listOrgs(acceso);

  // Cliente sin organización: la puerta lo dejó entrar, pero todavía no tiene asistentes.
  if (!acceso.esPlural && orgs.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Tu cuenta todavía no tiene acceso a ningún asistente
        </h1>
        <p className="mt-3 text-neutral-600">
          Entraste como <b className="font-medium text-neutral-900">{acceso.email}</b>. Si tu
          organización ya trabaja con nosotros, quizá te dimos acceso con otro correo.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href={PORTAL_URL}
            className="inline-flex h-10 items-center rounded-lg bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Volver a Plural IA
          </a>
          <a
            className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
            href="mailto:hola@estudio-plural.co"
          >
            Escríbenos a hola@estudio-plural.co
          </a>
        </div>
      </div>
    );
  }

  const { org, nuevo } = await searchParams;
  const abrirCrear = nuevo === "1";
  const selectedOrg = org && orgs.some((o) => o.id === org) ? org : null;
  // La lista sale ya filtrada por las organizaciones de quien entra.
  const workspaces = await listWorkspaces(acceso, selectedOrg ?? undefined);

  // Cliente con un solo asistente: sin lista intermedia, entra directo a su Inicio.
  // ?nuevo=1 (desde Ajustes, «Crear otro asistente») se queda aquí con el diálogo abierto.
  if (!acceso.esPlural && !selectedOrg && workspaces.length === 1 && !abrirCrear) {
    redirect(`/${workspaces[0].slug}`);
  }

  const progress = await Promise.all(workspaces.map((w) => getProgramProgress(w)));

  return (
    <DashboardClient
      initialWorkspaces={workspaces}
      progress={progress}
      orgs={orgs}
      selectedOrg={selectedOrg}
      isPlural={acceso.esPlural}
      abrirCrear={abrirCrear}
    />
  );
}
