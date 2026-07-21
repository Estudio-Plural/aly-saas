"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ArrowRightIcon,
  FileTextIcon,
  FilmIcon,
  ImageIcon,
  Loader2Icon,
  Music2Icon,
  PaperclipIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  attachmentKind,
  type Storyboard,
  type StoryboardAttachment,
  type StoryboardMomentKey,
} from "@/lib/workspaces";

const ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.mp4,.webm,.mov,.mp3,.m4a,.ogg,.wav";

const MOMENTS: {
  key: StoryboardMomentKey;
  title: string;
  description: string;
  placeholder: string;
}[] = [
  {
    key: "opening",
    title: "Arranque",
    description: "Cómo empieza la conversación con cada persona.",
    placeholder: "Ej: Bienvenida cálida y diagnóstico del punto de partida...",
  },
  {
    key: "development",
    title: "Qué pasa",
    description: "El desarrollo: qué conversa y comparte el asistente.",
    placeholder: "Ej: Comparte ideas y herramientas, conversa sobre cómo aplicarlas...",
  },
  {
    key: "next_steps",
    title: "Qué debe pasar después",
    description: "El resultado concreto que tiene que quedar del intercambio.",
    placeholder: "Ej: La persona define un próximo paso concreto y alcanzable...",
  },
  {
    key: "closing",
    title: "Cómo termina",
    description: "El cierre de cada interacción y lo que sigue.",
    placeholder: "Ej: Celebrar el avance y acordar cuándo retomar el contacto...",
  },
];

function KindIcon({ mime, className }: { mime: string; className?: string }) {
  const kind = attachmentKind(mime);
  if (kind === "imagen") return <ImageIcon className={className} />;
  if (kind === "video") return <FilmIcon className={className} />;
  if (kind === "audio") return <Music2Icon className={className} />;
  return <FileTextIcon className={className} />;
}

export function StoryboardSection({
  workspaceSlug,
  initialStoryboard,
}: {
  workspaceSlug: string;
  initialStoryboard: Storyboard;
}) {
  const [storyboard, setStoryboard] = useState(initialStoryboard);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [uploadingMoment, setUploadingMoment] = useState<StoryboardMomentKey | null>(
    null
  );
  const fileInputsRef = useRef<Partial<Record<StoryboardMomentKey, HTMLInputElement | null>>>(
    {}
  );

  const updateMoment = (key: StoryboardMomentKey, value: string) => {
    setStoryboard((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (MOMENTS.some(({ key }) => storyboard[key].trim().length < 3)) {
      toast.error("Todos los momentos necesitan al menos 3 caracteres");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/program`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboard }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "No se pudo guardar el storyboard");
        return;
      }
      setIsDirty(false);
      toast.success("Storyboard guardado");
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (moment: StoryboardMomentKey, file: File) => {
    setUploadingMoment(moment);
    try {
      const formData = new FormData();
      formData.append("moment", moment);
      formData.append("file", file);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/program/attachments`,
        { method: "POST", body: formData }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo subir el material");
        return;
      }
      const attachment: StoryboardAttachment = data.attachment;
      setStoryboard((prev) => ({
        ...prev,
        attachments: {
          ...prev.attachments,
          [moment]: [...(prev.attachments?.[moment] ?? []), attachment],
        },
      }));
      toast.success("Material agregado — el asistente puede enviarlo en el chat");
    } catch {
      toast.error("Error de conexión al subir el material");
    } finally {
      setUploadingMoment(null);
    }
  };

  const handleRemove = async (moment: StoryboardMomentKey, attachmentId: string) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/program/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo quitar el material");
        return;
      }
      setStoryboard((prev) => ({
        ...prev,
        attachments: {
          ...prev.attachments,
          [moment]: (prev.attachments?.[moment] ?? []).filter(
            (att) => att.id !== attachmentId
          ),
        },
      }));
      toast.success("Material quitado");
    } catch {
      toast.error("Error de conexión al quitar el material");
    }
  };

  return (
    <Card className="p-5 border-neutral-200 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Storyboard</h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            El arco que sigue la conversación, en 4 momentos. El asistente lo usa
            como guía en todo el programa, y puede enviar los materiales que
            adjuntes en cada momento.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-700">Cambios sin guardar</span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            size="sm"
            className="bg-neutral-900 hover:bg-neutral-800 text-white"
          >
            <SaveIcon className="h-4 w-4 mr-2" />
            {isSaving ? "Guardando..." : isDirty ? "Guardar" : "Guardado ✓"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {MOMENTS.map((moment, index) => {
          const attachments = storyboard.attachments?.[moment.key] ?? [];
          return (
            <div key={moment.key} className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">{index + 1}</span>
                </div>
                <span className="text-sm font-semibold text-neutral-900">
                  {moment.title}
                </span>
              </div>
              <Textarea
                value={storyboard[moment.key]}
                onChange={(e) => updateMoment(moment.key, e.target.value)}
                placeholder={moment.placeholder}
                rows={4}
                maxLength={2000}
                className="resize-y bg-white text-sm border-neutral-300 focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
              />
              <p className="text-xs text-neutral-600 mt-1.5">{moment.description}</p>

              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1"
                    >
                      <KindIcon
                        mime={att.type}
                        className="h-3.5 w-3.5 text-neutral-600 flex-shrink-0"
                      />
                      <a
                        href={`/api/workspaces/${workspaceSlug}/program/attachments/${att.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-neutral-800 truncate flex-1 hover:underline"
                        title={`${att.name} (${attachmentKind(att.type)})`}
                      >
                        {att.name}
                      </a>
                      <ConfirmDialog
                        title="¿Quitar este material?"
                        description={`El asistente ya no va a poder enviar "${att.name}" en el chat.`}
                        confirmLabel="Quitar"
                        onConfirm={() => handleRemove(moment.key, att.id)}
                      >
                        <button
                          type="button"
                          aria-label={`Quitar ${att.name}`}
                          className="text-neutral-500 hover:text-red-600 flex-shrink-0"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </ConfirmDialog>
                    </li>
                  ))}
                </ul>
              )}

              <input
                ref={(el) => {
                  fileInputsRef.current[moment.key] = el;
                }}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleUpload(moment.key, file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingMoment !== null}
                onClick={() => fileInputsRef.current[moment.key]?.click()}
                className="mt-2 h-7 px-2 text-xs text-neutral-700"
              >
                {uploadingMoment === moment.key ? (
                  <Loader2Icon className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <PaperclipIcon className="h-3.5 w-3.5 mr-1.5" />
                )}
                {uploadingMoment === moment.key ? "Subiendo..." : "Adjuntar material"}
              </Button>

              {index < MOMENTS.length - 1 && (
                <ArrowRightIcon className="hidden xl:block absolute top-2 -right-2.5 h-4 w-4 text-neutral-400" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
