import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverWorkspace, sinPermiso } from "@/lib/api-acceso";
import {
  PhoneNumberIdEnUso,
  getWebhookVerificadoAt,
  getWhatsappConnection,
  saveWhatsappConnection,
} from "@/lib/data/whatsapp";
import { getEngineWhatsappEstado } from "@/lib/engine";
import { calcularChecklist } from "@/lib/whatsapp-checklist";

type Params = { params: Promise<{ slug: string }> };

// La conexión la carga Plural (acompañado). El cliente solo lee el estado.

const vacioANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const conexionSchema = z.object({
  phoneNumberId: z.preprocess(vacioANull, z.string().trim().regex(/^\d{5,30}$/, "phone_number_id son solo dígitos").nullable()),
  displayNumber: z.preprocess(vacioANull, z.string().trim().max(40).nullable()),
  wabaId: z.preprocess(vacioANull, z.string().trim().regex(/^\d{5,30}$/, "El ID de la WABA son solo dígitos").nullable()),
  tokenEnv: z.preprocess(
    vacioANull,
    z
      .string()
      .trim()
      .regex(/^META_TOKEN_[A-Z0-9_]{1,64}$/, "El nombre de la variable debe empezar con META_TOKEN_ (mayúsculas, números y _)")
      .nullable(),
  ),
  enabled: z.boolean().default(true),
  pasos: z
    .object({
      app_publicada: z.boolean().optional(),
      waba_suscrita: z.boolean().optional(),
      numero_registrado: z.boolean().optional(),
    })
    .default({}),
});

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { acceso, workspace } = r;

  const [conexion, entorno, verificadoAt] = await Promise.all([
    getWhatsappConnection(workspace.id),
    getEngineWhatsappEstado(workspace.id),
    getWebhookVerificadoAt(),
  ]);
  const { estado, pasos, hechos } = calcularChecklist(conexion, entorno, verificadoAt);
  if (!acceso.esPlural) {
    return NextResponse.json({ estado, hechos, total: pasos.length });
  }
  return NextResponse.json({ estado, pasos, conexion });
}

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params;
  // Primero el acceso (401/404 sin revelar nada); después el rol.
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { acceso, workspace } = r;
  if (!acceso.esPlural) return sinPermiso("Solo el equipo de Plural puede conectar números");

  const parsed = conexionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const d = parsed.data;
  if (d.pasos.numero_registrado && !d.phoneNumberId) {
    return NextResponse.json({ error: "Para marcar el número como registrado, carga primero su phone_number_id" }, { status: 400 });
  }

  try {
    const conexion = await saveWhatsappConnection(workspace.id, { ...d, por: "plural" });
    const [entorno, verificadoAt] = await Promise.all([getEngineWhatsappEstado(workspace.id), getWebhookVerificadoAt()]);
    const { estado, pasos } = calcularChecklist(conexion, entorno, verificadoAt);
    return NextResponse.json({ estado, pasos, conexion });
  } catch (e) {
    if (e instanceof PhoneNumberIdEnUso) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
