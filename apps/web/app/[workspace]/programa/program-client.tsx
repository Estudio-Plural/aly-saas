"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SaveBar } from "@/components/save-bar";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExampleField } from "@/components/example-field";
import { ChevronRightIcon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_CORE_PROMPT,
  DEFAULT_STORYBOARD,
  attachmentKind,
  type CorePrompt,
  type CorePromptField,
  type Storyboard,
  type StoryboardAttachment,
  type StoryboardMomentKey,
} from "@/lib/workspaces";

const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.mp4,.webm,.mov,.mp3,.m4a,.ogg,.wav";

type Field = { key: CorePromptField; label: string; hint: string; rows?: number };

const PURPOSE_FIELDS: Field[] = [
  {
    key: "mission",
    label: "Misión (necesario)",
    hint: "¿Para qué existe tu asistente? ¿Qué cambio busca acompañar?",
  },
  {
    key: "audience",
    label: "A quién acompaña (necesario)",
    hint: "¿Quiénes le escriben? Su situación, su edad, su territorio, lo que viven.",
  },
  {
    key: "success_criteria",
    label: "Criterio de éxito (necesario)",
    hint: "¿Cuándo una conversación salió bien?",
  },
];

const VOICE_FIELDS: Field[] = [
  { key: "voice_tone", label: "Tono", hint: "Cómo suena: cercano, sereno, directo…", rows: 2 },
  {
    key: "voice_use",
    label: "Palabras y giros que usa",
    hint: "Las huellas de su voz. Separa con comas.",
    rows: 2,
  },
  {
    key: "voice_avoid",
    label: "Palabras y giros que evita",
    hint: "Lo que suena a manual, a juicio o a otra organización.",
    rows: 2,
  },
];

const MOMENTS: { key: StoryboardMomentKey; title: string; hint: string }[] = [
  { key: "opening", title: "Cómo empieza", hint: "El primer intercambio con cada persona." },
  { key: "development", title: "Qué conversan", hint: "Qué comparte y qué pregunta tu asistente." },
  {
    key: "next_steps",
    title: "Con qué se queda la persona",
    hint: "El resultado concreto que tiene que quedar.",
  },
  { key: "closing", title: "Cómo cierra", hint: "El cierre de cada conversación." },
];

type CoreState = Record<CorePromptField, string> & { scope: string; key_actions: string };
type MomentTexts = Record<StoryboardMomentKey, string>;

