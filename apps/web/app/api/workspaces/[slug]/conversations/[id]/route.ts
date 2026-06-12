import { NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getConversationMessages } from "@/lib/data/chat";

type Params = { params: Promise<{ slug: string; id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug, id } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const messages = await getConversationMessages(workspace.id, decodeURIComponent(id));
  return NextResponse.json({ messages });
}
