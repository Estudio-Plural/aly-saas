# ✅ Demo Checklist — Aly SaaS MVP

## 🎯 Status: LISTO PARA PITCH

Todas las páginas del MVP están construidas y funcionando. El demo completo está disponible en `localhost:3000`.

---

## 📋 Pre-Demo Setup (5 minutos antes)

### **Servidor**
- [ ] Dev server corriendo: `cd apps/web && npx next dev`
- [ ] Browser en `http://localhost:3000`
- [ ] Do Not Disturb activado (macOS)
- [ ] Notificaciones silenciadas

### **Tabs Pre-cargados (para agilizar demo)**
1. `localhost:3000/dashboard` (Dashboard)
2. `localhost:3000/demo/settings` (Settings)
3. `localhost:3000/demo/knowledge` (Knowledge Base)
4. `localhost:3000/demo/onboarding` (Onboarding Builder) ⭐
5. `localhost:3000/demo/chat` (Chat Preview)
6. `localhost:3000/demo/whatsapp` (WhatsApp Connection)

### **Documentos de Apoyo**
- [ ] `PITCH_SCRIPT.md` abierto en editor (para referencia)
- [ ] `KAPSO_INTEGRATION.md` listo (por si preguntan técnico)
- [ ] Deck de slides (si lo tenés) en otra ventana

---

## 🎬 Demo Flow (8-10 minutos)

### **1. Dashboard** (60s)
**URL:** `localhost:3000/dashboard`

**Qué mostrar:**
- Grid con 2 workspaces: Demo y Apapáchar
- Stats por workspace (docs, users, chats)
- Hover sobre "Crear Asistente"

**Talking point:**
> "Multi-tenancy visual. Cada workspace es completamente independiente."

---

### **2. Settings** (90s)
**URL:** `localhost:3000/demo/settings`

**Qué mostrar:**
- Form de configuración (izquierda)
- Preview del chat (derecha)
- Cambiar nombre del asistente → preview actualiza en vivo
- Sección de billing (Trial activo)

**Talking point:**
> "Personalización en tiempo real. Lo que ves es lo que van a ver tus usuarios."

---

### **3. Knowledge Base** (60s)
**URL:** `localhost:3000/demo/knowledge`

**Qué mostrar:**
- Tabla con 4 documentos mock
- Área de drag & drop
- Info card explicando RAG

**Talking point:**
> "El conocimiento es el diferenciador. Subís PDFs y el asistente aprende sin alucinar."

---

### **4. Onboarding Builder** ⭐ (3 min)
**URL:** `localhost:3000/demo/onboarding`

**Qué mostrar:**
- Editor de 2 columnas: pasos a la izquierda, Vista Previa en vivo a la derecha
- Flujo inicial pre-cargado (3 pasos: Pregunta → Mensaje → Fin)
- 3 tipos de paso con color: Pregunta (azul), Mensaje (verde), Fin (morado)
- "Agregar paso" (Pregunta / Mensaje / Fin)
- Arrastrar el ícono ⋮⋮ para REORDENAR pasos
- Botón "Editar" inline + variables {name}
- Botón "Guardar"

**Talking point:**
> "Este es el 'wow factor'. Flujos conversacionales sin código, con preview en vivo. El flow-builder visual con condicionales es el roadmap Pro."

**Demo actions:**
1. Click "Agregar paso → Pregunta" → aparece un paso nuevo
2. Agarrar el ícono ⋮⋮ → arrastrar para reordenar
3. Click "Editar" en "¿Cómo te llamas?" → cambiar texto y variable inline
4. Mostrar cómo la Vista Previa (derecha) se actualiza en vivo
5. Click "Guardar" → localStorage persiste

---

### **5. Chat Preview** (60s)
**URL:** `localhost:3000/demo/chat`

**Qué mostrar:**
- Interfaz de chat estilo mensajería (azul + blanco)
- Escribir mensaje manual: "Hola, ¿qué hacés?"
- Click "Simular Conversación" → 5 mensajes automáticos con delays
- Typing indicators

**Talking point:**
> "La experiencia final. Respuestas naturales, contexto preservado, indistinguible de un humano."

---

### **6. WhatsApp Connection** (90s)
**URL:** `localhost:3000/demo/whatsapp`

**Qué mostrar:**
- Estado inicial: "Número no conectado"
- Click "Conectar WhatsApp Business"
- QR mock + instrucciones
- Esperar 5s → estado cambia a "Conectado"
- Ver stats de mensajes

