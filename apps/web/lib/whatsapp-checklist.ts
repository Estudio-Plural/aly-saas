// Checklist de conexión de WhatsApp — puro (sin DB), lo usan la página y la API.
//
// Honestidad ante todo: cada paso dice CÓMO se sabe que está hecho.
//  - "manual": lo marca Plural a mano; desde acá no se puede verificar (el
//    panel de Meta no tiene API para "¿la app está publicada?" sin su token).
//  - "automático": lo mide el sistema (entorno del engine o la base).
// El estado "Activo" existe SOLO si hubo un mensaje real recibido Y respondido.

export type PasoManualId = "app_publicada" | "waba_suscrita" | "numero_registrado";
export type PasoId = PasoManualId | "token_cargado" | "webhook_verificado" | "prueba_de_vida";

export type ChecklistGuardado = Partial<Record<PasoManualId, { hecho: boolean; at: string | null; por: string | null }>>;

export type ConexionWhatsapp = {
  phoneNumberId: string | null;
  displayNumber: string | null;
  wabaId: string | null;
  tokenEnv: string | null;
  checklist: ChecklistGuardado;
  enabled: boolean;
  lastInboundAt: string | null;
  lastReplyAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

/** Lo que el engine reporta de su propio entorno (null = no respondió). */
export type EntornoEngine = {
  tokenEnv: string | null;
  tokenCargado: boolean;
  firmaConfigurada: boolean;
  verifyTokenConfigurado: boolean;
} | null;

export type PasoChecklist = {
  id: PasoId;
  titulo: string;
  detalle: string;
  modo: "manual" | "automatico";
  hecho: boolean;
  /** Evidencia legible: "Marcado el …", "Último mensaje …", o por qué falta. */
  evidencia: string;
};

export type EstadoConexion = "sin_configurar" | "en_configuracion" | "esperando_mensaje" | "activo" | "pausado";

export const PASOS_MANUALES: { id: PasoManualId; titulo: string; detalle: string }[] = [
  {
    id: "app_publicada",
    titulo: "App de Meta publicada",
    detalle: "En modo desarrollo Meta solo entrega webhooks de prueba: no llega ningún mensaje real y no hay error visible.",
  },
  {
    id: "waba_suscrita",
    titulo: "App suscrita a la WABA con el campo «messages»",
    detalle: "POST /{waba_id}/subscribed_apps con el token, y el campo «messages» activo en la configuración del webhook.",
  },
  {
    id: "numero_registrado",
    titulo: "Número registrado con PIN",
    detalle: "POST /{phone_number_id}/register con messaging_product y el PIN de dos pasos.",
  },
];

export function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

export function calcularChecklist(
  c: ConexionWhatsapp | null,
  entorno: EntornoEngine,
  webhookVerificadoAt: string | null,
): { pasos: PasoChecklist[]; estado: EstadoConexion; hechos: number } {
  const manuales: PasoChecklist[] = PASOS_MANUALES.map((p) => {
    const g = c?.checklist?.[p.id];
    const hecho = !!g?.hecho;
    return {
      ...p,
      modo: "manual",
      hecho,
      evidencia: hecho ? `Marcado por Plural${g?.at ? ` el ${fechaCorta(g.at)}` : ""}` : "Pendiente (lo marca Plural)",
    };
  });

  let tokenEvidencia = "Falta el nombre de la variable del token";
  let tokenHecho = false;
  if (c?.tokenEnv) {
    if (!entorno) tokenEvidencia = `No pudimos consultar el engine para confirmar ${c.tokenEnv}`;
    else if (entorno.tokenCargado) {
      tokenHecho = true;
      tokenEvidencia = `${c.tokenEnv} está en el entorno del engine`;
    } else tokenEvidencia = `${c.tokenEnv} no está en el entorno del engine`;
  }

  const firmaOk = entorno?.firmaConfigurada ?? false;
  const webhookHecho = !!webhookVerificadoAt && firmaOk;
  const webhookEvidencia = !webhookVerificadoAt
    ? "Meta todavía no verificó la URL del webhook"
    : !entorno
      ? `Verificado el ${fechaCorta(webhookVerificadoAt)} (no pudimos confirmar el app secret)`
      : firmaOk
        ? `Verificado el ${fechaCorta(webhookVerificadoAt)}`
        : "Verificado, pero falta META_APP_SECRET en el engine: los mensajes se rechazan";

  const vida = !!c?.lastReplyAt;
  const vidaEvidencia = vida
    ? `Último mensaje recibido ${fechaCorta(c!.lastInboundAt)} · respondido ${fechaCorta(c!.lastReplyAt)}`
    : c?.lastInboundAt
      ? `Llegó un mensaje el ${fechaCorta(c.lastInboundAt)} pero no se pudo responder`
      : "Escribe al número desde un WhatsApp de prueba";

  const pasos: PasoChecklist[] = [
    ...manuales,
    {
      id: "token_cargado",
      titulo: "Token cargado en el engine",
      detalle: "El token de Graph vive en el entorno del engine (variable META_TOKEN_*). Acá solo se guarda su nombre.",
      modo: "automatico",
      hecho: tokenHecho,
      evidencia: tokenEvidencia,
    },
    {
      id: "webhook_verificado",
      titulo: "Webhook verificado",
      detalle: "Meta llamó a la URL con el verify token y el engine respondió el challenge.",
      modo: "automatico",
      hecho: webhookHecho,
      evidencia: webhookEvidencia,
    },
    {
      id: "prueba_de_vida",
      titulo: "Prueba de vida: un mensaje real recibido y respondido",
      detalle: "Lo único que prueba que todo lo anterior funciona junto.",
      modo: "automatico",
      hecho: vida,
      evidencia: vidaEvidencia,
    },
  ];

  const hechos = pasos.filter((p) => p.hecho).length;
  let estado: EstadoConexion;
  if (!c || (!c.phoneNumberId && hechos === 0)) estado = "sin_configurar";
  else if (!c.enabled) estado = "pausado";
  else if (vida) estado = "activo";
  else if (pasos.slice(0, 5).every((p) => p.hecho)) estado = "esperando_mensaje";
  else estado = "en_configuracion";

  return { pasos, estado, hechos };
}

export const ETIQUETA_ESTADO: Record<EstadoConexion, string> = {
  sin_configurar: "Sin conectar",
  en_configuracion: "En configuración",
  esperando_mensaje: "Esperando el primer mensaje",
  activo: "Activo",
  pausado: "Pausado",
};
