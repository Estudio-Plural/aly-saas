import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { chatCompletion, getChatModel, isLlmConfigured } from "@/lib/llm";

type Params = { params: Promise<{ slug: string }> };

/**
 * Extrae el valor limpio de una variable de onboarding desde la respuesta
 * cruda del usuario ("Me llamo Daniel" → "Daniel"). Failsafe total: ante
 * cualquier problema devuelve la respuesta original — el flujo nunca se corta.
 */
const schema = z.object({
  question: z.string().trim().min(1).max(1000),
  variable: z.string().trim().min(1).max(100),
  answer: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { question, variable, answer } = parsed.data;
  if (!isLlmConfigured()) {
    return NextResponse.json({ value: answer });
  }

  try {
    const model = await getChatModel(workspace.id);
    const raw = await chatCompletion(
      [
        {
          role: "user",
          content:
            `Sos el extractor de variables de un flujo de onboarding conversacional. ` +
            `El asistente hizo una pregunta para capturar la variable «${variable}» y el usuario respondió.\n\n` +
            `Extraé de la respuesta ÚNICAMENTE el valor a guardar en la variable, limpio y sin frases alrededor. ` +
            `Ejemplos: "Me llamo Daniel" → Daniel; "mi correo es ana@x.com" → ana@x.com; "soy de Cali, Colombia" → Cali, Colombia. ` +
            `Conservá la capitalización natural del valor. Si la respuesta ya es solo el valor, devolvela igual. ` +
            `Si no hay un valor claro, devolvé la respuesta original tal cual.\n\n` +
            `Respondé SOLO con el valor, sin comillas ni explicaciones.\n\n` +
            `Pregunta: ${question}\n` +
            `Respuesta del usuario: ${answer}`,
        },
      ],
      model
    );
    const value = cleanExtracted(raw);
    return NextResponse.json({ value: value || answer });
  } catch (error) {
    console.error("[extract] Falló la extracción, se usa la respuesta cruda:", error);
    return NextResponse.json({ value: answer });
  }
}

/** Quita comillas envolventes y espacios que el modelo a veces agrega. */
function cleanExtracted(text: string): string {
  let value = text.trim();
  const wrappers: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ["«", "»"],
    ["“", "”"],
  ];
  for (const [open, close] of wrappers) {
    if (value.startsWith(open) && value.endsWith(close) && value.length > 1) {
      value = value.slice(open.length, -close.length).trim();
    }
  }
  return value;
}
