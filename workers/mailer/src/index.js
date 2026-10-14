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
    await this.env.EMAIL.send(message);
    return { sent: true };
  }
}
