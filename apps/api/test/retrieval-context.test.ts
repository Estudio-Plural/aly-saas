// Garantía de «Material»: el contexto que ve el LLM no lleva nombres de archivo.
import { expect, test } from "bun:test";
import { formatContext } from "../src/engine/context";

test("el contexto no expone nombres de archivo", () => {
  const context = formatContext([
    { documentName: "protocolo-interno-v3.pdf", text: "Paso 1: respirar." },
    { documentName: "guia.md", text: "Paso 2: nombrar lo que sientes." },
  ]);
  expect(context).not.toContain("protocolo-interno-v3.pdf");
  expect(context).not.toContain("guia.md");
  expect(context).toContain("[Fragmento 1 del material del programa]\nPaso 1: respirar.");
  expect(context).toContain("[Fragmento 2 del material del programa]");
});
