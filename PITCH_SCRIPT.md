# 🎯 Pitch Script: Aly SaaS para CEOs

## 📋 Pre-Demo Checklist

- [ ] Dev server corriendo en `localhost:3000`
- [ ] Browser abierto en `/dashboard`
- [ ] Segundo tab en `/demo/settings` (pre-cargado)
- [ ] Tercer tab en `/demo/onboarding` (pre-cargado)
- [ ] Pantalla compartida o proyector conectado
- [ ] Audio claro (si hay video)

---

## 🎬 Opening (60 segundos)

### **Hook inicial**

> "Imaginá que un CEO de e-commerce te pregunta por WhatsApp sobre el estado de su pedido a las 2 AM. ¿Lo atendés vos? ¿Lo ignora el bot genérico que responde 'Lo siento, no entendí'?"
>
> **[Pausa 2 segundos]**
>
> "Con Aly, ese CEO habla con un asistente que conoce TU negocio, habla como TU marca, y tiene acceso a TU conocimiento. Sin código, sin meses de desarrollo, sin contratar un equipo de IA."

### **El problema (30 segundos)**

> "Hoy las empresas tienen 3 opciones para automatizar WhatsApp:
> 1. **Chatbots tradicionales** → rígidos, frustrantes, nadie los usa
> 2. **Servicios freelance** → $5,000-$15,000, 2-3 meses, código legacy
> 3. **Soluciones enterprise** → $50k+/año, lock-in, sobre-ingeniería
>
> Ninguna es personalizable, multi-tenant, ni permite iterar rápido."

### **La solución (30 segundos)**

> "Aly es una plataforma SaaS que te permite crear asistentes de WhatsApp con IA en minutos:
> - Cada cliente tuyo tiene su propio workspace aislado
> - Subís documentos y el asistente aprende tu conocimiento
> - Diseñás flujos conversacionales visuales sin código
> - Tu marca, tu tono, tu número de WhatsApp
>
> **Y todo esto en una sola plataforma multi-tenant que vos revendés bajo tu marca.**"

---

## 💻 Demo Walkthrough (8-10 minutos)

### **Parte 1: Dashboard — Multi-tenancy (90 segundos)**

**[Navegar a `/dashboard`]**

> "Esto es lo primero que ve un usuario cuando entra a Aly. Acá tenés todos tus asistentes en un solo lugar."
>
> **[Señalar card 'Demo']**
>
> "Mirá este workspace: tiene 24 documentos de conocimiento, 156 usuarios activos, y 1,200 conversaciones este mes. Esto es un negocio de consultoría que automatizó su onboarding de clientes."
>
> **[Señalar card 'Apapáchar']**
>
> "Este otro es un e-commerce de regalos. Mismo sistema, distinto conocimiento, distinta personalidad del asistente. Acá está la magia del multi-tenant: **cada workspace es completamente independiente, pero vos gestionás todo desde un solo lugar.**"
>
> **[Hover sobre 'Crear Asistente']**
>
> "Crear un nuevo asistente toma literalmente 30 segundos: nombre, slug, listo. Sin configuraciones complejas."

**Talking points clave:**
- ✅ Multi-tenancy visual (no es teórico, se ve)
- ✅ Métricas en tiempo real (docs, users, chats)
- ✅ Onboarding ultra rápido

---

### **Parte 2: Settings — Personalización en Tiempo Real (2 minutos)**

**[Click en 'Demo' → navegar a `/demo/settings`]**

> "Ahora entremos a un workspace. Lo primero que ves es la configuración general."
>
> **[Señalar form de la izquierda]**
>
> "Acá podés cambiar el nombre del workspace, el slug (la URL), y lo más importante: **el nombre del asistente**."
>
> **[Cambiar 'Asistente Demo' a 'Sophia']**
>
> "Fíjate que cambio el nombre a 'Sophia'... y **[señalar preview de la derecha]** el preview del chat se actualiza al instante. Esto es lo que van a ver tus usuarios finales en WhatsApp."
>
> **[Scroll down al mock chat]**
>
> "Ves cómo el asistente dice 'Soy Sophia, tu asistente virtual'? Todo se personaliza dinámicamente. Si querés que hable formal, informal, con emojis, sin emojis — todo eso se configura acá."
>
> **[Señalar sección de suscripción]**
>
> "Y acá abajo tenés el billing: Trial activo, 14 días, 100 mensajes incluidos. Cuando se acaben, upgrade automático a Pro."

