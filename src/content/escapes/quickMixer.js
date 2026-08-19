// Escape: 10-Minute Mixer
// A short escape assembled mostly from the shared activity bank — it demonstrates how the
// same reusable activities can be mixed and matched into a different, shorter experience.

export const quickMixer = {
  id: 'quick-mixer',
  title: '10-Minute Mixer',
  subtitle: 'A fast warm-up escape',
  icon: '⚡',
  structure: 'linear',
  format: 'Warm-up · Digital adventure',
  gradeBand: 'Any',
  estimatedMinutes: 10,
  tags: ['warm-up', 'riddles', 'short'],
  summary:
    'A quick escape built by mixing riddles from the shared bank with a fast team check-in. Perfect for the last ten minutes of class.',
  intro: 'Only ten minutes on the clock! Race through a few riddles and a quick team challenge to escape.',

  activities: [
    {
      id: 'mixer-team',
      type: 'team-setup',
      icon: '⚡',
      title: 'Line Up Your Crew',
      story: 'Quick — get your team on the board before the timer runs out!',
      config: { periods: ['1', '2', '3', '4', '5', '6'], minMembers: 2, maxMembers: 4 },
    },
    // Reused straight from the shared bank (mix-and-match):
    'riddle-candle',
    'riddle-map',
    'math-handshakes',
    {
      id: 'mixer-exit',
      type: 'constructed-answer',
      icon: '🎟️',
      title: 'Exit Ticket',
      story: 'One last gate: write a quick shout-out to escape.',
      config: {
        requirements: ['Mentions at least one teammate by name', 'Uses the word "escape"'],
        placeholder: 'e.g. "Team Jordan and Sam escaped in record time!"',
        minLength: 15,
        checks: [
          {
            test: (value, state) => (state.team.names || []).some((n) => value.toLowerCase().includes(n.toLowerCase())),
            error: 'Mention at least one teammate by name.',
          },
          { test: (value) => value.toLowerCase().includes('escape'), error: 'Include the word "escape".' },
        ],
        successMessage: 'Nice — you beat the clock!',
      },
    },
  ],

  victory: {
    title: '⚡ You escaped the Mixer!',
    message: 'Fast work! You warmed up your teamwork and your brains.',
    accomplishments: ['🧩 Cracked a set of riddles', '🤝 Worked fast as a team', '🎟️ Wrote a winning exit ticket'],
  },
};
