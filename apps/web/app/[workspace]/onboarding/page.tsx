import { redirect } from "next/navigation";

/**
 * El guion paso a paso se reemplazó por «Bienvenida y consentimiento» y los
 * momentos del programa pasaron a «Tu programa» (2026-09).
 */
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/${workspace}/bienvenida`);
}
