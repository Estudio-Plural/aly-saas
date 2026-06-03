'use client'

import { useState, use } from 'react'
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

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export default function WhatsAppPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [setupLink, setSetupLink] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setStatus('connecting')
    setError(null)

    // TODO: Llamar a /api/workspaces/[id]/kapso/connect
    // Mock: simular la creación del proyecto en Kapso
    setTimeout(() => {
      const mockSetupLink = 'https://app.kapso.ai/setup/demo-workspace-xyz'
      setSetupLink(mockSetupLink)

      // Abrir ventana de Kapso (en producción esto abre el QR scan)
      // window.open(mockSetupLink, '_blank', 'width=600,height=800')

      // Simular polling hasta que se conecte
      setTimeout(() => {
        setStatus('connected')
        setPhoneNumber('+54 11 2345-6789')
      }, 5000) // 5 segundos para la demo
    }, 1000)
  }

  const handleDisconnect = () => {
    setStatus('disconnected')
    setPhoneNumber(null)
    setSetupLink(null)
    toast.success('Número de WhatsApp desconectado')
  }

  const handleRetry = () => {
    setError(null)
    handleConnect()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
          {status === 'connected' && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Conectado
            </Badge>
          )}
          {status === 'connecting' && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              Conectando...
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Conectá tu número de WhatsApp Business para que los usuarios puedan hablar con tu asistente
        </p>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border border-blue-200">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-blue-900 font-semibold">
              ¿Cómo funciona la integración?
            </p>
            <p className="text-blue-800">
              Usamos Kapso para conectar tu número de WhatsApp. Es seguro, rápido, y no requiere acceso a la API de Meta.
              Podés desconectar en cualquier momento.
            </p>
          </div>
        </div>
      </Card>

      {/* Main Connection Card */}
      <Card className="p-12 border border-gray-200 shadow-sm">

        {/* DISCONNECTED STATE */}
        {status === 'disconnected' && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100">
              <Phone className="w-12 h-12 text-gray-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">
                Número no conectado
              </h3>
              <p className="text-base text-gray-600 max-w-md mx-auto">
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

              <p className="text-sm text-gray-500">
                Necesitás tener WhatsApp Business instalado en tu teléfono
              </p>
            </div>
          </div>
        )}

        {/* CONNECTING STATE */}
        {status === 'connecting' && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-100">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">
                Esperando conexión...
              </h3>
              <p className="text-base text-gray-600 max-w-md mx-auto">
                Escaneá el código QR con WhatsApp Business para conectar tu número
              </p>
            </div>

            {/* Mock QR Code */}
            <div className="inline-flex items-center justify-center w-64 h-64 rounded-2xl bg-white border-4 border-blue-600">
              <QrCode className="w-40 h-40 text-gray-300" />
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-6 text-left max-w-md mx-auto border border-gray-200">
                <p className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">ℹ</span>
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
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <p className="text-sm text-gray-700 pt-0.5">{step}</p>
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

            <p className="text-sm text-gray-500">
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
              <p className="text-base text-gray-600">
                Tu asistente ya está activo y listo para recibir mensajes
              </p>
            </div>

            {/* Phone Number Display */}
            {phoneNumber && (
              <div className="bg-gray-50 rounded-xl p-6 max-w-md mx-auto border border-gray-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Número conectado:
                    </span>
                    <span className="text-base font-bold text-gray-900 font-mono">
                      {phoneNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Estado:
                    </span>
                    <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold">
                      Activo
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Conectado hace:
                    </span>
                    <span className="text-sm text-gray-600 font-medium">
                      2 minutos
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="default" className="h-10">
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver en Kapso
              </Button>
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
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h4 className="text-base font-bold text-gray-900 mb-3">
                Probá tu asistente
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Enviá un mensaje a <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">{phoneNumber}</span> desde tu WhatsApp personal para probar el asistente
              </p>
              <Button variant="outline" size="default" className="h-10">
                <MessageCircle className="w-4 h-4 mr-2" />
                Abrir WhatsApp Web
              </Button>
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
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-6 border border-gray-200 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">24</p>
              <p className="text-sm text-gray-600 font-medium">Conversaciones hoy</p>
            </div>
          </Card>

          <Card className="p-6 border border-gray-200 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">156</p>
              <p className="text-sm text-gray-600 font-medium">Mensajes enviados</p>
            </div>
          </Card>

          <Card className="p-6 border border-gray-200 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">98%</p>
              <p className="text-sm text-gray-600 font-medium">Tasa de respuesta</p>
            </div>
          </Card>
        </div>
      )}

      {/* Help Card */}
      <Card className="p-6 bg-gray-50 border border-gray-200">
        <div>
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-600" />
            ¿Necesitás ayuda?
          </h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </div>
              <p>
                <strong className="text-gray-900">¿No tenés WhatsApp Business?</strong>{' '}
                <a href="https://business.whatsapp.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Descargalo acá
                </a>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </div>
              <p>
                <strong className="text-gray-900">¿Problemas para conectar?</strong>{' '}
                <a href="https://docs.kapso.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Ver documentación de Kapso
                </a>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </div>
              <p>
                <strong className="text-gray-900">¿Querés cambiar de número?</strong> Desconectá el actual y conectá uno nuevo
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