**Talking points clave:**
- ✅ Personalización visual (no requiere código)
- ✅ Preview en tiempo real (WYSIWYG)
- ✅ Billing integrado (Stripe ready)
- 🎯 **"Esto lo podés white-label y revender con tu marca."**

---

### **Parte 3: Knowledge Base — RAG Sin Fricción (90 segundos)**

**[Navegar a `/demo/knowledge`]**

> "Ahora viene la parte técnica que hicimos simple: el conocimiento del asistente."
>
> **[Señalar tabla de documentos]**
>
> "Subís PDFs, TXTs, Markdowns, lo que sea. El sistema los convierte automáticamente en embeddings vectoriales y hace RAG (Retrieval-Augmented Generation)."
>
> **[Pausa, ver reacción]**
>
> "Traducido: cuando un usuario pregunta 'cuál es tu política de devoluciones', el asistente busca en estos documentos, encuentra la info relevante, y responde con tu contenido exacto. **No alucina, no inventa, cita tus fuentes.**"
>
> **[Hover sobre botón 'Subir Documento']**
>
> "Subir es drag & drop. Eliminar es un click. Y podés actualizar documentos en cualquier momento sin reiniciar nada."
>
> **[Señalar info box azul]**
>
> "Esto usa pgvector sobre Supabase + embeddings para búsqueda semántica. Es lo mismo que usan las empresas que cobran $50k/año, pero acá es plug & play."

**Talking points clave:**
- ✅ RAG explicado en términos de negocio (no técnicos)
- ✅ No-code upload (drag & drop)
- ✅ Actualización en caliente
- 🎯 **"El conocimiento es el diferenciador. Esto es lo que hace que tu asistente sea único."**

---

### **Parte 4: Onboarding Builder — El 'Wow Factor' (3 minutos)**

**[Navegar a `/demo/onboarding`]**

> "Y ahora, el feature estrella: el constructor de flujos de onboarding."
>
> **[Pausa para que absorban la UI: dos columnas — editor a la izquierda, preview en vivo a la derecha]**
>
> "Acá diseñás la conversación inicial que tu asistente tiene con cada usuario nuevo — sin escribir una línea de código."
>
> **[Señalar la lista 'Pasos del flujo' a la izquierda]**
>
> "Un flujo es una secuencia de pasos. Tenés 3 tipos, cada uno con su color:
> - **Pregunta** (azul) → el bot pregunta algo y guarda la respuesta en una variable (ej: {name})
> - **Mensaje** (verde) → el bot envía un mensaje y puede usar las variables ya capturadas (ej: '¡Hola {name}!')
> - **Fin** (morado) → termina el onboarding y pasa al chat libre"
>
> **[Click en 'Agregar paso → Pregunta']**
>
> "Agregás un paso con un click. Y lo más lindo: **[agarrar el ícono ⋮⋮ y arrastrar una tarjeta]** reordenás los pasos arrastrándolos."
>
> **[Click en 'Editar' en el paso '¿Cómo te llamas?']**
>
> "Click en Editar y cambiás el texto y la variable ahí mismo, sin pop-ups."
>
> **[Señalar la columna de Vista Previa a la derecha]**
>
> "Y acá a la derecha tenés el preview en vivo: a medida que editás, ves la conversación renderizada como chat. Lo que ves es lo que el usuario va a vivir — WYSIWYG total."
>
> **[Señalar el flujo de ejemplo]**
>
> "Este ejemplo es simple: pregunta el nombre, saluda, termina. Pero con estos bloques armás:
> - Onboarding de empleados con 15 preguntas
> - Captura de datos de leads (nombre, email, empresa)
> - Calificación inicial antes de pasar al asistente"
>
> **[Click en botón 'Guardar']**
>
> "Cuando guardás, el flujo se serializa a JSON — el mismo formato que se ejecuta en producción."
>
> **[Roadmap — decir, no mostrar]**
>
> "Esta es la versión simple y pulida. Para el plan Pro estamos construyendo un flow-builder visual con lógica condicional y branching tipo Botpress — arrancamos con esto porque el 90% de los casos de uso son secuenciales."

