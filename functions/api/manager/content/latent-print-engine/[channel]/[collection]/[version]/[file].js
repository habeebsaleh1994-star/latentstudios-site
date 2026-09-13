import { serveManagerContentAsset } from '../../../../../../../../src/server/manager-release.js';

function serve(context) {
  return serveManagerContentAsset(
    context,
    context.params.channel,
    context.params.collection,
    context.params.version,
    context.params.file,
  );
}

export const onRequestGet = serve;
export const onRequestHead = serve;
