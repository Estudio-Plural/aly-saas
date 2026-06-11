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
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DocumentRow } from "@/lib/workspaces";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
        toast.success(
          data.documents.length === 1
            ? `"${data.documents[0].name}" subido`
            : `${data.documents.length} documentos subidos`
        );
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
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Base de Conocimiento
        </h1>
        <p className="text-neutral-700 mt-1">
          Sube documentos para que tu asistente tenga contexto sobre tus productos y servicios
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.markdown,.csv,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Subir Documentos</CardTitle>
          <CardDescription>
            Arrastrá archivos aquí o hacé clic para seleccionar. Soportamos PDF, TXT, MD y DOC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              min-h-64 border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
              ${
                isDragging
                  ? "border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100/50 scale-[1.02]"
                  : "border-transparent bg-gradient-to-br from-neutral-100 to-neutral-200/50 hover:from-blue-50 hover:to-blue-100/30 hover:scale-[1.01] [background-clip:padding-box] relative before:absolute before:inset-0 before:rounded-lg before:p-[2px] before:bg-gradient-to-br before:from-blue-400 before:to-blue-600 before:-z-10 before:content-['']"
              }
            `}
            onClick={handleSelectFiles}
          >
            <div className="flex flex-col items-center justify-center gap-4 h-full">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <UploadIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-base font-semibold text-neutral-900 mb-1">
                  {isUploading
                    ? "Subiendo archivos..."
                    : "Arrastrá archivos aquí o hacé clic para seleccionar"}
                </div>
                <div className="text-sm text-neutral-600">
                  PDF, TXT, MD, DOC hasta 10 MB
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleSelectFiles} size="lg" disabled={isUploading}>
              <UploadIcon className="mr-2 h-4 w-4" />
              {isUploading ? "Subiendo..." : "Seleccionar Archivos"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos ({documents.length})</CardTitle>
          <CardDescription>
            Archivos disponibles en la base de conocimiento de tu asistente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12 text-neutral-600">
              <FileIcon className="h-12 w-12 mx-auto mb-4 text-neutral-400" />
              <p>No hay documentos todavía</p>
              <p className="text-sm mt-1">Subí tu primer documento para empezar</p>
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
                      className="border-0 hover:bg-blue-50/50 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                            <FileTextIcon className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-medium text-neutral-900">
                            {doc.name}
                          </span>
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
                            description={`Vas a eliminar "${doc.name}". Esta acción no se puede deshacer.`}
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

      {/* Info adicional */}
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/30 p-6 relative overflow-hidden before:absolute before:inset-0 before:rounded-lg before:p-[1px] before:bg-gradient-to-br before:from-blue-300 before:to-blue-500 before:-z-10 before:content-['']">
        <div className="flex gap-4 relative z-10">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <FileTextIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-neutral-900 mb-2 text-base">
              ¿Cómo funciona la base de conocimiento?
            </p>
            <p className="text-sm text-neutral-700 leading-relaxed">
              Los documentos de texto (TXT, MD, CSV) se inyectan directamente al contexto
              del asistente: probalo en la Vista Previa del Chat. Los PDF y DOC se guardan
              y quedan listos para el procesamiento con embeddings (RAG) en producción.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