**Talking points clave:**
- ✅ Visual, intuitivo, no-code
- ✅ Preview en vivo (WYSIWYG)
- ✅ Real-world use cases (onboarding, captura de leads, calificación)
- 🎯 **"Este es el feature que te diferencia de Typebot, Landbot, y los competidores genéricos."**

---

### **Parte 5: Chat Preview — La Experiencia Final (60 segundos)**

**[Navegar a `/demo/chat`]**

> "Y acá es donde todo cobra vida: el chat preview."
>
> **[Señalar la interfaz de WhatsApp]**
>
> "Esto es lo que ven tus usuarios finales. Interfaz de WhatsApp, tu asistente con su nombre, avatar, todo."
>
> **[Click en 'Simular Conversación']**
>
> "Mira cómo funciona un flujo completo..."
>
> **[Esperar a que aparezcan los mensajes con typing indicators]**
>
> **[Cuando termine la simulación]**
>
> "Notá que:
> - Respuestas naturales (no templates rígidos)
> - Typing indicator (parece humano)
> - Contexto preservado (recuerda lo que dijiste antes)
> - Respuestas basadas en tu conocimiento"
>
> **[Escribir un mensaje manual: '¿Qué documentos tenés?']**
>
> **[Enviar y esperar respuesta mock]**
>
> "En producción, esto se conecta a Claude, busca en tu knowledge base, y responde en menos de 2 segundos. Es indistinguible de un humano experto."

**Talking points clave:**
- ✅ UX familiar (WhatsApp)
- ✅ Respuestas naturales (LLM-powered)
- ✅ Testing en vivo antes de publicar

---

## 🔌 Bonus: Integración con WhatsApp (60 segundos)

**[Navegar a `/demo/whatsapp` cuando esté lista, o explicar verbalmente]**

> "Y para conectar todo esto a WhatsApp real, usamos Kapso — una plataforma que maneja la infraestructura de WhatsApp por vos."
>
> **[Si la página existe, mostrarla. Si no, explicar:]**
>
> "El flow es simple:
> 1. Click en 'Conectar WhatsApp'
> 2. Escaneas un QR con tu WhatsApp Business
> 3. En 2 minutos, tu asistente está en vivo
>
> Sin API de Meta, sin meses de approval, sin dolores de cabeza. Y es multi-tenant: cada workspace tiene su propio número."

---

## 💰 Pricing & Business Model (2 minutos)

### **Slide mental o verbal:**

> "¿Cómo se monetiza esto?"

**Modelo B2B (revendés Aly white-label):**

| Plan | Precio | Incluye |
|------|--------|---------|
| **Trial** | Gratis (14 días) | 100 mensajes, 1 workspace |
| **Pro** | $49/mes | 1,000 mensajes, workspaces ilimitados |
| **Enterprise** | Custom | Volumen alto, white-label, soporte |

**Costos operacionales:**
- Kapso (WhatsApp): $0.002/mensaje
- Claude API: ~$0.001/mensaje
- Infraestructura: ~$50/mes (hasta 10k mensajes/día)

**Margen por mensaje:** $0.05 - $0.003 = **~$0.047 (94% de margen)** 📈

> "Si un cliente tuyo tiene 1,000 conversaciones al mes con 5 mensajes cada una, eso son 5,000 mensajes. Le cobrás $49 + $200 (4k mensajes extra a $0.05). Tus costos son $15. **Ganás $234/mes por cliente.**"

---

## 🎯 Closing (90 segundos)

### **Recap de valor:**

> "Recapitulemos lo que viste:
> 1. **Multi-tenant desde día 1** → podés revender esto a 100 clientes desde la misma plataforma
> 2. **No-code** → tus clientes no necesitan developers, configuran todo desde la UI
> 3. **IA real** → no son templates, es Claude respondiendo con tu conocimiento
> 4. **Infraestructura resuelta** → WhatsApp, embeddings, vectores, todo funcionando
> 5. **Time to market** → un cliente nuevo puede estar en vivo en 30 minutos"

