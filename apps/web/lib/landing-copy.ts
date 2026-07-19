export const LANDING_COPY = {
  productName: "Plural",
  nav: {
    features: "Funciones",
    howItWorks: "Cómo funciona",
    pricing: "Precios",
    dashboard: "Entrar al dashboard",
    createAssistant: "Crear mi asistente",
  },
  hero: {
    eyebrow: "Asistentes de IA para WhatsApp",
    headline: {
      before: "Convertí tu conocimiento en un ",
      highlight: "programa conversacional",
      after: " que acompaña a cada persona",
    },
    subheadline:
      "Diseñá flujos de aprendizaje y cambio de comportamiento por WhatsApp sin código. Cada participante interactúa con un asistente que entiende tu protocolo y responde con tus propias fuentes.",
    ctaPrimary: "Crear mi asistente",
    ctaSecondary: "Ver cómo funciona",
  },
  steps: {
    title: "De tu conocimiento a una conversación en minutos",
    subtitle: "Así se ve el camino completo, sin tocar una línea de código.",
    items: [
      {
        title: "Subí tu conocimiento",
        description: "Documentos, guías o protocolos. El asistente los indexa y los usa como fuente al responder.",
      },
      {
        title: "Diseñá el programa",
        description: "Definí la identidad del asistente y el storyboard: el arco de la conversación en 4 momentos.",
      },
      {
        title: "Conectá WhatsApp",
        description: "Cada workspace tiene su número. Los usuarios hablan desde la app que ya usan.",
      },
    ],
  },
  features: {
    title: "Todo lo que necesitás para acompañar a escala",
    subtitle: "Una plataforma pensada para programas conversacionales serios.",
    items: [
      {
        title: "RAG real",
        description: "Responde basándose en tus propios documentos, no en conocimiento genérico.",
      },
      {
        title: "Programa no-code",
        description: "Storyboard del programa y guion de arranque, con preview en vivo.",
      },
      {
        title: "Alertas en lenguaje natural",
        description: "Decile en tus palabras qué conversaciones querés que te marque como prioritarias.",
      },
      {
        title: "Multi-tenant",
        description: "Una cuenta, múltiples programas o clientes aislados. White-label desde día uno.",
      },
      {
        title: "Chat con memoria",
        description: "Cada conversación conserva historial, variables y estado entre interacciones.",
      },
      {
        title: "WhatsApp Business",
        description: "Integración lista para números de empresa. Tus usuarios no instalan nada.",
      },
    ],
  },
  pricing: {
    title: "Precios simples",
    subtitle: "Empezá gratis. Escalá cuando tu programa crezca.",
    plans: [
      {
        name: "Prueba",
        price: "Gratis",
        period: "14 días",
        description: "Para probar tu primer asistente sin compromiso.",
        features: ["1 workspace", "Base de conocimiento", "Chat de preview", "Storyboard del programa"],
        cta: "Empezar gratis",
        highlighted: false,
      },
      {
        name: "Pro",
        price: "$49",
        period: "/mes",
        description: "Para equipos que gestionan múltiples programas o clientes.",
        features: [
          "Workspaces ilimitados",
          "Alertas avanzadas",
          "Integración WhatsApp",
          "Soporte prioritario",
        ],
        cta: "Elegir Pro",
        highlighted: true,
      },
    ],
  },
  cta: {
    title: "Empezá gratis hoy",
    subtitle: "En minutos tenés tu primer asistente conversacional. Sin tarjeta, sin setup técnico.",
    cta: "Crear mi asistente",
  },
  footer: {
    copyright: `© ${new Date().getFullYear()} Plural. Todos los derechos reservados.`,
  },
};
