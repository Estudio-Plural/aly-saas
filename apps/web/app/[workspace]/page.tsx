import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workspaceDePagina } from "@/lib/sesion";
import { getProgramProgress } from "@/lib/data/design";
import {
  DESIGN_STEPS,
  isDesignDone,
  nextStepPath,
  stepLabel,
  type ProgramProgress,
} from "@/lib/design";

export const dynamic = "force-dynamic";

function Check({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2Icon aria-label="Listo" className="h-5 w-5 flex-shrink-0 text-green-600" />
  ) : (
    <CircleIcon aria-label="Pendiente" className="h-5 w-5 flex-shrink-0 text-neutral-300" />
  );
}

/** Las 4 etapas: Diseñar (una sola, aunque tenga 5 pasos), Probar, Conectar y Operar. */
function countStages(progress: ProgramProgress): number {
  return [isDesignDone(progress), progress.test, progress.connect, progress.operate].filter(
    Boolean
  ).length;
}

/**
 * Inicio del asistente: el checklist de 4 etapas con UN botón al primer
 * pendiente. Cuando el asistente ya está conectado a WhatsApp, arriba va
 * «Así va {asistente}» (con el único botón primario) y el checklist queda
 * debajo, más tenue.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { workspace } = await workspaceDePagina(workspaceSlug);

  const progress = await getProgramProgress(workspace);
  const base = `/${workspace.slug}`;
  const next = nextStepPath(progress);
  const done = countStages(progress);
  const assistant = workspace.assistant_name || "tu asistente";
  const designDone = DESIGN_STEPS.filter((step) => progress.design[step.key]).length;
  const live = progress.connect;

  const sections = [
    {
      title: "Probar",
      done: progress.test,
      href: `${base}/${progress.test ? "chat" : "chat/casos"}`,
      description: `Revisa las situaciones difíciles (crisis, privacidad, pedidos que no puede cumplir). Después conversa libremente con ${assistant}.`,
    },
    {
      title: "Conectar WhatsApp",
      done: progress.connect,
      href: `${base}/whatsapp`,
      description: "Nos escribes y conectamos el número de WhatsApp de tu organización.",
    },
    {
      title: "Operar",
      done: progress.operate,
      href: `${base}/operar`,
      description:
        "Cuántas personas conversan, qué alertas hay y qué hacer ante una situación de riesgo, sin leer conversaciones una por una.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Inicio</h1>
          <p className="mt-1 text-neutral-600">
            Cuatro pasos para que {assistant} acompañe a las personas de tu programa.{" "}
            <span className="whitespace-nowrap text-neutral-500">{done} de 4 listos.</span>
          </p>
        </div>
        {!live &&
          (next ? (
            <Button asChild size="lg" className="flex-shrink-0">
              <Link href={`${base}/${next}`}>
                Siguiente: {stepLabel(next)}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle2Icon className="h-5 w-5" /> Todo listo
            </p>
          ))}
      </div>

      {live && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Así va {assistant}</h2>
          <p className="mt-1 text-neutral-600">
            {progress.operate
              ? `${assistant} ya conversa con las personas de tu programa por WhatsApp. Mira cuántas personas le escriben, qué temas salen y si hay alertas.`
              : `${assistant} ya está conectado a WhatsApp. Cuando alguien de tu programa le escriba, aquí vas a ver cómo va.`}
          </p>
          <Button asChild size="lg" className="mt-4">
            <Link href={`${base}/operar`}>
              Ver cómo va
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      )}

      <ol className={`space-y-3 ${live ? "opacity-80" : ""}`}>
        <li className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
              1
            </span>
            <div className="flex-1">
              <h2 className="font-semibold text-neutral-900">
                Diseñar{" "}
                <span className="text-sm font-normal text-neutral-500">
                  · {designDone} de {DESIGN_STEPS.length} listos
                </span>
              </h2>
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
