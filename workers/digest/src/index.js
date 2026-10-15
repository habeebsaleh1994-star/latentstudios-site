// latent-digest -- the owner's morning letter (src/digest.js). It has no public address; it runs on its schedule.
import { sendDigest } from './digest.js';

export default {
  async fetch() {
    return new Response(null, { status: 404 });
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(sendDigest(env).catch((error) => {
      console.error('latent digest failed', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown');
    }));
  },
};
