import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getFlagRules, saveFlagRules } from "@/lib/data/flags";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
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
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Reglas inválidas" }, { status: 400 });
  }

  await saveFlagRules(workspace.id, parsed.data.rules);
  return NextResponse.json({ rules: parsed.data.rules });
}
