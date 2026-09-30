# Conectar un número de WhatsApp a un programa (runbook del equipo Plural)

Canal directo con **Meta Cloud API** (sin Kapso, sin Evolution, sin Typebot),
igual que Aly y Tranqui. Al principio **Plural conecta el número por la
organización**; la organización ve en «WhatsApp» solo el estado y las cifras.

## Qué hay que tener antes

- Acceso al portafolio de Meta Business donde vive (o vivirá) la WABA del número.
- Una **App de Meta** con el producto WhatsApp. Puede ser una sola app de Plural
  para varios programas: el engine reparte por `phone_number_id`.
- Acceso al entorno del engine (`apps/api/.env` / systemd `aly-engine`). Los
  deploys los corre Daniel.

## Paso a paso

1. **App publicada** (App Dashboard → modo *Live*). En modo desarrollo Meta solo
   entrega webhooks de prueba del panel: la suscripción queda puesta y no llega
   ni un mensaje real, sin error visible. → marcar en el panel.
2. **Webhook**: en la app, WhatsApp → Configuration →
   Callback URL `https://<dominio-del-engine>/api/webhook/meta`,
   Verify token = `META_VERIFY_TOKEN` del engine, y activar el campo
   **`messages`**. Al guardar, Meta hace el GET: si el engine contesta el
   challenge, el panel lo muestra como «Webhook verificado» (automático).
   El engine necesita además el **app secret** de esa app en `META_APP_SECRET`
   (o `META_APP_SECRET_<APP>` si hay varias apps): sin él rechaza todo POST (401).
3. **App suscrita a la WABA**:
   `POST https://graph.facebook.com/v23.0/{waba_id}/subscribed_apps` con el token.
   ⚠️ Si la WABA es compartida con otro bot (p. ej. EQMDO: apapáchar + Tranqui),
   **no desuscribir la otra app**: mataría al otro bot. El engine ignora los
   números que no tienen conexión. → marcar en el panel.
4. **Número registrado con PIN**:
   `POST /{phone_number_id}/register` con `{"messaging_product":"whatsapp","pin":"123456"}`.
   El PIN de dos pasos se puede sobrescribir con `POST /{phone_number_id}` y
   `{"pin":"..."}`. Si se cambió el nombre visible, hay que **re-registrar**
   para que se aplique. → marcar en el panel.
5. **Token**: token de System User con `whatsapp_business_messaging` sobre esa
   WABA. Se carga en el entorno del engine como `META_TOKEN_<PROGRAMA>` y se
   reinicia el engine (`systemctl restart aly-engine`: Bun no recarga el entorno).
   En el panel va **solo el nombre** de la variable. El panel confirma con el
   engine que la variable existe (automático).
6. **Datos en el panel** (`/<programa>/whatsapp`, vista Plural):
   `phone_number_id`, número visible, ID de la WABA, nombre de la variable del
   token. Guardar.
7. **Prueba de vida**: escribir al número desde un WhatsApp de prueba. Debe
   llegar la bienvenida + aviso de privacidad + «¿Aceptas continuar?». Recién
   con un mensaje real **recibido y respondido** el estado pasa a **Activo**.
8. Revisar la vista de la organización («Ver como la organización») y avisarle.

## Qué hace el engine con cada mensaje

- Firma `X-Hub-Signature-256` sobre los bytes crudos, contra todos los app secrets.
- `phone_number_id` → workspace (`whatsapp_connections`). Número sin conexión o
  pausado → se ignora.
- Audio, imagen, documento → «Por ahora solo puedo leer mensajes de texto».
- Onboarding: bienvenida → aviso → acepta (`1`, `sí`, `acepto`, `sí, acepto`,
  `estoy de acuerdo`) / rechaza (`2` o empieza con «no») / otra cosa repite la
  pregunta. Al rechazar **no se guarda nada**. Después, preguntas de perfil
  opcionales (`saltar` las omite) y la conversación normal por el pipeline.
- Sesión nueva tras 70 min de silencio; `salir` la cierra. El consentimiento no
  se vuelve a pedir.
- Reintentos de Meta: el wamid ya atendido no se contesta dos veces; si falló el
  envío, se reenvía la MISMA respuesta (no se regenera).

## Si algo no anda

| Síntoma | Causa probable |
|---|---|
| No llega nada, ni el GET | URL mal puesta o el engine no es alcanzable desde internet |
| Verificado pero nunca llega un POST | App en modo desarrollo, o app no suscrita a la WABA, o campo `messages` apagado |
| Llegan POST con 401 en el log | Falta el app secret de ESA app en el engine |
| «Llegó un mensaje pero no se pudo responder» | Token faltante o vencido (ver «Último error» en el panel) |
| Responde con la voz de otro programa | Dos conexiones con el mismo número (la base lo impide: `phone_number_id` es único) |

## Textos del onboarding por programa (contrato con la migración 012)

El engine lee `workspace_configs.whatsapp_onboarding` (JSONB) con las claves
`bienvenida`, `aviso_privacidad`, `politica_url`, `pregunta_consentimiento`,
`despedida_rechazo`, `cierre_onboarding` y `preguntas_perfil`
(`[{id, pregunta, opciones?}]`). Si la columna o un campo no existe, usa
defaults. ⚠️ El aviso por defecto es genérico y provisional: **antes de abrir
un número a participantes reales, el programa tiene que cargar su aviso y el
link a su política.**
