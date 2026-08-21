// Recorder transitions, kept free of browser APIs so they can be unit-tested.
//
//   idle ──start──→ recording ──stopped──→ review ──uploading──→ saved
//    │                                       │                     │
//    └──filePicked──────────────────────────→┘                     │
//                                            ↑                     │
//                        uploadFailed ───────┘        retake ──────┘
//
// Two rules encoded here that are easy to get wrong:
//
//  1. `uploadFailed` returns to `review`, NOT `idle`, and keeps blobUrl. A network hiccup
//     must never destroy a take the teacher just recorded.
//  2. `retake` keeps `media`. "Replace" on an existing recording is a retake; if it cleared
//     media, cancelling a replace would silently delete a recording that was working.

export function initialRecorderState(media) {
  return media && media.src
    ? { phase: 'saved', kind: media.type || 'video', blobUrl: null, media, error: null }
    : { phase: 'idle', kind: 'video', blobUrl: null, media: null, error: null };
}

export function recorderReducer(state, action) {
  switch (action.type) {
    case 'start':
      return { ...state, phase: 'recording', kind: action.kind, blobUrl: null, error: null };

    case 'stopped':
      return { ...state, phase: 'review', blobUrl: action.blobUrl, error: null };

    case 'filePicked':
      return { ...state, phase: 'review', kind: action.kind, blobUrl: action.blobUrl, error: null };

    // Also used by "Replace" — deliberately keeps `media` so a cancelled replace is harmless.
    case 'retake':
      return { ...state, phase: 'idle', blobUrl: null, error: null };

    case 'uploading':
      return { ...state, phase: 'uploading', error: null };

    case 'uploaded':
      return { ...state, phase: 'saved', media: action.media, blobUrl: null, error: null };

    // Back to review, not idle: the take survives so it can be retried.
    case 'uploadFailed':
      return { ...state, phase: 'review', error: action.error };

    case 'remove':
      return { ...state, phase: 'idle', media: null, blobUrl: null, error: null };

    // Report a problem (e.g. denied camera permission) without changing where the user is.
    case 'error':
      return { ...state, error: action.error };

    default:
      return state;
  }
}
