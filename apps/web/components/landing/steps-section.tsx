import { FileText, MessageCircle, Workflow } from "lucide-react";
import { LANDING_COPY } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

const ICONS = [FileText, Workflow, MessageCircle];

export function StepsSection() {
  return (
    <section id="how-it-works" className="section-padding bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {LANDING_COPY.steps.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-600">
            {LANDING_COPY.steps.subtitle}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_COPY.steps.items.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={i}
                className={cn(
                  "relative rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md",
                  "animate-fade-up"
                )}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <StepVisual index={i} />
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-neutral-900 text-white">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    <span className="mr-2 text-neutral-400">{i + 1}.</span>
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="flex h-24 items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-white shadow-sm">
          <FileText className="size-5 text-neutral-600" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-2 w-3/4 rounded bg-neutral-200" />
          <div className="h-2 w-1/2 rounded bg-neutral-200" />
          <div className="h-2 w-5/6 rounded bg-neutral-200" />
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="flex h-24 items-center justify-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm">
          Pregunta
        </div>
        <div className="text-neutral-300">→</div>
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm">
          Mensaje
        </div>
        <div className="text-neutral-300">→</div>
        <div className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-sm">
          Fin
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-24 items-center justify-center rounded-xl border border-neutral-100 bg-neutral-50 p-4">
      <div className="flex items-end gap-2">
        <div className="rounded-2xl rounded-br-sm bg-white px-3 py-2 text-xs text-neutral-700 shadow-sm">
          ¡Hola!
        </div>
        <div className="rounded-2xl rounded-bl-sm bg-neutral-900 px-3 py-2 text-xs text-white shadow-sm">
          ¿En qué puedo ayudarte?
        </div>
      </div>
    </div>
  );
}