**Talking point:**
> "Con Kapso, conectar WhatsApp toma 2 minutos. Sin API de Meta, sin meses de approval."

---

## 💰 Pricing Slide (2 min)

**Verbalmente o en slide separado:**

### **Planes**
| Plan | Precio | Incluye |
|------|--------|---------|
| Trial | Gratis 14d | 100 mensajes |
| Pro | $49/mes | 1k mensajes |
| Enterprise | Custom | Volumen alto |

### **Costos operacionales**
- Kapso: $0.002/mensaje
- Claude: $0.001/mensaje
- Total: **$0.003/mensaje**

### **Margen**
- Precio: $0.05/mensaje
- Costo: $0.003/mensaje
- **Margen: 94%** 📈

### **Ejemplo real**
> "Cliente con 5k mensajes/mes → le cobrás $49 + $200 = $249. Tus costos: $15. Ganancia: **$234/mes por cliente.**"

---

## 🛡️ Objeciones Comunes (preparate para estas)

### **1. "Ya existen chatbots de WhatsApp"**
**Respuesta:**
> "Sí, pero son keyword triggers rígidos. Nosotros usamos Claude con RAG. Es como comparar un formulario con un consultor experto."

---

### **2. "¿Por qué no usar ChatGPT?"**
**Respuesta:**
> "ChatGPT no tiene: (1) integración WhatsApp, (2) RAG multi-tenant, (3) flows de onboarding, (4) billing. Nosotros somos ChatGPT + toda la infraestructura."

---

### **3. "Suena caro de operar"**
**Respuesta:**
> "Costo: $0.003/mensaje. Precio: $0.05. Margen: 94%. Pocos SaaS tienen estos márgenes."

---

### **4. "¿Qué pasa si Claude se cae?"**
**Respuesta:**
> "Fallback a GPT-4, retry automático, mensaje de error graceful. Claude tiene 99.9% uptime."

---

### **5. "¿Por qué no lo construyen ellos?"**
**Respuesta:**
> "Podrían, pero serían 4 meses de un dev senior ($32k) vs $49/mes con nosotros. Estás en vivo en 30 minutos."

---

## 📞 Closing

### **Para inversores:**
> "Estamos levantando $200k seed para:
> - Beta cerrada con 10 pilotos
> - 1 dev full-time
> - Marketing inicial
>
> Proyección: 100 clientes en 12 meses = ~$4,900 MRR (~$59k ARR). **¿Cuándo agendamos follow-up?**"

### **Para clientes:**
> "Beta en 2 semanas. 5 spots early adopter:
> - 50% off primeros 6 meses
> - Onboarding 1-on-1
> - Feature requests priorizadas
>
> **¿Te sumás?**"

---

## 📁 Archivos de Referencia

### **En este repo:**
- `PITCH_SCRIPT.md` — Guión completo con timing
- `KAPSO_INTEGRATION.md` — Arquitectura técnica
- `MVP_STATUS.md` — Estado actual del proyecto
- `supabase/migrations/002_add_kapso_integration.sql` — Schema de WhatsApp

### **URLs para compartir después:**
- GitHub: `https://github.com/Estudio-Plural/aly-saas`
- Staging (cuando esté): `https://aly-demo.vercel.app`
- Docs de Kapso: `https://docs.kapso.ai`

---

## 🎯 Success Metrics

**Después del pitch, considerá exitoso si:**
- ✅ Hicieron preguntas técnicas (están interesados)
- ✅ Pidieron follow-up (no es un "no" directo)
- ✅ Preguntaron por pricing (están evaluando económicamente)
- ✅ Compartieron su caso de uso (están imaginando cómo usarlo)

**Red flags:**
- ❌ No hicieron preguntas (no prestaron atención)
- ❌ "Interesante pero no para nosotros" (no hay pain point)
- ❌ "Hablamos en 6 meses" (prioridades en otro lado)

---

## 🚀 Post-Pitch Actions

- [ ] Enviar email de follow-up en <24h con:
  - Grabación de la demo (Loom)
  - Pitch deck (si tenés)
  - Respuestas a preguntas pendientes
  - Calendly para próxima reunión

- [ ] Actualizar CRM/spreadsheet con:
  - Nivel de interés (1-5)
  - Objeciones principales
  - Timeline de decisión
  - Próximos pasos acordados

- [ ] Si dijeron "sí":
  - Enviar contrato/LOI
  - Agendar onboarding call
  - Crear workspace en staging

---

**¡Mucha suerte! 🎉**
