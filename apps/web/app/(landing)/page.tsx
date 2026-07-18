import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { StepsSection } from "@/components/landing/steps-section";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <StepsSection />
      <FeaturesSection />
      <PricingSection />
      <CtaSection />
    </>
  );
}
