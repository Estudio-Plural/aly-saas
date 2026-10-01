"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UploadIcon,
  FileTextIcon,
  TrashIcon,
  DownloadIcon,
  HeadingIcon,
  LayersIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from "next/navigation";
import type { DocumentRow, UploadReview } from "@/lib/workspaces";

/**
 * "Cuándo lo consulta el asistente" — la señal de ruteo del documento.
 * Se genera sola al subir; acá el usuario la puede ajustar en lenguaje natural.
 */
function RoutingHintEditor({
  doc,
  workspaceSlug,
  onSaved,
}: {
  doc: DocumentRow;
  workspaceSlug: string;
  onSaved: (updated: DocumentRow) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = () => {
    setDraft(doc.routing_hint ?? "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routing_hint: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar");
        return;
      }
      onSaved(data.document);
      setIsEditing(false);
      toast.success("Listo: guardamos cuándo consultarlo");
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="mt-2 max-w-md space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ej.: Cuando pregunten por actividades para hacer en familia"
          maxLength={300}
          rows={2}
          className="text-sm text-neutral-900"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <p className="mt-1.5 max-w-xl text-xs text-neutral-700">
      {doc.routing_hint ? (
        <>
          <span className="text-neutral-500">Lo consulta cuando:</span> {doc.routing_hint}
        </>
      ) : (
        <span className="text-neutral-500">Todavía no dice cuándo consultarlo.</span>
      )}{" "}
      ·{" "}
      <button
        type="button"
        onClick={startEditing}
        className="font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
      >
        {doc.routing_hint ? "Cambiar" : "Escribirlo"}
      </button>
    </p>
  );
}

const TIPS = [
  {
    icon: HeadingIcon,
    title: "Títulos claros",
    body: "Que cada parte diga de qué trata («Qué hacer si…», «Actividad: …»).",
  },
  {
    icon: LayersIcon,
    title: "Un tema por documento",
    body: "Mejor varios documentos cortos que uno largo que mezcla todo. Un PDF escaneado (una foto) no se puede leer.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Nunca cita nombres de archivo",
    body: "La persona no ve «guia_final_v3.pdf»: tu asistente habla del tema o de la actividad, nunca del archivo.",
  },
];

function ReviewItem({ review }: { review: UploadReview }) {
  const complete = review.readable && review.omittedChars === 0;
  const message = !review.readable
    ? "No pudimos leer texto. Si es un PDF escaneado, súbelo como PDF con texto."
    : review.omittedChars > 0
      ? "Leímos solo el comienzo: divídelo en documentos por tema."
      : "Leímos todo el documento.";
  return (
    <li className="flex gap-3">
      {complete ? (
        <CheckCircle2Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
      ) : (
        <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500" />
      )}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-neutral-900">{review.name}</p>
        <p className="text-neutral-600">{message}</p>
      </div>
    </li>
  );
}

export function KnowledgeClient({
  workspaceSlug,
  initialDocuments,
}: {
  workspaceSlug: string;
  initialDocuments: DocumentRow[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [reviews, setReviews] = useState<UploadReview[]>([]);
  // Lo que no se pudo subir, con el motivo que da el servidor: se muestra en la página.
  const [rejected, setRejected] = useState<string[]>([]);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length || isUploading) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const file of fileArray) formData.append("files", file);

      const res = await fetch(`/api/workspaces/${workspaceSlug}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      setReviews(data.reviews ?? []);
      if (data.documents?.length) {
        setDocuments((prev) => [...data.documents, ...prev]);
        router.refresh();
      }
      const reasons: string[] = data.rejected ?? [];
      if (!res.ok && !data.documents?.length && !reasons.length) {
        reasons.push(data.error ?? "No se pudieron subir los archivos");
      }
      setRejected(reasons);
      if (reasons.length) toast.error("Algunos archivos no se subieron: mira el motivo abajo");
    } catch {
      setRejected(["Error de conexión al subir archivos. Inténtalo de nuevo."]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "No se pudo eliminar el documento");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success(`«${doc.name}» eliminado`);
      setReviews((prev) => prev.filter((r) => r.documentId !== doc.id));
      router.refresh();
    } catch {
      toast.error("Error de conexión al eliminar");
    }
  };

  const handleDownload = (doc: DocumentRow) => {
    window.location.assign(`/api/workspaces/${workspaceSlug}/documents/${doc.id}`);
  };

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Material</h1>
        <p className="text-neutral-700 mt-1">
          Guías, protocolos, actividades y preguntas frecuentes de tu programa. Tu asistente
          responde con lo que está aquí.
        </p>
      </div>

      {/* Consejos, siempre a la vista */}
      <div className="grid gap-3 sm:grid-cols-3">
        {TIPS.map((tip) => (
          <div key={tip.title} className="rounded-lg border border-neutral-200 bg-white p-4">
            <tip.icon className="h-4 w-4 text-neutral-500" />
            <p className="mt-2 text-sm font-medium text-neutral-900">{tip.title}</p>
            <p className="mt-0.5 text-xs text-neutral-600">{tip.body}</p>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.markdown,.csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Subir */}
      <Card>
        <CardHeader>
          <CardTitle>Subir material</CardTitle>
          <CardDescription>Sube PDF con texto o documentos de Word, hasta 10 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleSelectFiles}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleSelectFiles();
            }}
            className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? "border-neutral-900 bg-neutral-100"
                : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100"
            }`}
          >
            <UploadIcon className="h-8 w-8 text-neutral-500" />
            <p className="text-base font-semibold text-neutral-900">
              {isUploading
                ? "Subiendo y revisando…"
                : "Arrastra archivos aquí o haz clic para elegirlos"}
            </p>
          </div>
          {rejected.length > 0 && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700"
            >
              <p className="font-medium text-neutral-900">No se subió:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {rejected.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revisión al subir */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisión de lo que subiste</CardTitle>
            <CardDescription>Lo que tu asistente pudo leer de cada archivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {reviews.map((review) => (
                <ReviewItem key={review.documentId} review={review} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Lista del material */}
      <Card>
        <CardHeader>
          <CardTitle>Material del programa ({documents.length})</CardTitle>
          <CardDescription>
            Debajo de cada documento: cuándo lo consulta tu asistente. Se escribe solo y puedes
            cambiarlo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="py-10 text-center text-neutral-600">
              <FileTextIcon className="mx-auto mb-3 h-10 w-10 text-neutral-400" />
              <p className="font-medium text-neutral-900">Todavía no hay material</p>
              <p className="mt-1 text-sm">
                Sube tu primer documento: tu asistente responde con lo que está aquí.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-start gap-3 py-4">
                  <FileTextIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-500" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-neutral-900">{doc.name}</p>
                    {doc.summary && (
                      <p className="mt-0.5 line-clamp-2 max-w-xl text-sm text-neutral-600">
                        {doc.summary}
                      </p>
                    )}
                    <RoutingHintEditor
                      doc={doc}
                      workspaceSlug={workspaceSlug}
                      onSaved={(updated) =>
                        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
                      }
                    />
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(doc)}
                      aria-label={`Descargar ${doc.name}`}
                      title="Descargar"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      title="¿Eliminar documento?"
                      description={`Tu asistente dejará de usar «${doc.name}». No se puede deshacer.`}
                      confirmLabel="Eliminar"
                      onConfirm={() => handleDelete(doc)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${doc.name}`}
                        title="Eliminar"
                        className="text-neutral-500 hover:text-red-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </ConfirmDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
