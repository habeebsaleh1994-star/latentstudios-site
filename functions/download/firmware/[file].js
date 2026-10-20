import { serveFirmwareFile } from '../../../src/server/firmware-release.js';

function serve(context) {
  return serveFirmwareFile(context, String(context.params.file ?? ''));
}

export const onRequestGet = serve;
export const onRequestHead = serve;
