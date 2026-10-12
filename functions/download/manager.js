import { serveManagerApplication } from '../../src/server/manager-application-release.js';

function serve(context) {
  return serveManagerApplication(context);
}

export const onRequestGet = serve;
export const onRequestHead = serve;
