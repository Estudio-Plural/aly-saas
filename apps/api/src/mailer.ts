// Correo saliente del engine (reporte semanal y alertas por correo cuando el
// protocolo de la organización elige ese canal). SMTP por env; sin SMTP no hay
// correo y quien llama decide qué hacer (el reporte queda para descargar).

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface MailMessage {
  /** Destinatarios. Van en copia oculta: los miembros no ven los correos de los demás. */
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const DEFAULT_MAIL_FROM = "Plural <hola@estudio-plural.co>";

/** Mailer SMTP (nodemailer) si SMTP_HOST está configurado; si no, null. */
export async function mailerFromEnv(
  env: Record<string, string | undefined> = process.env,
): Promise<Mailer | null> {
  if (!env.SMTP_HOST) return null;
  const nodemailer = await import("nodemailer");
  const port = Number(env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
  });
  const from = env.SMTP_FROM || DEFAULT_MAIL_FROM;
  return {
    async send(message) {
      await transport.sendMail({
        from,
        to: from,
        bcc: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content),
          contentType: a.contentType,
        })),
      });
    },
  };
}
