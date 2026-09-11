import { serveManagerPackage } from '../../../../../../src/server/manager-release.js';

function serve(context) {
  return serveManagerPackage(context, context.params.channel, context.params.version);
}

export const onRequestGet = serve;
export const onRequestHead = serve;
