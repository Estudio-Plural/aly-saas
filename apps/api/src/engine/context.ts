// Formato del contexto de retrieval que ve el LLM. Módulo aparte (sin DB)
// para poder testearlo aunque otros tests mockeen retrieval.ts.

export interface ContextChunk {
  documentName: string;
  text: string;
}

/**
 * Contexto para el LLM SIN nombres de archivo: el modelo no puede citar lo
 * que no ve (garantía de «Material»: el asistente nunca nombra archivos).
 * Los nombres siguen en `chunks` para logs y la UI.
 */
export function formatContext(chunks: ContextChunk[]): string {
  return chunks
    .map((c, i) => `[Fragmento ${i + 1} del material del programa]\n${c.text}`)
    .join("\n\n---\n\n");
}

