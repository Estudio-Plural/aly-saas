"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import {
  CHANNEL_LABELS,
  CHANNEL_TARGET_LABELS,
  channelTargetError,
  type AlertChannel,
  type AlertProtocol,
} from "@/lib/operar";
import { OperarNav } from "../operar-nav";

const RESPONSE_TIMES = [1, 4, 12, 24, 48, 72];

function horas(n: number) {
  return n === 1 ? "1 hora" : `${n} horas`;
}

export function ProtocoloClient({
  workspaceSlug,
  assistantName,
  initialProtocol,
  esPlural,
}: {
  workspaceSlug: string;
  assistantName: string;
  initialProtocol: AlertProtocol;
  /** Telegram lo configura el equipo de Plural (hay que agregar el bot al grupo). */
  esPlural: boolean;
}) {
  const [saved, setSaved] = useState(initialProtocol);
  const [form, setForm] = useState(initialProtocol);
  const [isSaving, setIsSaving] = useState<"activar" | "guardar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (fields: Partial<AlertProtocol>) => {
    setForm((prev) => ({ ...prev, ...fields }));
    setError(null);
  };

  const missing = (p: AlertProtocol): string | null => {
    if (!p.responsibleName.trim()) return "Para activarlo, di quién responde.";
    if (!p.channel) return "Para activarlo, elige por dónde avisar.";
    const targetError = channelTargetError(p.channel, p.channelTarget);
    if (targetError) return `${targetError}.`;
    if (!p.responseTimeHours) return "Para activarlo, define en cuánto tiempo responden.";
    return null;
  };

  const save = async (active: boolean) => {
    if (active) {
      const problem = missing(form);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setIsSaving(active ? "activar" : "guardar");
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/operar/protocolo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsibleName: form.responsibleName,
          channel: form.channel,
          channelTarget: form.channelTarget,
          responseTimeHours: form.responseTimeHours,
          active,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "No se pudo guardar el protocolo");
        return;
      }
      setSaved(data.protocol);
      setForm(data.protocol);
      toast.success(data.protocol.active ? "Alertas activas" : "Protocolo guardado, sin activar");
    } catch {
      setError("Error de conexión al guardar");
    } finally {
      setIsSaving(null);
    }
  };

  const isDirty = JSON.stringify({ ...form, updatedAt: null }) !== JSON.stringify({ ...saved, updatedAt: null });
  const target = form.channel ? CHANNEL_TARGET_LABELS[form.channel] : null;
  // Telegram solo para Plural (o si ya quedó configurado así, para que se vea el valor).
  const channels = (Object.keys(CHANNEL_LABELS) as AlertChannel[]).filter(
    (key) => key !== "telegram" || esPlural || saved.channel === "telegram"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Protocolo ante riesgo</h1>
        <p className="text-neutral-700 mt-1 max-w-2xl">
          Una alerta solo sirve si alguien la atiende. Define quién responde, por dónde le avisamos y en
          cuánto tiempo. El aviso dice qué alerta se activó y cuándo; nunca incluye los mensajes de la
          persona.
        </p>
      </div>

      <OperarNav workspaceSlug={workspaceSlug} />

      {saved.active && saved.channel ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <ShieldCheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-700" />
          <div className="text-sm text-green-900">
            <p className="font-semibold">Alertas activas</p>
            <p>
              Cuando {assistantName} detecta una situación de riesgo, avisamos a{" "}
              <strong>{saved.responsibleName}</strong> por {CHANNEL_LABELS[saved.channel].toLowerCase()} y
              tu equipo se compromete a responder en {horas(saved.responseTimeHours ?? 0)}. El equipo de
              Plural también recibe el aviso.
              {saved.channel === "whatsapp" &&
                " El aviso por WhatsApp empieza cuando conectes WhatsApp; hasta entonces solo le llega a Plural."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <ShieldAlertIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-500" />
          <div className="text-sm text-neutral-800">
            <p className="font-semibold text-neutral-900">Las alertas todavía no están activas</p>
            <p>
              Mientras tanto, a tu equipo no le llega ningún aviso: las situaciones de riesgo que detecte{" "}
              {assistantName} las revisa el equipo de Plural.
            </p>
          </div>
        </div>
      )}

      <Card className="px-5 gap-5">
        <div className="space-y-2">
          <Label htmlFor="responsable">¿Quién responde?</Label>
          <Input
            id="responsable"
            value={form.responsibleName}
            onChange={(e) => update({ responsibleName: e.target.value })}
            placeholder="Coordinación psicosocial, o el nombre de la persona"
            maxLength={120}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="canal">¿Por dónde le avisamos?</Label>
            <Select
              value={form.channel ?? ""}
              onValueChange={(value) => update({ channel: value as AlertChannel, channelTarget: "" })}
            >
              <SelectTrigger id="canal" className="w-full">
                <SelectValue placeholder="Elige un canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((key) => (
                  <SelectItem key={key} value={key}>
                    {CHANNEL_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="destino">{target?.label ?? "Destino del aviso"}</Label>
            <Input
              id="destino"
              value={form.channelTarget}
              onChange={(e) => update({ channelTarget: e.target.value })}
              placeholder={target?.placeholder ?? "Primero elige un canal"}
              disabled={!form.channel}
              maxLength={200}
            />
          </div>
        </div>
        {!esPlural && form.channel !== "telegram" && (
          <p className="text-xs text-neutral-600 -mt-3">
            ¿Usan Telegram? Pídele a Plural que conecte tu grupo.
          </p>
        )}
        {form.channel === "telegram" && (
          <p className="text-xs text-neutral-600 -mt-3">
            Agrega el bot de alertas de Plural a tu grupo y pega aquí el id del chat. Si no sabes cómo,
            escríbenos a hola@estudio-plural.co.
          </p>
        )}
        {form.channel === "whatsapp" && (
          <p className="text-xs text-neutral-600 -mt-3">
            El aviso por WhatsApp empieza a funcionar cuando conectes WhatsApp. Mientras tanto, si activas
            el protocolo con este canal, el aviso le llega solo al equipo de Plural.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="tiempo">¿En cuánto tiempo responde tu equipo?</Label>
          <Select
            value={form.responseTimeHours ? String(form.responseTimeHours) : ""}
            onValueChange={(value) => update({ responseTimeHours: Number(value) })}
          >
            <SelectTrigger id="tiempo" className="w-full sm:w-64">
              <SelectValue placeholder="Elige un tiempo" />
            </SelectTrigger>
            <SelectContent>
              {RESPONSE_TIMES.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  En menos de {horas(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-neutral-600">
            Para riesgo de violencia o autolesión, recomendamos 4 horas o menos.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        {saved.active ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => save(false)} disabled={isSaving !== null}>
              {isSaving === "guardar" ? "Desactivando…" : "Desactivar alertas"}
            </Button>
            <Button onClick={() => save(true)} disabled={isSaving !== null || !isDirty}>
              {isSaving === "activar" ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => save(false)}
              disabled={isSaving !== null || !isDirty}
            >
              {isSaving === "guardar" ? "Guardando…" : "Guardar sin activar"}
            </Button>
            <Button onClick={() => save(true)} disabled={isSaving !== null}>
              {isSaving === "activar" ? "Activando…" : "Activar alertas"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
