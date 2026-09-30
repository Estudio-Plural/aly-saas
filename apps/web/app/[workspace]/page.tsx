import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, CheckCircle2Icon, CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getProgramProgress } from "@/lib/data/design";
import {
  DESIGN_STEPS,
  isDesignDone,
  nextStepPath,
  type ProgramProgress,
} from "@/lib/design";

export const dynamic = "force-dynamic";

function Check({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2Icon aria-label="Hecho" className="h-5 w-5 flex-shrink-0 text-green-600" />
  ) : (
    <CircleIcon aria-label="Pendiente" className="h-5 w-5 flex-shrink-0 text-neutral-300" />
  );
}

const PATH_LABELS: Record<string, string> = {
  ...Object.fromEntries(DESIGN_STEPS.map((step) => [step.path, step.label])),
  chat: "Probar",
  whatsapp: "Conectar WhatsApp",
  conversations: "Operar",
};

function countDone(progress: ProgramProgress): { done: number; total: number } {
  const flags = [
    ...Object.values(progress.design),
    progress.test,
    progress.connect,
    progress.operate,
  ];
  return { done: flags.filter(Boolean).length, total: flags.length };
}

/** Primeros pasos: el checklist del programa con UN botón al primer pendiente. */
export default async function FirstStepsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const progress = await getProgramProgress(workspace);
  const base = `/${workspace.slug}`;
  const next = nextStepPath(progress);
  const { done, total } = countDone(progress);
  const assistant = workspace.assistant_name;

  const sections = [
    {
      title: "Probar",
      done: progress.test,
      href: `${base}/chat`,
      description: `Conversa con ${assistant} como si fueras una persona del programa.`,
    },
    {
      title: "Conectar WhatsApp",
      done: progress.connect,
      href: `${base}/whatsapp`,
      description: "Plural conecta el número de WhatsApp de tu organización.",
    },
    {
      title: "Operar",
      done: progress.operate,
      href: `${base}/conversations`,
      description: "Cifras de uso y las alertas que definas, sin leer conversaciones una por una.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Primeros pasos
          </h1>
          <p className="mt-1 text-neutral-600">
            Cuatro pasos para que {assistant} acompañe a las personas de tu programa.{" "}
            <span className="whitespace-nowrap text-neutral-500">
              {done} de {total} listos.
            </span>
          </p>
        </div>
        {next ? (
          <Button asChild size="lg" className="flex-shrink-0">
            <Link href={`${base}/${next}`}>
              Siguiente paso: {PATH_LABELS[next]}
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle2Icon className="h-5 w-5" /> Todo listo
          </p>
        )}
      </div>

      <ol className="space-y-3">
        <li className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
              1
            </span>
            <div className="flex-1">
              <h2 className="font-semibold text-neutral-900">Diseñar</h2>
              <p className="text-sm text-neutral-600">
                Qué hace {assistant}, qué no hace, a dónde deriva y con qué material
                acompaña.
              </p>
            </div>
            <Check done={isDesignDone(progress)} />
          </div>
          <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 sm:ml-10">
            {DESIGN_STEPS.map((step) => (
              <li key={step.key}>
                <Link
                  href={`${base}/${step.path}`}
                  className="flex items-center gap-3 py-2.5 text-sm text-neutral-800 hover:text-neutral-950 hover:underline"
                >
                  <span className="flex-1">{step.label}</span>
                  <Check done={progress.design[step.key]} />
                </Link>
              </li>
            ))}
          </ul>
        </li>

        {sections.map((section, index) => (
          <li key={section.title}>
            <Link
              href={section.href}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300"
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                {index + 2}
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-neutral-900">{section.title}</h2>
                <p className="text-sm text-neutral-600">{section.description}</p>
              </div>
              <Check done={section.done} />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
