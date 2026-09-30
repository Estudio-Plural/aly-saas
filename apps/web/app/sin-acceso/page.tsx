export const metadata = { title: "Sin acceso" };

// Llega acá quien no trae una identidad válida de la puerta de Plural IA (sesión vencida,
// o la app corriendo sin la puerta delante).
export default function SinAccesoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          No pudimos confirmar quién eres
        </h1>
        <p className="text-neutral-600">
          Vuelve a entrar con el correo al que te dimos acceso. Si el problema sigue, escríbenos
          a{" "}
          <a className="underline" href="mailto:hola@estudio-plural.co">
            hola@estudio-plural.co
          </a>
          .
        </p>
        <a
          href="/_auth/login?next=/dashboard"
          className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Entrar
        </a>
      </div>
    </div>
  );
}
