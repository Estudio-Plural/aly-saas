'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const PHONE_PATTERN = /^\+?[0-9\s().-]{5,30}$/

export function WhatsAppClient({
  workspaceSlug,
  initialPhoneNumber,
}: {
  workspaceSlug: string
  initialPhoneNumber: string | null
}) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '')
  const [savedNumber, setSavedNumber] = useState<string | null>(initialPhoneNumber)
  const [isSaving, setIsSaving] = useState(false)

  const trimmed = phoneNumber.trim()
  const isValid = PHONE_PATTERN.test(trimmed)
  const isUnchanged = trimmed === (savedNumber ?? '')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isUnchanged) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'No pudimos guardar el número. Intenta de nuevo.')
        return
      }
      setSavedNumber(data.workspace?.whatsapp_phone_number ?? trimmed)
      toast.success('Listo. Te escribimos a ese número cuando la conexión esté lista.')
    } catch {
      toast.error('No pudimos guardar el número. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Conexión con WhatsApp: en preparación
        </h1>
        <p className="text-neutral-600 mt-1">
          Estamos habilitando la conexión directa. Déjanos el número de WhatsApp de tu
          organización y te escribimos cuando esté lista.
        </p>
      </div>

      <Card className="p-8 border border-neutral-200 shadow-sm">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-neutral-600" />
          </div>
          <form onSubmit={handleSave} className="flex-1 space-y-3">
            <Label htmlFor="whatsapp-number" className="text-sm font-medium text-neutral-900">
              Número de WhatsApp de tu organización (opcional)
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="whatsapp-number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+57 300 123 4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-11 sm:max-w-xs"
              />
              <Button
                type="submit"
                disabled={!isValid || isUnchanged || isSaving}
                className="h-11 px-6 bg-neutral-900 hover:bg-neutral-800"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar número
              </Button>
            </div>
            {savedNumber && (
              <p className="text-sm text-neutral-600">
                Te avisaremos a <span className="font-medium text-neutral-900">{savedNumber}</span>.
              </p>
            )}
            <p className="text-sm text-neutral-600">
              ¿Prefieres escribirnos? <a href="mailto:hola@estudio-plural.co" className="font-medium text-neutral-900 underline underline-offset-2">hola@estudio-plural.co</a>
            </p>
          </form>
        </div>
      </Card>

      <Link
        href={`/${workspaceSlug}/chat`}
        className="inline-flex items-center text-base font-semibold text-neutral-900 hover:underline underline-offset-4"
      >
        Mientras tanto, prueba tu asistente →
      </Link>
    </div>
  )
}
