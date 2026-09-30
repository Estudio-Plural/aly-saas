import { listWorkspaces } from "@/lib/data/workspaces";
import { listOrgs } from "@/lib/data/orgs";
import { exigirAcceso } from "@/lib/sesion";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const acceso = await exigirAcceso();
  const orgs = await listOrgs(acceso);

  // Cliente sin organización: la puerta lo dejó entrar, pero todavía no tiene programas.
  if (!acceso.esPlural && orgs.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Tu cuenta todavía no tiene programas
        </h1>
        <p className="mt-3 text-neutral-600">
          Entraste como <b>{acceso.email}</b>. Si deberías ver los programas de tu organización,
          escríbenos a{" "}
          <a className="underline" href="mailto:hola@estudio-plural.co">
            hola@estudio-plural.co
          </a>
          .
        </p>
      </div>
    );
  }

  const { org } = await searchParams;
  const selectedOrg = org && orgs.some((o) => o.id === org) ? org : null;
  const workspaces = await listWorkspaces(acceso, selectedOrg ?? undefined);
  return (
    <DashboardClient
      initialWorkspaces={workspaces}
      orgs={orgs}
      selectedOrg={selectedOrg}
      isPlural={acceso.esPlural}
    />
  );
}
