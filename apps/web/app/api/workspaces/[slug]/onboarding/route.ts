import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverWorkspace } from "@/lib/api-acceso";
import { getActiveFlowSteps, saveActiveFlowSteps } from "@/lib/data/onboarding";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  const steps = await getActiveFlowSteps(workspace.id);
  return NextResponse.json({ steps });
}

const stepsSchema = z.object({
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(["question", "message", "end"]),
        content: z.string().max(2000),
        variable: z.string().max(100).optional(),
      })
    )
    .max(50),
});

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

  const body = await request.json().catch(() => null);
  const parsed = stepsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Flujo inválido" }, { status: 400 });
  }

  await saveActiveFlowSteps(workspace.id, parsed.data.steps);
  return NextResponse.json({ ok: true });
}