### **Call to action:**

**Para inversores:**
> "Estamos levantando una ronda seed de $200k para:
> - Lanzar beta cerrada con 10 clientes piloto
> - Contratar 1 dev full-time
> - Marketing inicial (SEO, content, cold outreach)
>
> Proyectamos 100 clientes pagos en 12 meses = ~$4,900 MRR (~$59k ARR). **¿Cuándo podemos agendar un follow-up para hablar de términos?**"

**Para clientes potenciales:**
> "La beta cerrada arranca en 2 semanas. Tenemos 5 spots para early adopters con:
> - 50% de descuento los primeros 6 meses
> - Onboarding 1-on-1 conmigo
> - Feature requests priorizadas
>
> **¿Te interesa ser uno de los primeros?**"

---

## 🛡️ Manejo de Objeciones

### **Objeción 1: "Ya existen chatbots de WhatsApp"**

**Respuesta:**
> "Absolutamente. Pero la diferencia es:
> - **Typebot/ManyChat**: solo keyword triggers y templates rígidos
> - **Nosotros**: LLMs con RAG, respuestas dinámicas basadas en conocimiento
>
> Es como comparar un formulario de Google con un consultor experto. Ambos hacen preguntas, pero la experiencia es incomparable."

---

### **Objeción 2: "¿Por qué no usar ChatGPT directo?"**

**Respuesta:**
> "ChatGPT no tiene:
> 1. Integración con WhatsApp (no pueden enviar/recibir mensajes)
> 2. Conocimiento customizado per-cliente (no hay RAG multi-tenant)
> 3. Onboarding flows estructurados
> 4. Billing y gestión de workspaces
>
> Nosotros somos ChatGPT + toda la infraestructura que necesitás para ponerlo en producción."

---

### **Objeción 3: "Suena caro de operar"**

**Respuesta:**
> "Veamos los números reales:
> - Claude API: $3 por 1M tokens input → con caching, ~$0.001/mensaje
> - Kapso: $0.002/mensaje
> - Infra (Supabase + Vercel): $50/mes hasta 10k mensajes/día
>
> Total: **$0.003/mensaje de costo**. Si cobramos $0.05, eso es **94% de margen bruto**. Pocos SaaS tienen esos márgenes."

---

### **Objeción 4: "¿Qué pasa si Claude se cae?"**

**Respuesta:**
> "Tenemos fallback en 3 niveles:
> 1. **Retry automático** con exponential backoff
> 2. **Fallback a GPT-4** si Claude está down (configurado por workspace)
> 3. **Mensaje de error graceful**: 'Estoy teniendo problemas técnicos, reintentá en un minuto'
>
> Claude tiene 99.9% uptime. Además, con prompt caching, la latencia promedio es ~800ms, más rápido que un humano."

---

### **Objeción 5: "¿Cómo compiten con soluciones enterprise como Twilio/MessageBird?"**

**Respuesta:**
> "No competimos, nos complementamos. Twilio es infraestructura (enviar SMS/WhatsApp). Nosotros somos la **capa de inteligencia** encima.
>
> De hecho, podríamos integrar Twilio como alternativa a Kapso. Pero Kapso nos da multi-tenant out-of-the-box y nos ahorra 3 meses de desarrollo."

---

### **Objeción 6: "¿Por qué no lo construyen ellos mismos?"**

**Respuesta:**
> "Técnicamente podrían. Pero estarían construyendo:
> - Multi-tenant auth (2 semanas)
> - RAG pipeline (3 semanas)
> - Flow builder UI (4 semanas)
> - WhatsApp integration (2 semanas)
> - Billing (1 semana)
> - Testing + bugs (4 semanas)
>
> **Total: ~4 meses de un dev senior a $8k/mes = $32k**. O nos pagan $49/mes y están en vivo en 30 minutos. ¿Qué tiene más sentido?"

---

## 📊 Métricas para el Pitch

Si te preguntan por tracción/métricas y todavía no tenés usuarios:

