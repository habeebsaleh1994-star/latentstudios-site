import { serveManagerFeed } from '../../../../../src/server/manager-release.js';

function serve(context) {
  return serveManagerFeed(context, 'latent-ritual', context.params.channel);
}

export const onRequestGet = serve;
export const onRequestHead = serve;
