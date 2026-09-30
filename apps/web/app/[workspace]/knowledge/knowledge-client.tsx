"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UploadIcon,
  FileTextIcon,
  TrashIcon,
  DownloadIcon,
  FileIcon,
  PencilIcon,
  SplitIcon,
  HeadingIcon,
  LayersIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from "next/navigation";
import type { DocumentRow, UploadReview } from "@/lib/workspaces";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/documents/${doc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routing_hint: draft.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar");
        return;
      }
      onSaved(data.document);
      setIsEditing(false);
      toast.success("Listo: el asistente usará esta indicación");
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
          placeholder='Ej: "Cuando pregunten por actividades para hacer en familia"'
          maxLength={300}
          rows={2}
          className="text-sm text-neutral-900"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group mt-1.5 flex items-start gap-1.5 text-left max-w-md"
      title="Editar cuándo consulta este documento"
    >
      <SplitIcon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-neutral-600" />
      <span className="text-xs text-neutral-700 group-hover:text-neutral-900">
        {doc.routing_hint ?? "Define cuándo lo consulta el asistente"}
      </span>
      <PencilIcon className="h-3 w-3 mt-0.5 flex-shrink-0 text-neutral-400 group-hover:text-neutral-900" />
    </button>
  );
}

const TIPS = [
  {
    icon: HeadingIcon,
    title: "Encabezados claros",
    body: "Títulos que digan de qué trata cada parte («Qué hacer si…», «Actividad: …»). Así el asistente encuentra la parte justa.",
  },
  {
    icon: LayersIcon,
    title: "Un tema por documento",
    body: "Mejor varios documentos cortos que uno largo que mezcla todo. Un PDF escaneado (foto) no se puede leer.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Nunca cita nombres de archivo",
    body: "La persona no ve «guia_final_v3.pdf»: el asistente habla del tema o de la actividad, nunca del archivo.",
  },
];

function ReviewItem({ review }: { review: UploadReview }) {
  const problems: string[] = [];
  if (!review.readable) {
    problems.push(
      "No pudimos leer texto. Si es un PDF escaneado, súbelo como PDF con texto o como TXT."
    );
  }
  if (review.omittedChars > 0) {
    const pct = Math.round((review.omittedChars / review.totalChars) * 100);
    problems.push(
      `Es muy largo: el asistente solo usa los primeros 20.000 caracteres y se omitió el ${pct}% final. Divídelo en documentos por tema.`
    );
  }
  if (review.readable && review.name.toLowerCase().endsWith(".md") && review.headings === 0) {
    problems.push("No encontramos encabezados (# Título). Agrégalos para separar los temas.");
  }
  const ok = problems.length === 0;
  return (
    <li className="flex gap-3">
      {ok ? (
        <CheckCircle2Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
      ) : (
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
      )}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-neutral-900">{review.name}</p>
        {review.readable && (
          <p className="text-neutral-600">
            Leímos {review.totalChars.toLocaleString("es")} caracteres
            {review.fragments ? ` en ${review.fragments} fragmentos para la búsqueda` : ""}.
          </p>
        )}
        {problems.map((problem) => (
          <p key={problem} className="text-amber-800">
            {problem}
          </p>
        ))}
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
      const data = await res.json();

      if (data.documents?.length) {
        setDocuments((prev) => [...data.documents, ...prev]);
        setReviews(data.reviews ?? []);
        router.refresh();
      }
      for (const reason of data.rejected ?? []) {
        toast.error(`No se subió: ${reason}`);
      }
      if (!res.ok && !data.documents?.length && !data.rejected?.length) {
        toast.error(data.error ?? "No se pudieron subir los archivos");
      }
    } catch {
      toast.error("Error de conexión al subir archivos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/documents/${doc.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "No se pudo eliminar el documento");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success(`"${doc.name}" eliminado`);
      setReviews((prev) => prev.filter((r) => r.documentId !== doc.id));
      router.refresh();
    } catch {
      toast.error("Error de conexión al eliminar");
    }
  };

  const handleDownload = (doc: DocumentRow) => {
    window.location.assign(
      `/api/workspaces/${workspaceSlug}/documents/${doc.id}`
    );
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
          Guías, protocolos, actividades y preguntas frecuentes de tu programa. El
          asistente responde con lo que está aquí.
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
        accept=".pdf,.txt,.md,.markdown,.csv"
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
          <CardDescription>PDF con texto, TXT o Markdown (.md), hasta 10 MB.</CardDescription>
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
              {isUploading ? "Subiendo y revisando…" : "Arrastra archivos aquí o haz clic para elegirlos"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Revisión al subir */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisión de lo que subiste</CardTitle>
            <CardDescription>
              Esto es lo que el asistente pudo leer de cada archivo.
            </CardDescription>
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

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Material del programa ({documents.length})</CardTitle>
          <CardDescription>
            Debajo de cada documento: cuándo lo consulta el asistente (se genera solo y puedes editarlo).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12 text-neutral-600">
              <FileIcon className="h-12 w-12 mx-auto mb-4 text-neutral-400" />
              <p>Todavía no hay material</p>
              <p className="text-sm mt-1">Sube tu primer documento para empezar</p>
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden border-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-neutral-200 hover:bg-transparent">
                    <TableHead className="font-semibold">Nombre</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Tamaño</TableHead>
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="text-right font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="border-0 hover:bg-neutral-50 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center shadow-sm flex-shrink-0">
                            <FileTextIcon className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-neutral-900">
                                {doc.name}
                              </span>
                              {doc.theme_category && (
                                <Badge variant="outline" className="text-neutral-600">
                                  {doc.theme_category}
                                </Badge>
                              )}
                            </div>
                            {doc.summary && (
                              <p
                                className="text-xs text-neutral-600 truncate max-w-md mt-0.5"
                                title={doc.summary}
                              >
                                {doc.summary}
                              </p>
                            )}
                            <RoutingHintEditor
                              doc={doc}
                              workspaceSlug={workspaceSlug}
                              onSaved={(updated) =>
                                setDocuments((prev) =>
                                  prev.map((d) => (d.id === updated.id ? updated : d))
                                )
                              }
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                          {doc.type.split("/")[1]?.toUpperCase() || "FILE"}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm font-medium text-neutral-900">
                          {formatFileSize(doc.size)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm text-neutral-600">
                          {formatDate(doc.created_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => handleDownload(doc)}
                            aria-label={`Descargar ${doc.name}`}
                            className="h-10 w-10 p-0"
                          >
                            <DownloadIcon className="h-4 w-4" />
                          </Button>
                          <ConfirmDialog
                            title="¿Eliminar documento?"
                            description={`El asistente dejará de usar "${doc.name}". No se puede deshacer.`}
                            confirmLabel="Eliminar"
                            onConfirm={() => handleDelete(doc)}
                          >
                            <Button
                              variant="destructive"
                              size="lg"
                              aria-label={`Eliminar ${doc.name}`}
                              className="h-10 w-10 p-0"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