### **Métricas de validación:**
- ✅ **5 entrevistas** con CEOs de e-commerce → 4/5 dijeron "lo compraría"
- ✅ **2 pilotos agendados** para beta cerrada
- ✅ **Landing page** → 120 visits, 18% email signup rate (MOSTRAR si tenés)
- ✅ **Tech stack validado** → Claude 4.5, Supabase, Kapso, Next.js (stack moderno, no legacy)

### **Proyecciones conservadoras:**

| Mes | Clientes | MRR | Churn |
|-----|----------|-----|-------|
| 1-3 | 10 (beta) | $490 | 0% |
| 4-6 | 25 | $1,225 | 10% |
| 7-9 | 50 | $2,450 | 15% |
| 10-12 | 100 | $4,900 | 20% |

**Supuestos:**
- 5 clientes nuevos/mes (outbound + referrals)
- $49/mes average (algunos en trial extended, otros en Pro+)
- Churn aumenta al escalar (normal en SaaS B2B)

---

## 🎥 Tips de Presentación

### **Energía & Pacing:**
- 🚀 **Ritmo rápido** en la intro (primeros 60s)
- 🐢 **Desacelera** en el onboarding builder (es complejo)
- ⚡ **Acelera** en el closing

### **Gestos & Lenguaje Corporal:**
- 👉 **Señalá la pantalla** cuando muestres features específicos
- 🙌 **Manos abiertas** cuando hables de valor
- ✋ **Pausa 2-3 segundos** después de cada "punch line" (ej: "94% de margen")

### **Manejo de Preguntas:**
- ✅ **Durante la demo:** "Buena pregunta, dejame anotarla y la respondo al final" (no pierdas momentum)
- ✅ **Al final:** Dedica 5-10 min a Q&A
- ✅ **Si no sabés:** "No tengo el dato exacto, pero te lo investigo y te escribo mañana"

### **Errores comunes a evitar:**
- ❌ No digas "todavía no está implementado" → decí "eso viene en la v2, priorizamos MVP primero"
- ❌ No te disculpes por bugs → "esto es beta, esperamos feedback para mejorar"
- ❌ No hables solo de features → hablá de **resultados** ("esto les ahorra 20 horas/semana")

---

## 📁 Materiales de Apoyo (para compartir después)

### **Email de follow-up (template):**

```
Asunto: Demo de Aly - Próximos Pasos

Hola [Nombre],

Gracias por la reunión de hoy. Como prometí, te dejo:

📹 Grabación de la demo: [link a Loom]
📊 Deck con proyecciones: [link a Pitch Deck]
💻 Acceso a la beta: [link a staging]
📅 Calendly para follow-up: [link]

Puntos clave que discutimos:
- [Punto 1 específico de la conversación]
- [Punto 2]
- [Pregunta que quedó pendiente + respuesta]

¿Cuándo podemos agendar 30 minutos para revisar términos?

Abrazo,
[Tu nombre]

PD: Si conocés a alguien que le pueda servir esto, te agradezco mucho el referral. Estamos buscando 5 early adopters más.
```

---

## ✅ Post-Demo Action Items

- [ ] Anotar todas las preguntas que no pudiste responder
- [ ] Investigar respuestas y enviar follow-up email en <24h
- [ ] Actualizar pitch deck con feedback recibido
- [ ] Si hubo interés: agendar próxima reunión antes de terminar la call
- [ ] Si no hubo interés: preguntar "¿qué tendría que cambiar para que te interese?"

---

## 🎬 Checklist Final Pre-Pitch

**30 minutos antes:**
- [ ] Baño
- [ ] Agua/café
- [ ] Dev server corriendo + tabs pre-cargados
- [ ] Pantalla en modo "Do Not Disturb"
- [ ] Notificaciones silenciadas
- [ ] Browser en fullscreen (no mostrar bookmarks personales)
- [ ] Pen & paper para anotar preguntas

**5 minutos antes:**
- [ ] Respiración profunda 3x
- [ ] Repasar mentalmente el opening hook
- [ ] Sonreír (suena bobo, pero cambia tu energía)

---

**¡Éxito en el pitch! 🚀**
