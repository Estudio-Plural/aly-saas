import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LANDING_COPY } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

export function PricingSection() {
  return (
    <section id="pricing" className="section-padding bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {LANDING_COPY.pricing.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-600">
            {LANDING_COPY.pricing.subtitle}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl">
          {LANDING_COPY.pricing.plans.map((plan, i) => (
            <Card
              key={i}
              className={cn(
                "relative overflow-hidden rounded-2xl border",
                plan.highlighted
                  ? "border-neutral-900 shadow-lg"
                  : "border-neutral-200 shadow-sm"
              )}
            >
              {plan.highlighted && (
                <div className="absolute right-0 top-0 rounded-bl-xl bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
                  Más popular
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-neutral-900">
                  {plan.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-neutral-900">
                    {plan.price}
                  </span>
                  <span className="text-sm text-neutral-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-600">{plan.description}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feature, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm text-neutral-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-neutral-900" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="pt-2">
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ variant: plan.highlighted ? "default" : "outline" }),
                    "w-full"
                  )}
                >
                  {plan.cta}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
