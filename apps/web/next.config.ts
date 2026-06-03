import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: fija la raíz del workspace para que Turbopack no la infiera
  // (evita el warning de "multiple lockfiles / inferred workspace root").
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
