import {
  invitationMatches,
  legacyAccessMatches,
} from '../../../src/server/print-engine-invitation.js';
import { servePrintEngineRelease } from '../../../src/server/print-engine-release.js';

async function serve(context) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const access = url.searchParams.get('access');
  const invitation = url.searchParams.get('invite');
  const [legacyAuthorized, invitationAuthorized] = await Promise.all([
    legacyAccessMatches(access, env.LATENT_BETA_DOWNLOAD_TOKEN),
    invitationMatches(invitation, env.LATENT_BETA_DOWNLOAD_TOKEN),
  ]);
  const authorized = legacyAuthorized || invitationAuthorized;
  if (!authorized) {
    return new Response('Not found', { status: 404 });
  }

  return servePrintEngineRelease(context);
}

export const onRequestGet = serve;
export const onRequestHead = serve;
