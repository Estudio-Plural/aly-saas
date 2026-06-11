import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getWorkspaceBySlug,
  updateWorkspace,
  deleteWorkspace,
  SlugTakenError,
} from "@/lib/data/workspaces";
import { removeWorkspaceUploads } from "@/lib/uploads";
import { slugify } from "@/lib/workspaces";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ workspace });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  assistant_name: z.string().trim().min(1).max(100),
});

export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const workspace = await updateWorkspace(slug, {
      ...parsed.data,
      slug: slugify(parsed.data.slug),
    });
    if (!workspace) {
      return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspaceId = await deleteWorkspace(slug);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  await removeWorkspaceUploads(workspaceId);
  return NextResponse.json({ ok: true });
}
