import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverWorkspace } from "@/lib/api-acceso";
import {
  getOpenConversationId,
  getConversationMessages,
  newConversationId,
  appendMessages,
  closeOpenConversation,
  WEB_PREVIEW_NUMBER,
} from "@/lib/data/chat";
import { getFlagRules } from "@/lib/data/flags";
import { upsertConversationAnalysis } from "@/lib/data/conversations";
import { analyzeConversation } from "@/lib/enrichment";
import { askEngine } from "@/lib/engine";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

  const conversationId = await getOpenConversationId(workspace.id);
  const messages = conversationId
    ? await getConversationMessages(workspace.id, conversationId)
    : [];
  return NextResponse.json({
    conversationId,
    messages,
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
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

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

  // Motor real (apps/api): el mismo que responde por WhatsApp (triage sensible, rutas de
  // ayuda deterministas, material del programa). Persiste el par user+assistant por su
  // cuenta — acá NO se hace appendMessages. Si no responde, NO hay respaldo: otra respuesta
  // (sin triage ni rutas) engañaría la prueba y podría contestar un riesgo sin rutas.
  const engine = await askEngine({
    workspaceId: workspace.id,
    conversationId,
    userNumber: WEB_PREVIEW_NUMBER,
    question: parsed.data.message,
  });
  if (!engine) {
    return NextResponse.json(
      { error: "El asistente no responde ahora. Inténtalo en un minuto." },
      { status: 503 }
    );
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(engine.answer));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversationId,
      "X-Intent": engine.intent,
    },
  });
}

/**
 * Reinicia la conversación del preview: la cierra y la analiza contra las
 * reglas de alerta del workspace (summary/keywords/flags van al inbox).
 */
export async function DELETE(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

  const conversationId = await getOpenConversationId(workspace.id);
  const messages = conversationId
    ? await getConversationMessages(workspace.id, conversationId)
    : [];
  await closeOpenConversation(workspace.id);

  if (conversationId && messages.length >= 2) {
    try {
      const rules = await getFlagRules(workspace.id);
      const analysis = await analyzeConversation(workspace.id, messages, rules);
      if (analysis) {
        await upsertConversationAnalysis(
          workspace.id,
          conversationId,
          WEB_PREVIEW_NUMBER,
          analysis,
          messages.length
        );
      }
    } catch (error) {
      // El cierre no debe fallar por el análisis
      console.error("[chat] No se pudo analizar la conversación cerrada:", error);
    }
  }

  return NextResponse.json({ ok: true });
}
