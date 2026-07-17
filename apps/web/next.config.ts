import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: fija la raíz del workspace para que Turbopack no la infiera
  // (evita el warning de "multiple lockfiles / inferred workspace root").
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  // Permite acceder al dev server desde la tailnet (VPS plural-ai);
  // sin esto Next 16 responde 403 a los assets /_next/* cross-origin.
  allowedDevOrigins: ["100.102.137.92", "plural-ai.tail8d56f3.ts.net"],
};

export default nextConfig;
