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
}: {
  workspaceSlug: string;
  assistantName: string;
  initialProtocol: AlertProtocol;
}) {
  const [saved, setSaved] = useState(initialProtocol);
  const [form, setForm] = useState(initialProtocol);
  const [isSaving, setIsSaving] = useState(false);
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

  const save = async () => {
    if (form.active) {
      const problem = missing(form);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/operar/protocolo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsibleName: form.responsibleName,
          channel: form.channel,
          channelTarget: form.channelTarget,
          responseTimeHours: form.responseTimeHours,
          active: form.active,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "No se pudo guardar el protocolo");
        return;
      }
      setSaved(data.protocol);
      setForm(data.protocol);
      toast.success(data.protocol.active ? "Protocolo activo" : "Protocolo guardado, sin activar");
    } catch {
      setError("Error de conexión al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = JSON.stringify({ ...form, updatedAt: null }) !== JSON.stringify({ ...saved, updatedAt: null });
  const target = form.channel ? CHANNEL_TARGET_LABELS[form.channel] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Operar</h1>
        <p className="text-neutral-700 mt-1">
          Cómo le va a {assistantName} con las personas reales. Solo cifras: sin nombres, números ni
          mensajes.
        </p>
      </div>

      <OperarNav workspaceSlug={workspaceSlug} />

      {saved.active && saved.channel ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <ShieldCheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-700" />
          <div className="text-sm text-green-900">
            <p className="font-semibold">Protocolo activo</p>
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
            <p className="font-semibold text-neutral-900">Sin protocolo activo</p>
            <p>
              Sin protocolo, el asistente no genera alertas para tu equipo. Las situaciones de riesgo las
              revisa el equipo de Plural.
            </p>
          </div>
        </div>
      )}

      <Card className="px-5 gap-5">
        <div>
          <h2 className="font-semibold text-neutral-900">Protocolo ante riesgo</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Una alerta solo sirve si alguien la atiende. Define quién responde, por dónde le avisamos y en
            cuánto tiempo. El aviso dice qué regla se activó y en qué conversación; nunca incluye los
            mensajes de la persona.
          </p>
        </div>

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
                {(Object.keys(CHANNEL_LABELS) as AlertChannel[]).map((key) => (
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
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-neutral-200 px-3 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-neutral-900"
            checked={form.active}
            onChange={(e) => update({ active: e.target.checked })}
          />
          <span className="text-sm">
            <span className="font-medium text-neutral-900">Activar el protocolo</span>
            <span className="block text-neutral-600">
              Tu equipo recibe las alertas de riesgo y se compromete a responder en el tiempo definido.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={isSaving || !isDirty}>
            {isSaving ? "Guardando…" : "Guardar protocolo"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
