import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import {
  getCorePrompt,
  getStoryboard,
  saveCorePrompt,
  saveStoryboard,
} from "@/lib/data/program";

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
    await saveCorePrompt(workspace.id, parsed.data.core_prompt);
  }
  if (parsed.data.storyboard) {
    await saveStoryboard(workspace.id, parsed.data.storyboard);
  }
  return NextResponse.json(parsed.data);
}
