"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // El detalle técnico queda en consola; la persona ve un mensaje claro.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100">
          <AlertTriangleIcon className="w-8 h-8 text-neutral-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Algo falló de nuestro lado.
          </h1>
          <p className="text-neutral-600">
            No es algo que hayas hecho tú. Intenta de nuevo o vuelve al panel.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={() => unstable_retry()}
            className="bg-neutral-900 hover:bg-neutral-800"
          >
            Intentar de nuevo
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Volver al panel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
