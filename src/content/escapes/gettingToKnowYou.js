// Escape: Getting to Know You
// The end-of-class, start-of-year team builder. Ported from the original single-file game
// into the framework, and wired to the same Google Form so existing data collection keeps working.

export const gettingToKnowYou = {
  id: 'getting-to-know-you',
  title: "Mr. B's Classroom Escape",
  subtitle: 'Get-to-know-you team builder',
  icon: '🚪',
  structure: 'linear',
  format: 'Educational · Icebreaker',
  gradeBand: 'Middle school',
  estimatedMinutes: 25,
  tags: ['icebreaker', 'teamwork', 'start-of-year'],
  summary:
    'Teams of 3–4 decode a cipher, crack riddles, share their goals, open a number vault, and write a team motto to escape the room together.',
  intro:
    'Oh no! The bell rang but the classroom door is locked. Work together through five challenges to escape — and get to know your teammates along the way.',

  activities: [
    // Challenge 1 — Team setup (name game cipher)
    {
      id: 'gtky-team',
      type: 'team-setup',
      icon: '🔤',
      title: 'The Name Game Cipher',
      story:
        'The escape cipher needs to know who is on your team. Enter your class period, then each member\'s name and favorite subject.',
      config: { periods: ['1', '2', '4', '5'], minMembers: 3, maxMembers: 4 },
      hints: ['Make sure every name is spelled correctly — later puzzles use them!'],
      bonus: {
        title: '🌟 Bonus: Team Handshake',
        body: 'While other teams work, design a unique team handshake. On paper, draw or write step-by-step instructions including each person\'s move.',
      },
    },

    // Challenge 2 — Locker riddle (reused from the shared bank)
    'riddle-keyboard',

    // Challenge 3 — Dreams / goals
    {
      id: 'gtky-dreams',
      type: 'team-responses',
      icon: '✨',
      title: 'The Dream Decoder',
      story:
        'The locker opens to reveal a dream catcher: "Each team member must share one dream or goal for this school year to reveal the path forward."',
      config: {
        minLength: 10,
        placeholder: (member) => `${member.name}: one goal or dream for this school year`,
        successMessage: 'Beautiful dreams! Your shared aspirations unlock the next challenge.',
      },
      hints: ['Dreams can be about academics, friendships, sports, clubs, or personal growth.'],
      bonus: {
        title: '🎯 Bonus: Find Common Ground',
        body: 'Find one thing ALL team members share (besides being in this class). Write it down and one sentence about why it surprised you.',
      },
    },

    // Challenge 4 — Number vault (computed from earlier answers)
    {
      id: 'gtky-vault',
      type: 'computed-lock',
      icon: '🔢',
      title: 'The Number Vault',
      story: 'Your shared dreams unlocked a number vault — but you must solve it step by step, together.',
      config: {
        steps: [
          {
            label: 'Add up the total number of letters in all your team members\' first names.',
            placeholder: 'Total letters in all names',
            compute: (state) => (state.team.names || []).join('').length,
            error: (state, correct) => `Step 1 incorrect. The total letters in all names should be ${correct}. Count again!`,
          },
          {
            label: 'Multiply that number by the number of DIFFERENT favorite subjects your team chose.',
            placeholder: 'Result after multiplying',
            compute: (state) => {
              const letters = (state.team.names || []).join('').length;
              const unique = new Set(state.team.subjects || []).size;
              return letters * unique;
            },
            error: (state, correct) => {
              const letters = (state.team.names || []).join('').length;
              const unique = new Set(state.team.subjects || []).size;
              return `Step 2 incorrect. ${letters} letters × ${unique} unique subjects = ${correct}.`;
            },
          },
          {
            label: 'Add 13 (for the grade + 5 challenges) to get your final vault code!',
            placeholder: 'Final vault code',
            compute: (state) => {
              const letters = (state.team.names || []).join('').length;
              const unique = new Set(state.team.subjects || []).size;
              return letters * unique + 13;
            },
            error: (state, correct) => `Step 3 incorrect. Add 13 to your Step 2 answer to get ${correct}.`,
          },
        ],
        successMessage: (state) => {
          const letters = (state.team.names || []).join('').length;
          const unique = new Set(state.team.subjects || []).size;
          return `Perfect calculations! The vault opens with code ${letters * unique + 13}!`;
        },
      },
      hints: ['Count each letter carefully, then figure out how many unique subjects were chosen.'],
      bonus: {
        title: '🧮 Bonus Math',
        body: 'If each member high-fives every other member once, how many high-fives happen? Show your work on paper, then do the high-fives!',
      },
    },

    // Challenge 5 — Team motto
    {
      id: 'gtky-motto',
      type: 'constructed-answer',
      icon: '🏆',
      title: 'The Team Motto',
      story: 'One final challenge! Write a team motto or cheer to escape the room.',
      config: {
        requirements: [
          'Includes every team member\'s name',
          'Includes at least one favorite subject someone mentioned',
          'Includes the word "together"',
        ],
        placeholder: 'Write your amazing team motto here!',
        minLength: 20,
        checks: [
          {
            test: (value, state) =>
              (state.team.names || []).every((n) => value.toLowerCase().includes(n.toLowerCase())),
            error: 'Make sure to include ALL team members\' names in your motto!',
          },
          {
            test: (value, state) =>
              (state.team.subjects || []).some((s) => value.toLowerCase().includes(s.toLowerCase())),
            error: 'Include at least one of the favorite subjects mentioned earlier!',
          },
          {
            test: (value) => value.toLowerCase().includes('together'),
            error: 'Remember to include the word "together" in your motto!',
          },
        ],
        successMessage: 'AMAZING MOTTO! You\'ve completed every challenge!',
      },
      hints: ['Make it fun and positive — a chant, a poem, or a creative statement that represents the whole team.'],
      bonus: {
        title: '🎭 Bonus: Victory Pose',
        body: 'Create a team victory pose that represents your personality. Sketch it on paper and label each person\'s position.',
      },
    },
  ],

  victory: {
    title: '🎉 Congratulations — you escaped!',
    message:
      'By working together and sharing your unique strengths, dreams, and ideas, you can overcome any challenge. The best part of this year will be the friendships you build along the way!',
    accomplishments: [
      '✨ Learned everyone\'s names and favorite subjects',
      '🧠 Solved puzzles using teamwork',
      '💫 Shared your dreams and goals',
      '🤝 Created a team motto together',
      '🏆 Built stronger connections with your teammates',
    ],
    bonusIntro: 'While other teams finish, try a bonus activity. Do all work on paper for Mr. B to collect.',
    bonuses: [
      { label: 'Team Handshake Design', title: '🌟 Team Handshake', body: 'Create a unique handshake for your group. On paper, draw step-by-step instructions with each person\'s move.' },
      { label: 'Extra Riddle', title: '🧩 Extra Riddle', body: 'What gets wetter the more it dries? Write your answer and explain your reasoning as a team.' },
      { label: 'Find Common Ground', title: '🎯 Common Ground', body: 'Find one thing ALL members share. Write it down and why it surprised you.' },
      { label: 'High-Five Math', title: '🧮 High-Five Math', body: 'If each member high-fives every other member once, how many high-fives total? Show your work, then do them!' },
      { label: 'Victory Pose', title: '🎭 Victory Pose', body: 'Create a team victory pose. Sketch it and label each person\'s position.' },
    ],
  },

  // Results are captured locally by default — view/export them from the hub's Results view.
  // To also send results to a Google Sheet without field-id mapping, add a 'webhook' sink
  // pointing at a Google Apps Script Web App (see README). Example:
  //   results: { sinks: ['local', 'webhook'], webhook: { url: 'https://script.google.com/…/exec' } }
  results: {
    sinks: ['local'],
    buildRecord: (state, meta) => {
      const team = state.team || {};
      return {
        timestamp: new Date().toISOString(),
        escape: 'Getting to Know You',
        period: team.period || '',
        teamSize: team.size || (team.names || []).length || '',
        members: (team.members || []).map((m) => `${m.name} (${m.subject})`).join('; '),
        dreams: (state.answers['gtky-dreams'] || []).join(' | '),
        motto: state.answers['gtky-motto'] || '',
        completionTime: meta.completionTime,
      };
    },
  },
};
