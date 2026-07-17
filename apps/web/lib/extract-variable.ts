// Helper de cliente: pide al servidor el valor limpio de una variable de
// onboarding ("Me llamo Daniel" → "Daniel"). Failsafe: ante cualquier error
// devuelve la respuesta cruda — capturar la variable nunca corta el flujo.

export async function extractVariable(
  workspaceSlug: string,
  input: { question: string; variable: string; answer: string }
): Promise<string> {
  try {
    const res = await fetch(`/api/workspaces/${workspaceSlug}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return input.answer;
    const data = await res.json();
    return typeof data.value === "string" && data.value.trim()
      ? data.value.trim()
      : input.answer;
  } catch {
    return input.answer;
  }
}
