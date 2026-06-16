'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Loader2,
  Phone,
  QrCode,
  ExternalLink,
  AlertCircle,
  Info,
  MessageCircle,
  Clock,
  TrendingUp,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { WhatsappStats } from '@/lib/data/whatsapp'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.round(hours / 24)} días`
}

function generateDemoNumber(): string {
  const part = () => String(Math.floor(1000 + Math.random() * 9000))
  return `+54 9 11 ${part()}-${part()}`
}

export function WhatsAppClient({
  workspaceSlug,
  initialStatus,
  initialPhoneNumber,
  connectedSince,
  stats,
}: {
  workspaceSlug: string
  initialStatus: 'connected' | 'disconnected'
  initialPhoneNumber: string | null
  connectedSince: string
  stats: WhatsappStats
}) {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus)
  const [setupLink, setSetupLink] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState<string | null>(initialPhoneNumber)
  const [connectedAt, setConnectedAt] = useState<string>(connectedSince)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setStatus('connecting')
    setError(null)
    setSetupLink(`https://app.kapso.ai/setup/${workspaceSlug}`)

    // La integración real con Kapso es post-funding: acá se simula el QR scan
    // y se persiste el estado de conexión en la DB del workspace.
    await new Promise((resolve) => setTimeout(resolve, 5000))

    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: generateDemoNumber() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? 'No se pudo guardar la conexión')
        return
      }
      setPhoneNumber(data.workspace.whatsapp_phone_number)
      setConnectedAt(data.workspace.updated_at)
      setStatus('connected')
    } catch {
      setStatus('error')
      setError('Error de conexión con el servidor')
    }
  }

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/whatsapp`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'No se pudo desconectar')
        return
      }
      setStatus('disconnected')
      setPhoneNumber(null)
      setSetupLink(null)
      toast.success('Número de WhatsApp desconectado')
    } catch {
      toast.error('Error de conexión con el servidor')
    }
  }

  const handleRetry = () => {
    setError(null)
    handleConnect()
  }

  const hasMessages = stats.total > 0

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">WhatsApp Business</h1>
          {status === 'connected' && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Conectado
            </Badge>
          )}
          {status === 'connecting' && (
            <Badge className="bg-neutral-100 text-neutral-700 border-neutral-200">
              Conectando...
            </Badge>
          )}
        </div>
        <p className="text-neutral-600 mt-1">
          Conectá tu número de WhatsApp Business para que los usuarios puedan hablar con tu asistente
        </p>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-neutral-50 border border-neutral-200">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-neutral-900 font-semibold">
              ¿Cómo funciona la integración?
            </p>
            <p className="text-neutral-700">
              Usamos Kapso para conectar tu número de WhatsApp. Es seguro, rápido, y no requiere acceso a la API de Meta.
              Podés desconectar en cualquier momento. (En este entorno local la conexión es simulada.)
            </p>
          </div>
        </div>
      </Card>

      {/* Main Connection Card */}
      <Card className="p-12 border border-neutral-200 shadow-sm">

        {/* DISCONNECTED STATE */}
        {status === 'disconnected' && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-neutral-100">
              <Phone className="w-12 h-12 text-neutral-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-900">
                Número no conectado
              </h3>
              <p className="text-base text-neutral-600 max-w-md mx-auto">
                Para activar tu asistente, necesitás conectar un número de WhatsApp Business.
                El proceso toma menos de 2 minutos.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleConnect}
                size="lg"
                className="h-12 px-8 bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                <Phone className="w-5 h-5 mr-2" />
                Conectar WhatsApp Business
              </Button>

              <p className="text-sm text-neutral-600">
                Necesitás tener WhatsApp Business instalado en tu teléfono
              </p>
            </div>
          </div>
        )}

        {/* CONNECTING STATE */}
        {status === 'connecting' && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-neutral-100">
              <Loader2 className="w-12 h-12 text-neutral-900 animate-spin" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-900">
                Esperando conexión...
              </h3>
              <p className="text-base text-neutral-600 max-w-md mx-auto">
                Escaneá el código QR con WhatsApp Business para conectar tu número
              </p>
            </div>

            {/* Mock QR Code */}
            <div className="inline-flex items-center justify-center w-64 h-64 rounded-2xl bg-white border-4 border-neutral-900">
              <QrCode className="w-40 h-40 text-neutral-300" />
            </div>

            <div className="space-y-3">
              <div className="bg-neutral-50 rounded-xl p-6 text-left max-w-md mx-auto border border-neutral-200">
                <p className="text-base font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">ℹ</span>
                  Pasos para conectar:
                </p>
                <div className="space-y-3">
                  {[
                    'Abrí WhatsApp Business en tu teléfono',
                    'Tocá Menú (⋮) → Dispositivos vinculados',
                    'Tocá "Vincular un dispositivo"',
                    'Escaneá este código QR'
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-neutral-900 text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <p className="text-sm text-neutral-700 pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {setupLink && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(setupLink, '_blank')}
                  className="h-10"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir en nueva ventana
                </Button>
              )}
            </div>

            <p className="text-sm text-neutral-600">
              El código QR expira en 60 segundos
            </p>
          </div>
        )}

        {/* CONNECTED STATE */}
        {status === 'connected' && (
          <div className="text-center space-y-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 animate-pulse">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-2xl font-bold text-green-900">
                  ¡WhatsApp conectado exitosamente!
                </h3>
                <Sparkles className="w-6 h-6 text-green-600 animate-pulse" />
              </div>
              <p className="text-base text-neutral-600">
                Tu asistente ya está activo y listo para recibir mensajes
              </p>
            </div>

            {/* Phone Number Display */}
            {phoneNumber && (
              <div className="bg-neutral-50 rounded-xl p-6 max-w-md mx-auto border border-neutral-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Número conectado:
                    </span>
                    <span className="text-base font-bold text-neutral-900 font-mono">
                      {phoneNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Estado:
                    </span>
                    <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold">
                      Activo
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Conectado hace:
                    </span>
                    <span className="text-sm text-neutral-600 font-medium">
                      {relativeTime(connectedAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <ConfirmDialog
                title="¿Desconectar WhatsApp?"
                description="Los usuarios no podrán hablar con tu asistente hasta que vuelvas a conectar un número."
                confirmLabel="Desconectar"
                onConfirm={handleDisconnect}
              >
                <Button
                  variant="outline"
                  size="default"
                  className="h-10 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  Desconectar número
                </Button>
              </ConfirmDialog>
            </div>

            {/* Test Section */}
            <div className="border-t border-neutral-200 pt-6 mt-6">
              <h4 className="text-base font-bold text-neutral-900 mb-3">
                Probá tu asistente
              </h4>
              <p className="text-sm text-neutral-600 mb-4">
                Mientras la integración real con Kapso no está activa, podés probar tu
                asistente desde la <span className="font-semibold">Vista Previa del Chat</span> en el menú lateral.
              </p>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-red-900">
                Error al conectar
              </h3>
              <p className="text-base text-red-600 max-w-md mx-auto">
                {error || 'Hubo un problema al conectar tu número de WhatsApp. Por favor intentá nuevamente.'}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                variant="outline"
                className="h-12 px-8 border-red-300 text-red-700 hover:bg-red-50"
              >
                Reintentar conexión
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Stats Card (only when connected) */}
      {status === 'connected' && (
        hasMessages ? (
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-6 border border-neutral-200 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-neutral-900">{stats.today}</p>
                <p className="text-sm text-neutral-600 font-medium">Mensajes hoy</p>
              </div>
            </Card>

            <Card className="p-6 border border-neutral-200 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-neutral-900">{stats.sent}</p>
                <p className="text-sm text-neutral-600 font-medium">Mensajes enviados</p>
              </div>
            </Card>

            <Card className="p-6 border border-neutral-200 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-neutral-900">{stats.total}</p>
                <p className="text-sm text-neutral-600 font-medium">Mensajes totales</p>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-6 border border-neutral-200 shadow-sm">
            <p className="text-sm text-neutral-600">
              Todavía no hay mensajes de WhatsApp registrados. Cuando la integración con
              Kapso esté activa, acá vas a ver las métricas reales de conversaciones.
            </p>
          </Card>
        )
      )}

      {/* Help Card */}
      <Card className="p-6 bg-neutral-50 border border-neutral-200">
        <div>
          <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-neutral-600" />
            ¿Necesitás ayuda?
          </h3>
          <div className="space-y-3 text-sm text-neutral-700">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </div>
              <p>
                <strong className="text-neutral-900">¿No tenés WhatsApp Business?</strong>{' '}
                <a href="https://business.whatsapp.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Descargalo acá
                </a>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </div>
              <p>
                <strong className="text-neutral-900">¿Problemas para conectar?</strong>{' '}
                <a href="https://docs.kapso.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Ver documentación de Kapso
                </a>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </div>
              <p>
                <strong className="text-neutral-900">¿Querés cambiar de número?</strong> Desconectá el actual y conectá uno nuevo
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
