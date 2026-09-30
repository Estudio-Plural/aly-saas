import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100">
          <SearchXIcon className="w-8 h-8 text-neutral-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            No encontramos esta página.
          </h1>
          <p className="text-neutral-600">
            Puede que el enlace esté mal escrito o que la página ya no exista.
          </p>
        </div>
        <Button asChild className="bg-neutral-900 hover:bg-neutral-800">
          <Link href="/dashboard">Volver al panel</Link>
        </Button>
      </div>
    </div>
  );
}
