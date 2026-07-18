import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LANDING_COPY } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

export function CtaSection() {
  return (
    <section className="section-padding bg-neutral-50/70">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm sm:px-12 sm:py-16">
          <div className="landing-grid-bg pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              {LANDING_COPY.cta.title}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-neutral-600">
              {LANDING_COPY.cta.subtitle}
            </p>
            <div className="mt-8">
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "lg" }), "gap-2")}
              >
                {LANDING_COPY.cta.cta} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
