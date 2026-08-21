// Escape: Escape the Cipher Lab
// A LINEAR escape (one challenge at a time) designed for a group sharing a single laptop.
// Showcases the tech-integrated puzzle types: cipher, combination lock, musical sequence,
// and a hidden physical clue. The group works each puzzle together, in order.

export const cipherLab = {
  id: 'cipher-lab',
  title: 'Escape the Cipher Lab',
  subtitle: 'Codes, locks & riddles',
  icon: '🧪',
  structure: 'linear',
  format: 'Educational · Puzzle adventure',
  gradeBand: 'Middle / High school',
  estimatedMinutes: 20,
  tags: ['ciphers', 'logic', 'tech-integrated'],
  summary:
    'Dr. Cipher locked the lab! Work together, one lock at a time — decode a secret message, crack the digital lock, play the sound sequence, and find the hidden formula to escape.',
  intro: 'The lab door sealed shut behind you. Solve each lock in order and you\'ll be out in no time — put your heads together!',

  activities: [
    // One tap to start. The full roster comes after the first puzzle, so a team is solving
    // something within seconds instead of filling in a form first.
    {
      id: 'lab-period',
      type: 'class-period',
      icon: '🏫',
      title: 'Badge In',
      story: 'The lab door scanner needs to know which class you are.',
      config: { periods: ['1', '2', '4', '5'] },
    },
    {
      id: 'lab-cipher',
      type: 'cipher',
      icon: '🔐',
      title: 'The Secret Password',
      story: 'A glowing panel shows a scrambled word. A dial on the side is turned to "+3" — a clue to how the letters were shifted.',
      config: {
        scheme: 'caesar',
        shift: 3,
        plaintext: 'TEAMWORK',
        prompt: 'Crack the code to reveal the password that opens the next lock:',
        successMessage: 'Password accepted — the panel glows green!',
        wrongMessage: 'Not yet. Move each letter 3 places back through the alphabet and try again.',
      },
      hints: [
        'The dial says +3, so each letter was moved 3 forward. Move each one 3 back to read it.',
        'The first letter W becomes T (W→V→U→T). Keep going!',
      ],
    },
    {
      id: 'lab-team',
      type: 'team-setup',
      icon: '🧑‍🔬',
      title: 'Lab Team Sign-In',
      story: 'Before the lab systems wake up, register your research team.',
      config: { periods: ['1', '2', '3', '4', '5', '6'], minMembers: 2, maxMembers: 4 },
    },
    {
      id: 'lab-lock',
      type: 'combination-lock',
      icon: '🔢',
      title: 'The Digital Lock',
      story: 'A three-dial lock guards the supply cabinet. A sticky note reads: "first the number of seasons, then a pair, then a lucky one."',
      config: {
        combination: '427',
        prompt: 'Roll the dials to the three-digit code.',
        successMessage: 'The cabinet clicks open!',
        wrongMessage: 'The lock holds firm. Re-read the sticky note and try again.',
      },
      hints: ['Four seasons, a pair is two, a lucky number is seven: 4, 2, 7.'],
    },
    {
      id: 'lab-sequence',
      type: 'sequence',
      icon: '🎵',
      title: 'The Sound Lock',
      story: 'Four tone pads glow on the wall. The lab speaker hums a short tune: low, high, then the two middle notes.',
      config: {
        pads: [
          { id: 'do', label: 'Do', freq: 261, color: 'linear-gradient(45deg,#e74c3c,#c0392b)' },
          { id: 're', label: 'Re', freq: 293, color: 'linear-gradient(45deg,#e67e22,#d35400)' },
          { id: 'mi', label: 'Mi', freq: 329, color: 'linear-gradient(45deg,#f1c40f,#f39c12)' },
          { id: 'so', label: 'So', freq: 392, color: 'linear-gradient(45deg,#27ae60,#16a085)' },
        ],
        answer: ['do', 'so', 're', 'mi'],
        successMessage: 'The melody resolves — the sound lock opens!',
        wrongMessage: 'That tune isn\'t quite right. Remember: low, high, then the two middles.',
      },
      hints: ['Tap them in this order: Do (low), So (high), Re, then Mi.'],
    },
    {
      id: 'lab-hidden',
      type: 'hidden-clue',
      icon: '🔎',
      title: 'The Hidden Formula',
      story: 'The final lock needs a formula your teacher hid somewhere in the room on a beaker label.',
      config: {
        where: 'Look for the beaker label your teacher placed in the room.',
        accept: ['H2O', 'water'],
        prompt: 'Find the label and enter the chemical formula written on it.',
        successMessage: 'That\'s the formula — the lab door unlocks!',
        wrongMessage: 'That\'s not it — keep searching the room for the beaker label.',
      },
      hints: ['It\'s the chemical formula for water.'],
    },
  ],

  victory: {
    title: '🧪 You escaped the Cipher Lab!',
    message: 'By thinking it through together, one lock at a time, your team cracked every code. Great teamwork!',
    accomplishments: [
      '🔐 Decoded a secret Caesar cipher',
      '🔢 Cracked a digital combination lock',
      '🎵 Solved a musical sound sequence',
      '🔎 Found the hidden formula',
    ],
  },

  results: { sinks: ['local'] },
};
