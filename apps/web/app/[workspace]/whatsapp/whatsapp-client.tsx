'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Circle, Copy, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CifrasCanal } from '@/lib/data/whatsapp'
import {
  ETIQUETA_ESTADO,
  ETIQUETA_ESTADO_CLIENTE,
  fechaCorta,
  type ConexionWhatsapp,
  type EstadoConexion,
  type PasoChecklist,
  type PasoManualId,
} from '@/lib/whatsapp-checklist'

type Checklist = { pasos: PasoChecklist[]; estado: EstadoConexion; hechos: number }

const TOTAL_PASOS = 6

const COLOR_ESTADO: Record<EstadoConexion, string> = {
  activo: 'bg-green-50 text-green-800 border-green-200',
  esperando_mensaje: 'bg-blue-50 text-blue-800 border-blue-200',
  en_configuracion: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  sin_configurar: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  pausado: 'bg-amber-50 text-amber-800 border-amber-200',
}

function EstadoBadge({ estado, cliente = false }: { estado: EstadoConexion; cliente?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${COLOR_ESTADO[estado]}`}>
      {cliente ? ETIQUETA_ESTADO_CLIENTE[estado] : ETIQUETA_ESTADO[estado]}
    </span>
  )
}

/** Copia un texto al portapapeles con un aviso corto. */
function BotonCopiar({ texto, etiqueta = 'Copiar' }: { texto: string; etiqueta?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          toast.success('Copiado')
        } catch {
          toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.')
        }
      }}
    >
      <Copy className="w-3.5 h-3.5 mr-1.5" />
      {etiqueta}
    </Button>
  )
}

export function WhatsAppClient(props: {
  workspaceSlug: string
  workspaceName: string
  assistantName: string
  rol: 'plural' | 'cliente'
  puedeCambiarVista: boolean
  conexion: ConexionWhatsapp | null
  displayNumber: string | null
  checklist: Checklist
  engineResponde: boolean
  cifras: CifrasCanal
  /** Solo en la vista Plural, y solo si ENGINE_PUBLIC_URL está definido. */
  webhookUrl: string | null
}) {
  return props.rol === 'cliente' ? <VistaCliente {...props} /> : <VistaPlural {...props} />
}

// ── Cliente: estado y cifras, nada técnico ─────────────────────────────────

function VistaCliente({
  workspaceSlug,
  assistantName,
  puedeCambiarVista,
  displayNumber,
  checklist,
  cifras,
}: Parameters<typeof WhatsAppClient>[0]) {
  const nombre = assistantName.trim() || 'Tu asistente'
  const estado = checklist.estado
  const contacto = (
    <a href="mailto:hola@estudio-plural.co" className="font-medium text-neutral-900 underline underline-offset-2">
      Escríbenos a hola@estudio-plural.co
    </a>
  )
  return (
    <div className="space-y-6 max-w-3xl">
      {puedeCambiarVista && (
        <p className="text-sm text-neutral-600">
          Estás viendo lo que ve la organización.{' '}
          <Link href={`/${workspaceSlug}/whatsapp`} className="font-medium text-neutral-900 underline underline-offset-2">
            Volver a la vista de Plural
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">WhatsApp</h1>
        <EstadoBadge estado={estado} cliente />
      </div>

      {estado === 'activo' ? (
        <>
          <Card className="p-6 border border-neutral-200 shadow-sm space-y-4">
            <p className="text-lg text-neutral-900">
              {nombre} responde en WhatsApp
              {displayNumber ? <> en <span className="font-semibold">{displayNumber}</span></> : null}. Compártelo con
              las personas de tu programa.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={`/${workspaceSlug}/operar`}>Ver cómo va →</Link>
              </Button>
              {displayNumber && <BotonCopiar texto={displayNumber} etiqueta="Copiar el número" />}
            </div>
            <Link
              href={`/${workspaceSlug}/chat`}
              className="inline-block text-sm font-medium text-neutral-700 underline-offset-2 hover:underline"
            >
              Probar cambios antes de que lleguen a WhatsApp
            </Link>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Cifra valor={cifras.personasAceptaron} etiqueta="personas aceptaron el aviso de privacidad" />
            <Cifra valor={cifras.conversaciones7d} etiqueta="conversaciones en los últimos 7 días" />
            <Cifra valor={cifras.mensajes7d} etiqueta="mensajes recibidos en los últimos 7 días" />
          </div>
        </>
      ) : (
        <Card className="p-6 border border-neutral-200 shadow-sm space-y-3">
          <p className="text-lg text-neutral-900">
            {estado === 'pausado' ? (
              'Pausamos las respuestas en WhatsApp. Escríbenos si quieres reactivarlas.'
            ) : estado === 'esperando_mensaje' ? (
              <>
                Tu número ya está conectado. Último paso: escríbele «hola» desde tu celular
                {displayNumber ? <> al <span className="font-semibold">{displayNumber}</span></> : ' a tu número'} y
                confirma que te responde.
              </>
            ) : estado === 'sin_configurar' ? (
              <>
                Para que {nombre} responda en WhatsApp, conectamos el número de tu organización. Escríbenos y lo hacemos
                contigo.
              </>
            ) : (
              'Estamos conectando tu número de WhatsApp. Te escribimos cuando esté listo; mientras tanto, prueba tu asistente aquí.'
            )}
          </p>
          {estado === 'esperando_mensaje' && displayNumber && (
            <BotonCopiar texto={displayNumber} etiqueta="Copiar el número" />
          )}
          {estado !== 'sin_configurar' && <p className="text-sm text-neutral-600">¿Dudas? {contacto}</p>}
        </Card>
      )}

      {estado === 'sin_configurar' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href={`mailto:hola@estudio-plural.co?subject=${encodeURIComponent(`Conectar WhatsApp: ${nombre}`)}`}>
              Pedir la conexión
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/${workspaceSlug}/chat`}>Probar tu asistente</Link>
          </Button>
        </div>
      ) : (
        estado !== 'activo' &&
        estado !== 'esperando_mensaje' && (
          <Button asChild size="lg">
            <Link href={`/${workspaceSlug}/chat`}>Probar tu asistente →</Link>
          </Button>
        )
      )}
    </div>
  )
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <Card className="p-5 border border-neutral-200 shadow-sm">
      <p className="text-3xl font-bold text-neutral-900">{valor.toLocaleString('es-CO')}</p>
      <p className="text-sm text-neutral-600 mt-1">{etiqueta}</p>
    </Card>
  )
}

