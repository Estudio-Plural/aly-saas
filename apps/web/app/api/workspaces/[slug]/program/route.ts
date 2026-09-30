import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import {
  getCorePrompt,
  getStoryboard,
  saveCorePrompt,
  saveStoryboard,
} from "@/lib/data/program";
import { getDesign } from "@/lib/data/design";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  const [corePrompt, storyboard] = await Promise.all([
    getCorePrompt(workspace.id),
    getStoryboard(workspace.id),
  ]);
  return NextResponse.json({ core_prompt: corePrompt, storyboard });
}

// Campos vacíos permitidos: el asistente usa el ejemplo y el panel lo marca pendiente.
const text = z.string().trim().max(2000);

const corePromptSchema = z.object({
  mission: text,
  audience: text.optional(),
  success_criteria: text,
  voice_tone: text.optional(),
  voice_use: text.optional(),
  voice_avoid: text.optional(),
  scope: text.optional(),
  key_actions: text.optional(),
});

const storyboardSchema = z.object({
  opening: text,
  development: text,
  next_steps: text,
  closing: text,
});

const putSchema = z
  .object({
    core_prompt: corePromptSchema.optional(),
    storyboard: storyboardSchema.optional(),
  })
  .refine((data) => data.core_prompt || data.storyboard, {
    message: "Nada para guardar",
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
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.core_prompt) {
    // Merge: no se pierden campos que esta pantalla no envía.
    const { core_prompt: current } = await getDesign(workspace.id);
    await saveCorePrompt(workspace.id, { ...current, ...parsed.data.core_prompt });
  }
  if (parsed.data.storyboard) {
    await saveStoryboard(workspace.id, parsed.data.storyboard);
  }
  return NextResponse.json(parsed.data);
}
