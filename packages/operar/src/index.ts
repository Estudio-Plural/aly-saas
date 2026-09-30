// Operar: cifras agregadas (sin PII), reporte semanal y Excel. Lo usan el
// panel (apps/web) y el job del engine (apps/api) — mismo código, mismo número.
export * from "./tiempo";
export * from "./cifras";
export * from "./datos";
export * from "./reporte";
export { construirXlsx, type Hoja, type Fila, type Celda, type Estilo } from "./xlsx";
