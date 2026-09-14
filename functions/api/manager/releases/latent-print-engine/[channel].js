import { serveManagerFeed } from '../../../../../src/server/manager-release.js';

function serve(context) {
  return serveManagerFeed(context, 'latent-print-engine', context.params.channel);
}

export const onRequestGet = serve;
export const onRequestHead = serve;
