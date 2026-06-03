# Integración Kapso → Aly SaaS

## 🎯 Overview

Kapso es la capa de infraestructura de WhatsApp multi-tenant que permite a cada workspace de Aly tener su propio número de WhatsApp conectado.

### **Arquitectura**

```
CEO crea workspace en Aly
    ↓
Aly crea proyecto en Kapso vía Platform API
    ↓
CEO conecta su número WhatsApp (QR scan)
    ↓
Usuario final envía mensaje → Kapso webhook → Aly backend
    ↓
Aly procesa con Claude + RAG del workspace
    ↓
Aly envía respuesta vía Kapso SDK → WhatsApp
```

---

## 📦 Dependencias

```bash
# En apps/api/
bun add @kapso/whatsapp-cloud-api
bun add -D @types/node
```

---

## 🔑 Environment Variables

```bash
# apps/api/.env
KAPSO_MASTER_API_KEY=kpso_xxx  # Tu API key principal de Kapso
KAPSO_WEBHOOK_BASE_URL=https://api.aly.com  # URL pública de tu backend
```

---

## 🛠️ Implementación

### **1. Servicio de Kapso (apps/api/src/services/kapso.service.ts)**

```typescript
import { KapsoClient } from '@kapso/whatsapp-cloud-api'

class KapsoService {
  private masterClient: KapsoClient
  private workspaceClients = new Map<string, KapsoClient>()
  
  constructor() {
    this.masterClient = new KapsoClient({
      apiKey: process.env.KAPSO_MASTER_API_KEY!
    })
  }
  
  // Crear proyecto Kapso para un nuevo workspace
  async createProject(workspaceId: string, workspaceName: string) {
    const project = await this.masterClient.platform.projects.create({
      name: workspaceName,
      webhook_url: `${process.env.KAPSO_WEBHOOK_BASE_URL}/webhooks/kapso/${workspaceId}`
    })
    
    return {
      apiKey: project.api_key,
      webhookSecret: project.webhook_secret,
      setupLink: project.setup_link // Link para que el CEO conecte su número
    }
  }
  
  // Enviar mensaje de WhatsApp
  async sendMessage(workspaceId: string, to: string, text: string) {
    const client = await this.getClient(workspaceId)
    return client.messages.send({
      to,
      type: 'text',
      text: { body: text }
    })
  }
  
  private async getClient(workspaceId: string): Promise<KapsoClient> {
    if (!this.workspaceClients.has(workspaceId)) {
      const workspace = await db.workspaces.findUnique({ where: { id: workspaceId }})
      const client = new KapsoClient({
        apiKey: workspace.kapso_api_key,
        webhookSecret: workspace.kapso_webhook_secret
      })
      this.workspaceClients.set(workspaceId, client)
    }
    return this.workspaceClients.get(workspaceId)!
  }
}

export const kapsoService = new KapsoService()
```

### **2. Webhook Handler (apps/api/src/routes/webhooks/kapso/[workspaceId].ts)**

```typescript
import { verifyKapsoSignature } from '@/lib/security'
import { handleIncomingMessage, updateMessageStatus } from '@/services/chat.service'

export async function POST(req: Request, { params }: { params: { workspaceId: string }}) {
  const signature = req.headers.get('X-Webhook-Signature')!
  const event = req.headers.get('X-Webhook-Event')!
  const body = await req.text()
  const payload = JSON.parse(body)
  
  // 1. Verificar firma HMAC
  const workspace = await db.workspaces.findUnique({ where: { id: params.workspaceId }})
  const isValid = verifyKapsoSignature(body, signature, workspace.kapso_webhook_secret)
  
  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  // 2. Procesar evento
  switch (event) {
    case 'whatsapp.message.received':
      await handleIncomingMessage(params.workspaceId, payload.data)
      break
      
    case 'whatsapp.message.status':
      await updateMessageStatus(payload.data.message_id, payload.data.status)
      break
      
    case 'whatsapp.connection.connected':
      await db.workspaces.update({
        where: { id: params.workspaceId },
        data: { 
          kapso_connection_status: 'connected',
          whatsapp_phone_number: payload.data.phone_number,
          whatsapp_display_name: payload.data.display_name
        }
      })
      break
  }
  
  return Response.json({ ok: true })
}
```

