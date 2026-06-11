import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import {
  getOpenConversationId,
  getConversationMessages,
  newConversationId,
  appendMessages,
  closeOpenConversation,
} from "@/lib/data/chat";
import {
  buildSystemPrompt,
  chatCompletion,
  getChatModel,
  isLlmConfigured,
  type LlmMessage,
} from "@/lib/llm";

type Params = { params: Promise<{ slug: string }> };

const HISTORY_LIMIT = 20;

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const conversationId = await getOpenConversationId(workspace.id);
  const messages = conversationId
    ? await getConversationMessages(workspace.id, conversationId)
    : [];
  return NextResponse.json({
    conversationId,
    messages,
    llmConfigured: isLlmConfigured(),
  });
}

const postSchema = z.discriminatedUnion("type", [
  // Turno normal: mensaje del usuario → respuesta del LLM
  z.object({ type: z.literal("message"), message: z.string().trim().min(1).max(4000) }),
  // Persistir mensajes del flujo de onboarding (los genera el cliente)
  z.object({
    type: z.literal("append"),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          text: z.string().min(1).max(4000),
        })
      )
      .min(1)
      .max(20),
  }),
]);

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
  }

  const conversationId =
    (await getOpenConversationId(workspace.id)) ?? newConversationId();

  if (parsed.data.type === "append") {
    const inserted = await appendMessages(workspace.id, conversationId, parsed.data.messages);
    return NextResponse.json({ conversationId, messages: inserted });
  }

  const [userMessage] = await appendMessages(workspace.id, conversationId, [
    { role: "user", text: parsed.data.message },
  ]);

  if (!isLlmConfigured()) {
    const [reply] = await appendMessages(workspace.id, conversationId, [
      {
        role: "assistant",
        text: "(Falta configurar OPENROUTER_API_KEY en apps/web/.env.local para respuestas reales del asistente.)",
      },
    ]);
    return NextResponse.json({ conversationId, messages: [userMessage, reply] });
  }

  try {
    const history = await getConversationMessages(workspace.id, conversationId);
    const llmMessages: LlmMessage[] = [
      { role: "system", content: await buildSystemPrompt(workspace) },
      ...history.slice(-HISTORY_LIMIT).map(
        (msg): LlmMessage => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        })
      ),
    ];

    const model = await getChatModel(workspace.id);
    const replyText = await chatCompletion(llmMessages, model);

    const [reply] = await appendMessages(workspace.id, conversationId, [
      { role: "assistant", text: replyText },
    ]);
    return NextResponse.json({ conversationId, messages: [userMessage, reply] });
  } catch (error) {
    console.error("[chat] Error llamando al LLM:", error);
    return NextResponse.json(
      {
        error: "No se pudo obtener respuesta del asistente. Revisá la clave de OpenRouter y la conexión.",
        conversationId,
        messages: [userMessage],
      },
      { status: 502 }
    );
  }
}

/** Reinicia la conversación del preview (cierra la actual). */
export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  await closeOpenConversation(workspace.id);
  return NextResponse.json({ ok: true });
}
