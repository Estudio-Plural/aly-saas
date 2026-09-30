import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getAlertProtocol, saveAlertProtocol } from "@/lib/data/operar";
import { DEMO_USER_ID } from "@/lib/constants";
import { channelTargetError, EMPTY_PROTOCOL } from "@/lib/operar";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ protocol: (await getAlertProtocol(workspace.id)) ?? EMPTY_PROTOCOL });
}

const putSchema = z.object({
  responsibleName: z.string().trim().max(120),
  channel: z.enum(["email", "telegram", "whatsapp"]).nullable(),
  channelTarget: z.string().trim().max(200),
  responseTimeHours: z.number().int().min(1).max(720).nullable(),
  active: z.boolean(),
});

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Protocolo inválido" }, { status: 400 });
  }
  const p = parsed.data;
  if (p.active) {
    if (!p.responsibleName) {
      return NextResponse.json({ error: "Para activarlo, di quién responde" }, { status: 400 });
    }
    if (!p.channel) {
      return NextResponse.json({ error: "Para activarlo, elige por dónde avisar" }, { status: 400 });
    }
    if (!p.responseTimeHours) {
      return NextResponse.json({ error: "Para activarlo, define en cuánto tiempo responden" }, { status: 400 });
    }
  }
  if (p.channel && p.channelTarget) {
    const error = channelTargetError(p.channel, p.channelTarget);
    if (error) return NextResponse.json({ error }, { status: 400 });
  } else if (p.active) {
    return NextResponse.json({ error: "Para activarlo, falta el destino del aviso" }, { status: 400 });
  }

  // TODO(auth): usuario real cuando haya sesión (hoy es el usuario demo fijo)
  const protocol = await saveAlertProtocol(workspace.id, p, DEMO_USER_ID);
  return NextResponse.json({ protocol });
}
