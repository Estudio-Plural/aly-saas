import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverWorkspace } from "@/lib/api-acceso";
import {
  getCorePrompt,
  getStoryboard,
  saveCorePrompt,
  saveStoryboard,
} from "@/lib/data/program";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  const [corePrompt, storyboard] = await Promise.all([
    getCorePrompt(workspace.id),
    getStoryboard(workspace.id),
  ]);
  return NextResponse.json({ core_prompt: corePrompt, storyboard });
}

const corePromptSchema = z.object({
  mission: z.string().trim().min(3).max(2000),
  scope: z.string().trim().min(3).max(2000),
  success_criteria: z.string().trim().min(3).max(2000),
  key_actions: z.string().trim().min(3).max(2000),
});

const storyboardSchema = z.object({
  opening: z.string().trim().min(3).max(2000),
  development: z.string().trim().min(3).max(2000),
  next_steps: z.string().trim().min(3).max(2000),
  closing: z.string().trim().min(3).max(2000),
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
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.core_prompt) {
    await saveCorePrompt(workspace.id, parsed.data.core_prompt);
  }
  if (parsed.data.storyboard) {
    await saveStoryboard(workspace.id, parsed.data.storyboard);
  }
  return NextResponse.json(parsed.data);
}
