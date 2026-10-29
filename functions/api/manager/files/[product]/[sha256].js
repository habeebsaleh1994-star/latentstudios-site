import { serveManagerFile } from '../../../../../src/server/manager-release.js';

function serve(context) {
  return serveManagerFile(context, context.params.product, context.params.sha256);
}

export const onRequestGet = serve;
export const onRequestHead = serve;
