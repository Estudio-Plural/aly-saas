import { redirect } from "next/navigation";

export default function RootPage() {
  // Por ahora redirige al dashboard directamente
  // Después se puede hacer una landing page aquí
  redirect("/dashboard");
}
