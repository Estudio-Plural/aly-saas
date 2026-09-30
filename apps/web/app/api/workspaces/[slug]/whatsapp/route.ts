import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import {
  PhoneNumberIdEnUso,
  getWebhookVerificadoAt,
  getWhatsappConnection,
  saveWhatsappConnection,
} from "@/lib/data/whatsapp";
import { getEngineWhatsappEstado } from "@/lib/engine";
import { esPlural } from "@/lib/roles";
import { calcularChecklist } from "@/lib/whatsapp-checklist";

type Params = { params: Promise<{ slug: string }> };

// La conexión la carga Plural (acompañado). El cliente solo lee el estado.
// TODO(auth): cuando exista la sesión del carril Acceso, pasarle el usuario a
// esPlural() en vez de null.
const usuarioActual = () => null;

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

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });

  const [conexion, entorno, verificadoAt] = await Promise.all([
    getWhatsappConnection(workspace.id),
    getEngineWhatsappEstado(workspace.id),
    getWebhookVerificadoAt(),
  ]);
  const { estado, pasos, hechos } = calcularChecklist(conexion, entorno, verificadoAt);
  if (!esPlural(usuarioActual())) {
    return NextResponse.json({ estado, hechos, total: pasos.length });
  }
  return NextResponse.json({ estado, pasos, conexion });
}

export async function PUT(request: Request, { params }: Params) {
  if (!esPlural(usuarioActual())) {
    return NextResponse.json({ error: "Solo el equipo de Plural puede conectar números" }, { status: 403 });
  }
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });

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
