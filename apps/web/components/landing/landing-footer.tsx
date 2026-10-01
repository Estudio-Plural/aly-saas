import Link from "next/link";
import { CONTACT_EMAIL, LANDING_COPY } from "@/lib/landing-copy";

export function LandingFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="brand-mark flex size-7 items-center justify-center rounded-md text-xs">
              P
            </span>
            <span className="text-sm font-semibold tracking-tight text-neutral-900">
              {LANDING_COPY.productName}
            </span>
          </Link>
          <p className="text-center text-sm text-neutral-600">
            {LANDING_COPY.footer.contact}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-sm text-neutral-500">{LANDING_COPY.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
