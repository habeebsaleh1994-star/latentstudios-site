import { servePrintEngineRelease } from '../../src/server/print-engine-release.js';

function serve(context) {
  return servePrintEngineRelease(context, {
    cacheControl: 'public, max-age=3600',
  });
}

export const onRequestGet = serve;
export const onRequestHead = serve;
