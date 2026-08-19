// Reusable activity bank.
//
// These are self-contained activities that any escape can pull in by id (mix-and-match).
// Keep them generic (no dependency on a specific escape's earlier answers) so they can be
// dropped into different escapes and durations. Activities that need earlier answers
// (e.g. a lock computed from the roster) are usually defined inline in the escape instead.

export const bank = {
  // --- Classic riddles (multiple-choice) ---------------------------------
  'riddle-keyboard': {
    id: 'riddle-keyboard',
    type: 'multiple-choice',
    icon: '🧩',
    title: 'The Locker Combination',
    story: 'You find an old school locker with a note: "Solve this riddle together before you can open me. Discuss every option as a team!"',
    // Optional media clue: a recording of the teacher reading the riddle (text stays on screen).
    media: {
      type: 'video',
      src: 'assets/media/locker-riddle.mp4',
      captions: 'assets/media/locker-riddle.vtt',
      label: 'Mr. B reads the riddle',
      text: 'I have keys but no locks. I have space but no room. You can enter, but you can\'t go outside. What am I?',
    },
    config: {
      prompt: 'I have keys but no locks. I have space but no room. You can enter, but you can\'t go outside. What am I?',
      options: [
        { id: 'piano', label: '🎹 Piano' },
        { id: 'computer', label: '💻 Computer' },
        { id: 'keyboard', label: '⌨️ Keyboard' },
        { id: 'typewriter', label: '📝 Typewriter' },
      ],
      correct: 'keyboard',
      successMessage: 'Correct! A keyboard has keys but no locks, space but no room, and you can enter but can\'t go outside.',
      wrongMessage: 'Not quite — think about something you use every day that has "keys" and a "space" bar…',
    },
    hints: [
      'Think about things you use every day in school.',
      'It has "keys" and "space" — but not the kind you first imagine.',
    ],
  },

  'riddle-candle': {
    id: 'riddle-candle',
    type: 'multiple-choice',
    icon: '🕯️',
    title: 'The Melting Clue',
    story: 'A flickering light reveals your next riddle.',
    media: {
      type: 'audio',
      src: 'assets/media/candle-riddle.m4a',
      captions: 'assets/media/candle-riddle.vtt',
      label: 'Listen to the riddle',
      text: 'The more you take, the more you leave behind. What am I?',
    },
    config: {
      prompt: 'The more you take, the more you leave behind. What am I?',
      options: [
        { id: 'time', label: '⏳ Time' },
        { id: 'footsteps', label: '👣 Footsteps' },
        { id: 'memories', label: '💭 Memories' },
        { id: 'money', label: '💰 Money' },
      ],
      correct: 'footsteps',
      successMessage: 'Exactly — footsteps! The more you take, the more you leave behind.',
      wrongMessage: 'Close, but think about what you literally leave behind as you walk…',
    },
    hints: ['Picture walking across wet sand.'],
  },

  // --- Free-text riddles (great for "search the room" style clues) --------
  'riddle-towel': {
    id: 'riddle-towel',
    type: 'text-answer',
    icon: '💧',
    title: 'The Damp Puzzle',
    story: 'A soggy note challenges your team.',
    config: {
      prompt: 'What gets wetter the more it dries?',
      placeholder: 'One word…',
      accept: ['towel', 'a towel'],
      successMessage: 'Right — a towel!',
      wrongMessage: 'Think about what you use to dry off after swimming.',
    },
    hints: ['You use it after a shower or a swim.'],
  },

  'riddle-map': {
    id: 'riddle-map',
    type: 'text-answer',
    icon: '🗺️',
    title: 'The Explorer\'s Riddle',
    story: 'An ancient scroll unrolls in front of you.',
    config: {
      prompt: 'I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?',
      placeholder: 'Type your answer…',
      accept: ['map', 'a map'],
      successMessage: 'A map — well navigated!',
      wrongMessage: 'You might unfold this on a road trip…',
    },
    hints: ['It helps you find your way.'],
  },

  // --- Quick team math --------------------------------------------------
  'math-handshakes': {
    id: 'math-handshakes',
    type: 'text-answer',
    icon: '🤝',
    title: 'Handshake Count',
    story: 'A final gate asks a teamwork math question.',
    config: {
      prompt: 'If every member of a team of 4 shakes hands with every other member exactly once, how many handshakes happen in total?',
      placeholder: 'Enter a number…',
      accept: ['6', 'six'],
      successMessage: '6 handshakes — nicely calculated!',
      wrongMessage: 'Try drawing it out: person 1 shakes 3 hands, person 2 shakes 2 new hands…',
    },
    hints: ['4 people, each pair once: 3 + 2 + 1.'],
  },
};
