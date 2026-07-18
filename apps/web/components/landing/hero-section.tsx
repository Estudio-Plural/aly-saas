import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LANDING_COPY } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";
import { ChatDemo } from "./chat-demo";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="landing-grid-bg pointer-events-none absolute inset-0" />
      <div className="relative mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="text-center lg:text-left">
            <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-neutral-900 text-2xl text-white animate-float brand-mark">
              P
            </div>

            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
              <Sparkles className="size-3.5 text-neutral-900" />
              {LANDING_COPY.hero.eyebrow}
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
              {LANDING_COPY.hero.headline.replace(
                "programa conversacional",
                "{{PROGRAMA}}"
              )
                .split("{{PROGRAMA}}")
                .map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="gradient-text">programa conversacional</span>
                    )}
                  </span>
                ))}
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-neutral-600 lg:mx-0">
              {LANDING_COPY.hero.subheadline}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "lg" }), "gap-2")}
              >
                {LANDING_COPY.hero.ctaPrimary} <ArrowRight className="size-4" />
              </Link>
              <Link
                href="#how-it-works"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              >
                {LANDING_COPY.hero.ctaSecondary}
              </Link>
            </div>
          </div>

          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <ChatDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