export function ProgramClient({
  workspaceSlug,
  assistantName,
  initialCore,
  initialStoryboard,
  initiallySaved = false,
  next,
}: {
  workspaceSlug: string;
  assistantName: string;
  initialCore: Partial<CorePrompt>;
  initialStoryboard: Partial<Storyboard>;
  /** Si «Tu programa» ya se guardó alguna vez. */
  initiallySaved?: boolean;
  /** El paso que sigue, para la barra de guardado. */
  next?: { label: string; href: string };
}) {
  const assistant = assistantName.trim() || "tu asistente";
  const router = useRouter();
  const [core, setCore] = useState<CoreState>({
    mission: initialCore.mission ?? "",
    audience: initialCore.audience ?? "",
    success_criteria: initialCore.success_criteria ?? "",
    voice_tone: initialCore.voice_tone ?? "",
    voice_use: initialCore.voice_use ?? "",
    voice_avoid: initialCore.voice_avoid ?? "",
    scope: initialCore.scope ?? "",
    key_actions: initialCore.key_actions ?? "",
  });
  const [moments, setMoments] = useState<MomentTexts>({
    opening: initialStoryboard.opening ?? "",
    development: initialStoryboard.development ?? "",
    next_steps: initialStoryboard.next_steps ?? "",
    closing: initialStoryboard.closing ?? "",
  });
  const [attachments, setAttachments] = useState<Storyboard["attachments"]>(
    initialStoryboard.attachments ?? {}
  );
  // Las notas antiguas (alcance, acciones clave) solo se muestran si traían texto.
  const [legacy] = useState({
    scope: Boolean(initialCore.scope?.trim()),
    key_actions: Boolean(initialCore.key_actions?.trim()),
  });
  // La voz y los momentos son opcionales: plegados, salvo que ya tengan texto.
  const [openInitially] = useState(() => ({
    voice: VOICE_FIELDS.some((field) => initialCore[field.key]?.trim()),
    moments:
      MOMENTS.some((moment) => initialStoryboard[moment.key]?.trim()) ||
      Object.values(initialStoryboard.attachments ?? {}).some((files) => files?.length),
  }));
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(initiallySaved);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<StoryboardMomentKey | null>(null);
  const fileInputs = useRef<Partial<Record<StoryboardMomentKey, HTMLInputElement | null>>>({});

  const setCoreField = (key: keyof CoreState, value: string) => {
    setCore((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };
  const setMoment = (key: StoryboardMomentKey, value: string) => {
    setMoments((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/program`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ core_prompt: core, storyboard: moments }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo guardar");
        return;
      }
      setIsDirty(false);
      setSaved(true);
      toast.success("Tu programa quedó guardado");
      router.refresh();
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (moment: StoryboardMomentKey, file: File) => {
    setUploading(moment);
    try {
      const formData = new FormData();
      formData.append("moment", moment);
      formData.append("file", file);
      const res = await fetch(`/api/workspaces/${workspaceSlug}/program/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo subir el archivo");
        return;
      }
      const attachment: StoryboardAttachment = data.attachment;
      setAttachments((prev) => ({
        ...prev,
        [moment]: [...(prev?.[moment] ?? []), attachment],
      }));
      toast.success(`Archivo agregado: ${assistant} puede enviarlo en este momento`);
    } catch {
      toast.error("Error de conexión al subir el archivo");
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (moment: StoryboardMomentKey, id: string) => {
    const res = await fetch(`/api/workspaces/${workspaceSlug}/program/attachments/${id}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!res?.ok) {
      toast.error("No se pudo quitar el archivo");
      return;
    }
    setAttachments((prev) => ({
      ...prev,
      [moment]: (prev?.[moment] ?? []).filter((att) => att.id !== id),
    }));
    toast.success("Archivo quitado");
  };

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Tu programa</h1>
        <p className="mt-1 text-neutral-600">
          Completa Misión, A quién acompaña y Criterio de éxito para marcar este paso como listo. Lo
          demás es opcional: si lo dejas vacío, {assistant} usa el ejemplo.
        </p>
      </div>

      <Card className="space-y-6 border-neutral-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Propósito</h2>
        {PURPOSE_FIELDS.map((field) => (
          <ExampleField
            key={field.key}
            id={field.key}
            label={field.label}
            hint={field.hint}
            value={core[field.key]}
            example={DEFAULT_CORE_PROMPT[field.key]}
            onChange={(value) => setCoreField(field.key, value)}
            rows={field.rows}
            assistantName={assistant}
          />
        ))}
        {legacy.key_actions && (
          <ExampleField
            id="key_actions"
            label="Acciones clave"
            hint="Notas que tenías guardadas: puedes moverlas a «Qué no hace» o borrarlas."
            value={core.key_actions}
            onChange={(value) => setCoreField("key_actions", value)}
          />
        )}
        {legacy.scope && (
          <ExampleField
            id="scope"
            label="Alcance"
            hint="Notas que tenías guardadas: puedes moverlas a «Qué no hace» o borrarlas."
            value={core.scope}
            onChange={(value) => setCoreField("scope", value)}
          />
        )}
      </Card>

      <Card className="border-neutral-200 p-5 shadow-sm">
        <details open={openInitially.voice} className="group">
          <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="mt-1 h-4 w-4 flex-shrink-0 text-neutral-500 transition-transform group-open:rotate-90" />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Ajustar la voz <span className="font-normal text-neutral-500">(opcional)</span>
              </h2>
              <p className="mt-0.5 text-sm text-neutral-600">
                {assistant} siempre tutea y escribe mensajes cortos, como en WhatsApp.
              </p>
            </div>
          </summary>
          <div className="mt-6 space-y-6">
            {VOICE_FIELDS.map((field) => (
              <ExampleField
                key={field.key}
                id={field.key}
                label={field.label}
                hint={field.hint}
                value={core[field.key]}
                example={DEFAULT_CORE_PROMPT[field.key]}
                onChange={(value) => setCoreField(field.key, value)}
                rows={field.rows}
                assistantName={assistant}
              />
            ))}
          </div>
        </details>
      </Card>

      <Card className="border-neutral-200 p-5 shadow-sm">
        <details open={openInitially.moments} className="group">
          <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="mt-1 h-4 w-4 flex-shrink-0 text-neutral-500 transition-transform group-open:rotate-90" />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Ajustar los momentos{" "}
                <span className="font-normal text-neutral-500">(opcional)</span>
              </h2>
              <p className="mt-0.5 text-sm text-neutral-600">
                El arco que sigue cada conversación. Puedes adjuntar una imagen, un audio o un PDF a
                un momento para que {assistant} lo envíe ahí.
              </p>
            </div>
          </summary>
          <div className="mt-6 space-y-6">
            {MOMENTS.map((moment, index) => {
              const files = attachments?.[moment.key] ?? [];
              return (
                <div key={moment.key} className="space-y-2">
                  <ExampleField
                    id={`moment-${moment.key}`}
                    label={`${index + 1}. ${moment.title}`}
                    hint={moment.hint}
                    value={moments[moment.key]}
                    example={DEFAULT_STORYBOARD[moment.key]}
                    onChange={(value) => setMoment(moment.key, value)}
                    rows={2}
                    assistantName={assistant}
                  />
                  {files.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {files.map((att) => (
                        <li
                          key={att.id}
                          className="flex max-w-full items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        >
                          <PaperclipIcon className="h-3.5 w-3.5 flex-shrink-0 text-neutral-500" />
                          <a
                            href={`/api/workspaces/${workspaceSlug}/program/attachments/${att.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-neutral-800 hover:underline"
                            title={`${att.name} (${attachmentKind(att.type)})`}
                          >
                            {att.name}
                          </a>
                          <ConfirmDialog
                            title="¿Quitar este archivo?"
                            description={`${assistant} ya no va a enviar «${att.name}».`}
                            confirmLabel="Quitar"
                            onConfirm={() => handleRemove(moment.key, att.id)}
                          >
                            <button
                              type="button"
                              aria-label={`Quitar ${att.name}`}
                              className="text-neutral-500 hover:text-red-600"
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
                      fileInputs.current[moment.key] = el;
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
                  <button
                    type="button"
                    disabled={uploading !== null}
                    onClick={() => fileInputs.current[moment.key]?.click()}
                    className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
                  >
                    {uploading === moment.key ? (
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PaperclipIcon className="h-3.5 w-3.5" />
                    )}
                    {uploading === moment.key ? "Subiendo…" : "Agregar imagen, audio o PDF"}
                  </button>
                </div>
              );
            })}
          </div>
        </details>
      </Card>

      <SaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        saved={saved}
        next={next}
      />
    </div>
  );
}
