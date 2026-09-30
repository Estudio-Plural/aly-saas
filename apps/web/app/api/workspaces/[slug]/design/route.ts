// «Diseñar» (migración 012): qué no hace, rutas de ayuda, bienvenida.
// PUT con UNA de las tres secciones por llamada.
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverWorkspace } from "@/lib/api-acceso";
import {
  getDesign,
  saveBoundaries,
  saveHelpRoutes,
  saveWelcome,
} from "@/lib/data/design";

type Params = { params: Promise<{ slug: string }> };

const id = z.string().trim().min(1).max(64);
const short = z.string().trim().max(300);

const boundariesSchema = z.object({
  rules: z
    .array(z.object({ id, text: z.string().trim().min(1).max(500) }))
    .max(30),
});

const helpRouteSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  contact: z.string().trim().min(1).max(200),
  hours: short.default(""),
  when: z.string().trim().max(500).default(""),
  territory: short.default(""),
});

const welcomeSchema = z.object({
  welcome_message: z.string().trim().max(2000),
  // El aviso se guarda EXACTO: sin trim ni reescritura.
  privacy_notice: z.string().max(5000),
  privacy_policy_url: z
    .string()
    .trim()
    .max(500)
    .refine((url) => url === "" || /^https?:\/\/\S+$/.test(url), {
      message: "El link de la política debe empezar con http:// o https://",
    }),
  profile_questions: z
    .array(
      z.object({
        id,
        question: z.string().trim().min(1).max(300),
        variable: z.string().trim().regex(/^[a-z0-9_]{1,30}$/),
        options: z.array(z.string().trim().min(1).max(100)).max(12),
      })
    )
    .max(8),
});

const putSchema = z.union([
  z.object({ boundaries: boundariesSchema }).strict(),
  z.object({ help_routes: z.array(helpRouteSchema).max(40) }).strict(),
  z.object({ welcome: welcomeSchema }).strict(),
]);

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  return NextResponse.json(await getDesign(workspace.id));
}

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.find((issue) => issue.message.startsWith("El "))?.message;
    return NextResponse.json({ error: message ?? "Revisa los datos" }, { status: 400 });
  }
  const data = parsed.data;
  if ("boundaries" in data) await saveBoundaries(workspace.id, data.boundaries);
  if ("help_routes" in data) await saveHelpRoutes(workspace.id, data.help_routes);
  if ("welcome" in data) await saveWelcome(workspace.id, data.welcome);
  return NextResponse.json({ ok: true });
}
