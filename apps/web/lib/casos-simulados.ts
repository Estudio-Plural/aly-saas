// Respuestas SIMULADAS del banco de casos difíciles — solo para ver la UI en
// desarrollo sin gastar LLM (CASOS_RESPUESTAS_SIMULADAS=1; nunca en producción).
// Imitan al engine: el caso de crisis trae el bloque de rutas que el engine anexa en
// código. Algunas fallan a propósito para que se vean los ⚠.
import type { Caso } from "@/lib/casos";
import type { HelpRoute } from "@/lib/design";

function bloqueRutas(rutas: HelpRoute[]): string {
  const validas = rutas.filter((r) => r.name?.trim() && r.contact?.trim());
  if (!validas.length) return "";
  const linea = (r: HelpRoute) => {
    const extra = [r.hours?.trim(), r.territory?.trim()].filter(Boolean).join(" · ");
    return `-> *${r.name.trim()}* — ${r.contact.trim()}${extra ? ` (${extra})` : ""}`;
  };
  return `\n\n*Líneas de ayuda:*\n${validas.map(linea).join("\n")}`;
}

const RESPUESTAS: Record<string, string> = {
  telefono:
    "Claro. Si necesitas hablar con alguien ya, puedes llamar a la Línea 155, que atiende todo el día. ¿Quieres que te cuente qué pasa cuando llamas?",
  fuera_material:
    "No tengo esa información en el material del programa. Te sugiero preguntarle al equipo de coordinación.",
  fuera_programa:
    "Eso se sale de lo que hago: acompaño el programa. ¿Quieres que retomemos la actividad de esta semana?",
  agendar: "¡Claro! Te aviso mañana temprano para que no se te olvide la sesión.",
  privacidad:
    "No es privado: el equipo del programa puede ver las conversaciones para acompañarte mejor. No compartimos tus mensajes fuera del programa.",
  saludo: "¡Hola! Qué bueno que escribes. ¿En qué te ayudo hoy?",
  ofensivo:
    "Entiendo que estés molesto. Estoy aquí para ayudarte con el programa. ¿Qué necesitas? Si quieres, también te cuento qué puedo hacer.",
};

export function respuestaSimulada(caso: Caso, rutas: HelpRoute[]): { answer: string; intent: string } {
  if (caso.tipo === "crisis") {
    return {
      answer:
        "Lo que cuentas es muy serio y me importa. No tienes que pasar por esto sola ni solo. ¿Estás en un lugar seguro ahora?" +
        bloqueRutas(rutas),
      intent: "SENSITIVE",
    };
  }
  return {
    answer: RESPUESTAS[caso.tipo] ?? "Gracias por escribir. Lo reviso con el material del programa y te respondo lo que sé.",
    intent: "FACTUAL",
  };
}
