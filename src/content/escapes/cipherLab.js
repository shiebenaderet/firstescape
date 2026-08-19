// Escape: Escape the Cipher Lab
// A NON-LINEAR escape: every puzzle is available at once, so team members split up and solve
// in parallel (great for communication + delegation). Showcases the tech-integrated puzzle
// types: cipher, combination lock, musical sequence, hidden physical clue, and GPS geo-check.

export const cipherLab = {
  id: 'cipher-lab',
  title: 'Escape the Cipher Lab',
  subtitle: 'Non-linear · solve in any order',
  icon: '🧪',
  structure: 'non-linear',
  format: 'Educational · Digital adventure',
  gradeBand: 'Middle / High school',
  estimatedMinutes: 20,
  tags: ['non-linear', 'ciphers', 'logic', 'tech-integrated'],
  summary:
    'Dr. Cipher locked the lab! Split up your team — decode a cipher, crack a digital lock, play the sound sequence, find a hidden code, and reach the checkpoint. Solve all five to escape.',
  intro: 'The lab door sealed shut. Five independent locks stand between you and freedom — divide and conquer!',

  activities: [
    {
      id: 'lab-team',
      type: 'team-setup',
      icon: '🧑‍🔬',
      title: 'Lab Team Sign-In',
      story: 'Before the lab systems unlock, register your research team.',
      config: { periods: ['1', '2', '3', '4', '5', '6'], minMembers: 2, maxMembers: 4 },
    },
    {
      id: 'lab-cipher',
      type: 'cipher',
      icon: '🔐',
      title: 'The Caesar Panel',
      story: 'A glowing panel displays scrambled letters. A dial reads "+3".',
      config: {
        scheme: 'caesar',
        shift: 3,
        plaintext: 'TEAMWORK',
        prompt: 'Decode the panel to reveal the password:',
        successMessage: 'Password accepted — the panel goes green!',
      },
      hints: ['Shift every letter back by 3 (D→A, E→B, …).'],
    },
    {
      id: 'lab-lock',
      type: 'combination-lock',
      icon: '🔢',
      title: 'The Digital Lock',
      story: 'A three-dial digital lock guards the supply cabinet. A sticky note says: "Prime, then double the first, then subtract one."',
      config: {
        combination: '427',
        prompt: 'Set the dials to the right code.',
        successMessage: 'The cabinet clicks open!',
      },
      hints: ['First dial 4, second dial 2, third dial 7.'],
    },
    {
      id: 'lab-sequence',
      type: 'sequence',
      icon: '🎵',
      title: 'The Sound Lock',
      story: 'Four tone pads. The lab speaker hums a tune: low, high, then the two middles.',
      config: {
        pads: [
          { id: 'do', label: 'Do', freq: 261, color: 'linear-gradient(45deg,#e74c3c,#c0392b)' },
          { id: 're', label: 'Re', freq: 293, color: 'linear-gradient(45deg,#e67e22,#d35400)' },
          { id: 'mi', label: 'Mi', freq: 329, color: 'linear-gradient(45deg,#f1c40f,#f39c12)' },
          { id: 'so', label: 'So', freq: 392, color: 'linear-gradient(45deg,#27ae60,#16a085)' },
        ],
        answer: ['do', 'so', 're', 'mi'],
        successMessage: 'The melody resolves — the sound lock opens!',
      },
      hints: ['Low = Do, High = So, then the middles Re then Mi.'],
    },
    {
      id: 'lab-hidden',
      type: 'hidden-clue',
      icon: '🔎',
      title: 'The Hidden Formula',
      story: 'Part of the escape code is hidden somewhere in the room on a beaker label.',
      config: {
        where: 'Look under the blue beaker on the demo table.',
        accept: ['H2O', 'water'],
        prompt: 'Find the beaker label and enter the formula written on it.',
        successMessage: 'That\'s the formula — one step closer!',
      },
      hints: ['It\'s the chemical formula for water.'],
    },
    {
      id: 'lab-geo',
      type: 'geo-check',
      icon: '📍',
      title: 'The Checkpoint',
      story: 'The final lock needs a team member to reach the checkpoint and confirm their location.',
      config: {
        // Replace with your real coordinates. Teacher override is enabled for testing / indoor use.
        target: { lat: 40.7484, lng: -73.9857 },
        radiusMeters: 60,
        allowOverride: true,
        successMessage: 'Checkpoint reached — the lab door unlocks!',
      },
      hints: ['Allow location access when prompted, or use the teacher override.'],
    },
  ],

  victory: {
    title: '🧪 You escaped the Cipher Lab!',
    message: 'By splitting up and communicating, your team cracked five very different locks at once. That\'s real collaboration!',
    accomplishments: [
      '🔐 Decoded a Caesar cipher',
      '🔢 Cracked a digital combination lock',
      '🎵 Solved a musical sound sequence',
      '🔎 Found a hidden physical clue',
      '📍 Reached the geo checkpoint',
    ],
  },

  results: { sinks: ['local'] },
};
