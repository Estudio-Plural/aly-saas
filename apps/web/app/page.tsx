import { redirect } from "next/navigation";

export default function RootPage() {
  // Redirige al dashboard
  redirect("/dashboard");
}
