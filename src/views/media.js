// Renders an optional media clue attached to any activity.
// The teacher can record themselves reading a riddle (video or audio); the on-screen text
// and captions are always shown too, for accessibility and for students who can't play sound.
//
// activity.media shape:
// {
//   type: 'video' | 'audio',
//   src: string,                 // path to the media file (e.g. 'assets/media/riddle.mp4')
//   captions?: string,           // path to a WebVTT (.vtt) captions file
//   poster?: string,             // optional poster image for video
//   text?: string,               // the riddle text, kept on screen alongside the clip
//   label?: string,              // small heading, e.g. "Mr. B reads the riddle"
//   placeholder?: boolean        // true while this is a stand-in file, not a real recording
// }
//
// The riddle text is always rendered, so a clue that can't be played (no sound, no real
// recording yet, autoplay blocked) never blocks a team from solving the puzzle.

import { el } from '../engine/dom.js';

export function renderMedia(media) {
  if (!media || !media.src) return null;

  let player;
  if (media.type === 'audio') {
    player = el('audio', { class: 'clue-audio', controls: true, preload: 'metadata', src: media.src });
  } else {
    player = el('video', {
      class: 'clue-video',
      controls: true,
      preload: 'metadata',
      playsInline: true,
      poster: media.poster || null,
    });
    player.appendChild(el('source', { src: media.src }));
  }

  if (media.captions) {
    // Captions make the spoken clue accessible; default the track on for video.
    player.appendChild(el('track', {
      kind: 'captions',
      src: media.captions,
      srclang: 'en',
      label: 'English',
      default: media.type !== 'audio',
    }));
  }

  return el('figure', { class: `clue-media clue-${media.type || 'video'}` }, [
    media.label ? el('figcaption', { class: 'clue-label' }, `🔊 ${media.label}`) : null,
    media.placeholder
      ? el('p', { class: 'clue-placeholder' }, 'Sample clip — the real recording is coming. Read the riddle below.')
      : null,
    player,
    media.text ? el('div', { class: 'clue-text' }, media.text) : null,
  ]);
}
