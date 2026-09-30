import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverWorkspace } from "@/lib/api-acceso";
import { getFlagRules, saveFlagRules } from "@/lib/data/flags";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  return NextResponse.json({ rules: await getFlagRules(workspace.id) });
}

const putSchema = z.object({
  rules: z
    .array(
      z.object({
        id: z.string().min(1).max(50),
        description: z.string().trim().min(3).max(300),
        severity: z.enum(["high", "medium", "low"]),
      })
    )
    .max(10),
});

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Reglas inválidas" }, { status: 400 });
  }

  await saveFlagRules(workspace.id, parsed.data.rules);
  return NextResponse.json({ rules: parsed.data.rules });
}
