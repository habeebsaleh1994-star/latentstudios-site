// latent-mailer — the site's one way to send an email (Cloudflare Email Service). It has no public address: the site's Pages
// Functions reach it through a service binding (SEND_EMAIL) and call send(). It sends only from the studio's sending domain.
import { WorkerEntrypoint } from 'cloudflare:workers';

const SENDING_DOMAIN = 'mail.latentstudios.art';

export default class Mailer extends WorkerEntrypoint {
  async fetch() {
    return new Response(null, { status: 404 });
  }

  async send(message) {
    const from = typeof message?.from === 'string' ? message.from : message?.from?.email;
    if (!from || !from.toLowerCase().endsWith(`@${SENDING_DOMAIN}`)) throw new Error('sender_not_allowed');
    if (typeof message.to !== 'string' || !message.subject) throw new Error('message_incomplete');
    // A send that hasn't answered in 10 s has failed: the page then offers Copy the link instead of waiting on a hung request.
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('mailer_timeout')), 10_000); });
    try {
      const result = await Promise.race([this.env.EMAIL.send(message), timeout]);
      return { sent: true, messageId: result?.messageId ?? null };
    } finally {
      clearTimeout(timer);
    }
  }
}