### **3. Chat Service con Claude (apps/api/src/services/chat.service.ts)**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { kapsoService } from './kapso.service'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function handleIncomingMessage(workspaceId: string, message: {
  from: string, // WhatsApp ID
  text: { body: string },
  timestamp: string
}) {
  // 1. Obtener o crear usuario
  let user = await db.users_data.findFirst({
    where: { workspace_id: workspaceId, whatsapp_id: message.from }
  })
  
  if (!user) {
    user = await db.users_data.create({
      data: {
        workspace_id: workspaceId,
        whatsapp_id: message.from,
        status: 'onboarding'
      }
    })
  }
  
  // 2. Construir contexto de conversación
  const previousMessages = await db.users_interactions.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
    take: 10
  })
  
  const messages = [
    ...previousMessages.reverse().map(msg => [
      { role: 'user' as const, content: msg.message_text },
      { role: 'assistant' as const, content: msg.response_text }
    ]).flat(),
    { role: 'user' as const, content: message.text.body }
  ]
  
  // 3. Obtener config del workspace
  const config = await db.workspace_configs.findUnique({
    where: { workspace_id: workspaceId }
  })
  
  // 4. RAG: buscar conocimiento relevante
  const relevantDocs = await vectorSearch(workspaceId, message.text.body)
  const systemPrompt = `${config.prompts.chat_system_es}\n\nConocimiento relevante:\n${relevantDocs.join('\n')}`
  
  // 5. Llamar a Claude
  const response = await anthropic.messages.create({
    model: config.model_preferences.chat || 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages
  })
  
  const assistantReply = response.content[0].text
  
  // 6. Enviar respuesta por WhatsApp
  await kapsoService.sendMessage(workspaceId, message.from, assistantReply)
  
  // 7. Guardar interacción
  await db.users_interactions.create({
    data: {
      workspace_id: workspaceId,
      user_id: user.id,
      message_text: message.text.body,
      response_text: assistantReply,
      message_metadata: { kapso_message_id: message.id }
    }
  })
}
```

---

## 🎨 Frontend: Página de Conexión de WhatsApp

### **Nueva página: apps/web/app/[workspace]/whatsapp/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle, Loader2, Phone } from 'lucide-react'

export default function WhatsAppPage({ params }: { params: { workspace: string }}) {
  const [status, setStatus] = useState<'pending' | 'connecting' | 'connected'>('pending')
  const [setupLink, setSetupLink] = useState<string | null>(null)
  
  const handleConnect = async () => {
    setStatus('connecting')
    
    // Crear proyecto en Kapso
    const res = await fetch(`/api/workspaces/${params.workspace}/kapso/connect`, {
      method: 'POST'
    })
    const { setupLink } = await res.json()
    
    setSetupLink(setupLink)
    
    // Abrir ventana de Kapso
    window.open(setupLink, '_blank', 'width=600,height=800')
    
    // Polling para detectar cuando se conectó
    const interval = setInterval(async () => {
      const status = await fetch(`/api/workspaces/${params.workspace}/kapso/status`)
      const { connected } = await status.json()
      
      if (connected) {
        setStatus('connected')
        clearInterval(interval)
      }
    }, 2000)
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conectar WhatsApp</h1>
        <p className="text-muted-foreground">
          Conectá tu número de WhatsApp Business para activar tu asistente
        </p>
      </div>
      
      <Card className="p-6">
        {status === 'pending' && (
          <div className="text-center space-y-4">
            <Phone className="w-16 h-16 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">Número no conectado</h3>
            <p className="text-sm text-muted-foreground">
              Necesitás un número de WhatsApp Business para que los usuarios puedan hablar con tu asistente
            </p>
            <Button onClick={handleConnect}>
              Conectar Número de WhatsApp
            </Button>
          </div>
        )}
        
        {status === 'connecting' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Esperando conexión...</h3>
            <p className="text-sm text-muted-foreground">
              Seguí los pasos en la ventana de Kapso para escanear el código QR con WhatsApp
            </p>
            {setupLink && (
              <Button variant="outline" onClick={() => window.open(setupLink, '_blank')}>
                Abrir Ventana de Conexión Nuevamente
              </Button>
            )}
          </div>
        )}
        
        {status === 'connected' && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 mx-auto text-green-600" />
            <h3 className="text-lg font-semibold text-green-600">¡Conectado!</h3>
            <p className="text-sm text-muted-foreground">
              Tu asistente ya está activo. Los usuarios pueden hablarle por WhatsApp.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
```

---

## 💰 Pricing Considerations

### **Kapso**
- **Free tier:** 2,000 mensajes/mes
- **Pro:** $0.002 por mensaje adicional
- Números ilimitados ($10/número adicional después de los primeros 3)

### **Claude API**
- **Input:** ~$3 por 1M tokens (~750k palabras)
- **Output:** ~$15 por 1M tokens
- Prompt caching reduce costos un 90% en requests repetidos

### **Modelo de Negocio Aly**
- **Trial:** 14 días gratis (100 mensajes)
- **Pro:** $49/mes (1,000 mensajes incluidos, $0.05/mensaje adicional)
- **Enterprise:** Custom (volumen alto)

**Margen por mensaje:** $0.05 - $0.002 (Kapso) - ~$0.001 (Claude) = **~$0.047 de margen** 📈

---

## 🚀 Roadmap de Implementación

### **Fase 1: MVP Demo (sin Kapso real)**
- ✅ UI del chat preview (mock)
- ✅ Settings page
- ⏳ Página `/whatsapp` con botón "Conectar" (mock)
- ⏳ Mostrar "Estado: Conectado" + número fake

### **Fase 2: Backend Real (Post-Funding)**
1. Crear cuenta en Kapso y obtener API key master
2. Implementar `kapso.service.ts`
3. Webhook handler en `/api/webhooks/kapso/[workspaceId]`
4. Chat service con Claude + RAG
5. Conectar frontend → backend

### **Fase 3: Producción**
1. Deploy backend en Railway/Fly.io/Vercel
2. Configurar dominio público para webhooks
3. Testing con número real de WhatsApp
4. Monitoreo de costos y rate limiting

---

## 📚 Referencias

- [Kapso Docs](https://docs.kapso.ai/docs/whatsapp/typescript-sdk/introduction)
- [Kapso Platform API](https://docs.kapso.ai/docs/platform/webhooks/overview)
- [Kapso Pricing](https://kapso.ai/pricing)
- [Claude API Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering)

---

## Sources:
- [Kapso – WhatsApp for developers](https://kapso.ai/)
- [API setup - Kapso Documentation](https://docs.kapso.ai/docs/build-voice-agents/api)
- [Kapso: Build WhatsApp automation and AI agents](https://agentsindex.ai/kapso)
- [Webhooks overview - Kapso Documentation](https://docs.kapso.ai/docs/platform/webhooks/overview)
- [Quickstart - Kapso Documentation](https://docs.kapso.ai/docs/whatsapp/typescript-sdk/introduction)
- [Kapso Pricing - WhatsApp API Plans](https://kapso.ai/pricing)
- [Pricing - Kapso Documentation](https://docs.kapso.ai/docs/whatsapp/pricing-faq)
