import {
  BookOpen,
  BrainCircuit,
  Database,
  Layers,
  MessageSquareText,
  Smartphone,
} from "lucide-react";
import { LANDING_COPY } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

const ICONS = [BookOpen, BrainCircuit, MessageSquareText, Layers, Database, Smartphone];

export function FeaturesSection() {
  return (
    <section id="features" className="section-padding bg-neutral-50/70">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {LANDING_COPY.features.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-600">
            {LANDING_COPY.features.subtitle}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_COPY.features.items.map((feature, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md",
                  "animate-fade-up"
                )}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
