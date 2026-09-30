import { redirect } from "next/navigation";

/** Identidad se fusionó con Programa en «Tu programa» (2026-09). */
export default async function IdentityPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/${workspace}/programa`);
}
