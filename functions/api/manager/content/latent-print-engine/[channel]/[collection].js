import { serveManagerContentFeed } from '../../../../../../src/server/manager-release.js';

function serve(context) {
  return serveManagerContentFeed(
    context,
    context.params.channel,
    context.params.collection,
  );
}

export const onRequestGet = serve;
export const onRequestHead = serve;
