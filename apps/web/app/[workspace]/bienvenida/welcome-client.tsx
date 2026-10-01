"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExampleField } from "@/components/example-field";
import { SaveBar } from "@/components/save-bar";
import { LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { uid } from "@/lib/utils";
import {
  PREGUNTA_CONSENTIMIENTO,
  DESPEDIDA_RECHAZO,
  nextAfterDesignStep,
  toVariableName,
  type ProfileQuestion,
  type Welcome,
} from "@/lib/design";
import { useDesignSave } from "@/lib/use-design-save";

type QuestionDraft = ProfileQuestion & { optionsText: string };

const PRESETS: { label: string; question: string; variable: string; options: string[] }[] = [
  { label: "Región", question: "¿En qué región vives?", variable: "region", options: [] },
  {
    label: "Género",
    question: "¿Con qué género te identificas?",
    variable: "genero",
    options: ["Mujer", "Hombre", "No binario", "Prefiero no decir"],
  },
  { label: "Edad", question: "¿Cuántos años tienes?", variable: "edad", options: [] },
];

function toDraft(q: ProfileQuestion): QuestionDraft {
  return { ...q, optionsText: q.options.join(", ") };
}

function parseOptions(text: string): string[] {
  return text
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

/** Aviso modelo para adaptar: no promete privacidad (la conversación queda guardada). */
function privacyModel(org: string): string {
  return `Antes de empezar, algo importante: ${org} guarda lo que escribes aquí para acompañarte y mejorar el programa. Un equipo pequeño de ${org} puede leer las conversaciones para cuidar el acompañamiento. No compartimos tus datos con nadie más sin tu permiso, y puedes pedir que los borremos cuando quieras escribiendo a [correo de contacto].`;
}

type Errors = { privacy?: string; url?: string };

/** Nombre de dato único y estable (se fija la primera vez que se guarda). */
function uniqueVariable(base: string, taken: Set<string>): string {
  let name = base;
  let n = 2;
  while (taken.has(name)) name = `${base.slice(0, 27)}_${n++}`;
  return name;
}

export function WelcomeClient({
  workspaceSlug,
  assistantName,
  orgName,
  initial,
  next: nextProp,
}: {
  workspaceSlug: string;
  assistantName: string;
  /** Nombre de la organización, para el aviso modelo (si no llega, queda para completar). */
  orgName?: string;
  initial: Welcome | null;
  /** Siguiente paso según el progreso real (lo calcula la página). */
  next?: { label: string; path: string };
}) {
  const assistant = assistantName.trim() || "tu asistente";
  const welcomeExample = `¡Hola! Soy ${assistant} 👋 Estoy aquí para acompañarte en el programa: puedes contarme cómo vas, pedirme ideas o resolver dudas.`;
  const [welcomeMessage, setWelcomeMessage] = useState(initial?.welcome_message ?? "");
  const [privacyNotice, setPrivacyNotice] = useState(initial?.privacy_notice ?? "");
  const [policyUrl, setPolicyUrl] = useState(initial?.privacy_policy_url ?? "");
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    (initial?.profile_questions ?? []).map(toDraft)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(initial !== null);
  const [errors, setErrors] = useState<Errors>({});
  const { save, isSaving } = useDesignSave(workspaceSlug);
  const next = nextProp ?? nextAfterDesignStep("welcome");

  const dirty =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setIsDirty(true);
    };

  const setQuestion = (id: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    setIsDirty(true);
  };

  const addQuestion = (preset?: (typeof PRESETS)[number]) => {
    setQuestions((prev) => [
      ...prev,
      {
        id: uid(),
        question: preset?.question ?? "",
        variable: preset
          ? uniqueVariable(preset.variable, new Set(prev.map((q) => q.variable)))
          : "",
        options: preset?.options ?? [],
        optionsText: (preset?.options ?? []).join(", "),
      },
    ]);
    setIsDirty(true);
  };

  const handleSave = async () => {
    const url = policyUrl.trim();
    const found: Errors = {};
    if (!privacyNotice.trim()) {
      found.privacy = "Escribe el aviso o usa el modelo y adáptalo.";
    }
    if (url && !/^https?:\/\/\S+$/.test(url)) {
      found.url = "El link debe empezar con http:// o https://";
    }
    setErrors(found);
    if (found.privacy || found.url) return;
    // Bienvenida vacía: se guarda el ejemplo (es lo que el asistente diría igual).
    const message = welcomeMessage.trim() || welcomeExample;
    const taken = new Set(questions.map((q) => q.variable).filter(Boolean));
    const profile: ProfileQuestion[] = questions
      .filter((q) => q.question.trim())
      .map((q) => {
        const variable = q.variable || uniqueVariable(toVariableName(q.question), taken);
        taken.add(variable);
        return {
          id: q.id,
          question: q.question.trim(),
          variable,
          options: parseOptions(q.optionsText),
        };
      });
    const welcome: Welcome = {
      welcome_message: message,
      privacy_notice: privacyNotice,
      privacy_policy_url: url,
      profile_questions: profile,
    };
    const ok = await save({ welcome }, "Bienvenida guardada");
    if (ok) {
      setWelcomeMessage(message);
      setQuestions(profile.map(toDraft));
      setIsDirty(false);
      setSaved(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Bienvenida y consentimiento
        </h1>
        <p className="mt-1 text-neutral-600">
          Lo primero que recibe cada persona cuando escribe por primera vez. Nada de lo que diga se
          guarda hasta que acepte.
        </p>
      </div>

      <Card className="space-y-6 border-neutral-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">1. Bienvenida</h2>
        <ExampleField
          id="welcome_message"
          label="Mensaje de bienvenida"
          hint={`Quién es ${assistant} y en qué puede acompañar.`}
          value={welcomeMessage}
          example={welcomeExample}
          onChange={dirty(setWelcomeMessage)}
          assistantName={assistant}
        />
      </Card>

      <Card className="space-y-6 border-neutral-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">2. Aviso de privacidad</h2>
        <div className="space-y-2">
          <Label htmlFor="privacy_notice" className="text-sm font-medium text-neutral-900">
            Texto del aviso
          </Label>
          <p id="privacy_notice-help" className="text-xs text-neutral-600">
            Se envía exactamente como lo escribas. Revísalo con quien aprueba los textos legales de
            tu organización.
          </p>
          <Textarea
            id="privacy_notice"
            value={privacyNotice}
            onChange={(e) => {
              dirty(setPrivacyNotice)(e.target.value);
              if (errors.privacy) setErrors((prev) => ({ ...prev, privacy: undefined }));
            }}
            rows={5}
            maxLength={5000}
            aria-invalid={Boolean(errors.privacy) || undefined}
            aria-describedby="privacy_notice-help"
            placeholder="Escribe con tus palabras…"
            className="resize-y border-neutral-300 bg-white placeholder:italic"
          />
          {errors.privacy && <p className="text-xs text-red-700">{errors.privacy}</p>}
          {!privacyNotice.trim() && (
            <button
              type="button"
              onClick={() => {
                dirty(setPrivacyNotice)(
                  privacyModel(orgName?.trim() || "[nombre de tu organización]")
                );
                setErrors((prev) => ({ ...prev, privacy: undefined }));
              }}
              className="text-xs font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            >
              Usar un modelo y adaptarlo
            </button>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="privacy_policy_url" className="text-sm font-medium text-neutral-900">
            Link a la política de datos (opcional)
          </Label>
          <Input
            id="privacy_policy_url"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={policyUrl}
            onChange={(e) => {
              dirty(setPolicyUrl)(e.target.value);
              if (errors.url) setErrors((prev) => ({ ...prev, url: undefined }));
            }}
            aria-invalid={Boolean(errors.url) || undefined}
            className="bg-white"
          />
          {errors.url && <p className="text-xs text-red-700">{errors.url}</p>}
        </div>
      </Card>

      <Card className="border-neutral-200 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <LockIcon className="h-4 w-4 text-neutral-500" aria-label="Fijo" />
          <h2 className="text-lg font-semibold text-neutral-900">3. Cómo se acepta</h2>
        </div>
        <p className="mt-0.5 text-sm text-neutral-600">
          Estas reglas son fijas para proteger a las personas y a tu organización.
        </p>
        <div className="mt-4 whitespace-pre-line rounded-lg bg-neutral-100 p-3 text-sm text-neutral-800">
          {PREGUNTA_CONSENTIMIENTO}
        </div>
        <ul className="mt-4 space-y-2 text-sm text-neutral-800">
          <li>
            <span className="font-medium">Acepta</span> si responde «1», «sí», «acepto», «sí,
            acepto» o «estoy de acuerdo».
          </li>
          <li>
            <span className="font-medium">Rechaza</span> solo si responde «2» o un mensaje que
            empieza con «no».
          </li>
          <li>
            <span className="font-medium">Cualquier otra respuesta</span> repite la pregunta.
          </li>
          <li>
            <span className="font-medium">Al rechazar</span> no se guarda ningún dato y recibe: «
            {DESPEDIDA_RECHAZO}»
          </li>
        </ul>
      </Card>

      <Card className="border-neutral-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">
          4. Preguntas de perfil <span className="font-normal text-neutral-500">(opcionales)</span>
        </h2>
        <p className="mt-0.5 text-sm text-neutral-600">
          Se hacen una sola vez, después de aceptar. Sirven para las cifras del programa. Menos
          preguntas, más personas llegan al final.
        </p>

        {questions.length > 0 && (
          <ul className="mt-4 space-y-4">
            {questions.map((q, index) => (
              <li key={q.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${q.id}-question`} className="text-sm">
                        Pregunta {index + 1}
                      </Label>
                      <Input
                        id={`${q.id}-question`}
                        value={q.question}
                        maxLength={300}
                        onChange={(e) => setQuestion(q.id, { question: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${q.id}-options`} className="text-sm">
                        Opciones de respuesta
                      </Label>
                      <Input
                        id={`${q.id}-options`}
                        value={q.optionsText}
                        placeholder="Vacío = respuesta libre. Separa las opciones con comas."
                        onChange={(e) => setQuestion(q.id, { optionsText: e.target.value })}
                        className="placeholder:italic"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Quitar pregunta ${index + 1}`}
                    onClick={() => {
                      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
                      setIsDirty(true);
                    }}
                    className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addQuestion()}
            className="mr-2 flex items-center gap-1.5 text-sm font-medium text-neutral-900 hover:underline"
          >
            <PlusIcon className="h-4 w-4" /> Agregar pregunta
          </button>
          {PRESETS.filter((p) => !questions.some((q) => q.variable === p.variable)).map(
            (preset) => (
              <button
                key={preset.variable}
                type="button"
                onClick={() => addQuestion(preset)}
                className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs italic text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
              >
                + {preset.label}
              </button>
            )
          )}
        </div>
      </Card>

      <SaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        saved={saved}
        next={{ label: next.label, href: `/${workspaceSlug}/${next.path}` }}
      />
    </div>
  );
}