// ── Plural: checklist real + formulario ────────────────────────────────────

function VistaPlural({
  workspaceSlug,
  workspaceName,
  conexion,
  checklist,
  engineResponde,
  webhookUrl,
}: Parameters<typeof WhatsAppClient>[0]) {
  const router = useRouter()
  const [form, setForm] = useState({
    phoneNumberId: conexion?.phoneNumberId ?? '',
    displayNumber: conexion?.displayNumber ?? '',
    wabaId: conexion?.wabaId ?? '',
    tokenEnv: conexion?.tokenEnv ?? '',
    enabled: conexion?.enabled ?? true,
  })
  const [guardando, setGuardando] = useState<string | null>(null)

  const guardar = async (pasos: Partial<Record<PasoManualId, boolean>>, que: string) => {
    setGuardando(que)
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/whatsapp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pasos }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'No pudimos guardar. Intenta de nuevo.')
        return
      }
      toast.success('Guardado')
      router.refresh()
    } catch {
      toast.error('No pudimos guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(null)
    }
  }

  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Conectar WhatsApp</h1>
          <EstadoBadge estado={checklist.estado} />
        </div>
        <p className="text-neutral-600">
          Número de <span className="font-medium text-neutral-900">{workspaceName}</span> en Meta Cloud API. Solo lo ve el
          equipo de Plural.{' '}
          <Link href={`/${workspaceSlug}/whatsapp?vista=cliente`} className="font-medium text-neutral-900 underline underline-offset-2">
            Ver como la organización
          </Link>
        </p>
      </div>

      {!engineResponde && (
        <Aviso>
          No pudimos confirmar el token ni el app secret porque el servidor del asistente no respondió. Revisa que esté
          encendido y recarga esta página.
        </Aviso>
      )}
      {conexion?.lastError && (
        <Aviso>
          Último error{conexion.lastErrorAt ? ` (${fechaCorta(conexion.lastErrorAt)})` : ''}: {conexion.lastError}
        </Aviso>
      )}

      <Card className="p-6 border border-neutral-200 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Checklist · {checklist.hechos} de {TOTAL_PASOS}</h2>
        <ol className="space-y-4">
          {checklist.pasos.map((p) => (
            <li key={p.id} className="flex gap-3">
              {p.hecho ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-label="Hecho" />
              ) : (
                <Circle className="w-5 h-5 text-neutral-300 flex-shrink-0 mt-0.5" aria-label="Pendiente" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900">{p.titulo}</p>
                  {p.modo === 'manual' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={guardando !== null}
                      onClick={() => guardar({ [p.id]: !p.hecho }, p.id)}
                    >
                      {guardando === p.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {p.hecho ? 'Desmarcar' : 'Marcar como hecho'}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-neutral-700">{p.evidencia}</p>
                <p className="text-sm text-neutral-500">{p.detalle}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-6 border border-neutral-200 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Datos del número</h2>
        <p className="text-sm text-neutral-600 mb-4">
          El token nunca se escribe aquí: se carga en el servidor del asistente y aquí va solo el nombre de la variable.
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            guardar({}, 'datos')
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CampoTexto id="pnid" label="phone_number_id" value={form.phoneNumberId} onChange={campo('phoneNumberId')} placeholder="1062537536952098" inputMode="numeric" />
            <CampoTexto id="display" label="Número visible" value={form.displayNumber} onChange={campo('displayNumber')} placeholder="+57 315 000 0000" />
            <CampoTexto id="waba" label="ID de la WABA" value={form.wabaId} onChange={campo('wabaId')} placeholder="1834726783925571" inputMode="numeric" />
            <CampoTexto id="token" label="Variable del token en el servidor" value={form.tokenEnv} onChange={campo('tokenEnv')} placeholder="META_TOKEN_MI_PROGRAMA" />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              className="h-4 w-4"
            />
            Responder los mensajes que lleguen a este número
          </label>
          <Button type="submit" disabled={guardando !== null} className="bg-neutral-900 hover:bg-neutral-800">
            {guardando === 'datos' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar datos
          </Button>
        </form>
      </Card>

      {webhookUrl && (
        <Card className="p-6 border border-neutral-200 shadow-sm space-y-2">
          <h2 className="text-lg font-semibold text-neutral-900">Webhook en Meta</h2>
          <p className="text-sm text-neutral-600">Pega esta URL en la configuración del webhook y activa el campo «messages».</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded bg-neutral-100 px-2 py-1 text-sm">{webhookUrl}</code>
            <BotonCopiar texto={webhookUrl} />
          </div>
        </Card>
      )}
    </div>
  )
}

function CampoTexto(props: {
  id: string
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  inputMode?: 'numeric'
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id} className="text-sm font-medium text-neutral-900">
        {props.label}
      </Label>
      <Input
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        autoComplete="off"
        spellCheck={false}
        className="h-10 font-mono text-sm"
      />
    </div>
  )
}

// Fallas técnicas: gris neutro (el ámbar es solo para riesgos de seguridad).
function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
      <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-neutral-500" />
      <p>{children}</p>
    </div>
  )
}
