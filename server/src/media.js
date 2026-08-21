// Media upload rules, kept pure so they can be unit-tested without R2 or a browser.
//
// Shared by the Worker's POST /api/admin/media route. The client never chooses the storage
// key and its own size claim is never trusted — both are decided here, server-side.

/** Content types a teacher may upload, mapped to the extension we store them under. */
export const ALLOWED_MEDIA_TYPES = {
  'video/webm': 'webm',   // Chrome, Edge, Firefox, ChromeOS
  'video/mp4': 'mp4',     // Safari
  'audio/webm': 'weba',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
};

/** 40 MB. A 2-minute 720p clip is 15-25 MB; this leaves headroom without risking the free tier. */
export const MAX_MEDIA_BYTES = 40 * 1024 * 1024;

/** Normalize 'video/webm;codecs=vp9' -> 'video/webm', then look up the extension. */
export function extensionForType(contentType) {
  if (!contentType) return null;
  const base = String(contentType).split(';')[0].trim().toLowerCase();
  return ALLOWED_MEDIA_TYPES[base] || null;
}

/**
 * Decide whether an upload may proceed, before any bytes are read.
 * Type is checked before size: of the two, the wrong-file-type message is the actionable one.
 * @returns {{ok: true} | {ok: false, status: number, error: string}}
 */
export function validateUpload({ contentType, contentLength }) {
  if (!extensionForType(contentType)) {
    return {
      ok: false,
      status: 415,
      error: 'That file type is not supported. Record a video or audio clip, or upload an .mp4, .webm, .mp3, or .m4a file.',
    };
  }
  // A missing length means a chunked body we cannot bound up front — refuse rather than
  // stream something unbounded into storage.
  if (contentLength == null || Number.isNaN(contentLength) || contentLength <= 0) {
    return { ok: false, status: 413, error: 'The upload was empty or its size could not be determined.' };
  }
  if (contentLength > MAX_MEDIA_BYTES) {
    const mb = Math.round(contentLength / (1024 * 1024));
    return {
      ok: false,
      status: 413,
      error: `That clip is about ${mb} MB — the limit is 40 MB. Try a shorter take, or record audio instead of video.`,
    };
  }
  return { ok: true };
}

/** Server-chosen storage key. Always under clues/, so a client can never escape the prefix. */
export function mediaKey(contentType, uuid) {
  const ext = extensionForType(contentType);
  return ext ? `clues/${uuid}.${ext}` : null;
}
