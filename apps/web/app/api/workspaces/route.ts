import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listWorkspaces,
  createWorkspace,
  SlugTakenError,
} from "@/lib/data/workspaces";
import { slugify } from "@/lib/workspaces";

export async function GET() {
  const workspaces = await listWorkspaces();
  return NextResponse.json({ workspaces });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(100).optional(),
  assistant_name: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { name } = parsed.data;
  const slug = slugify(parsed.data.slug || name);
  const assistant_name = parsed.data.assistant_name || "Aly";

  try {
    const workspace = await createWorkspace({ name, slug, assistant_name });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
