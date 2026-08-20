// Builder schemas: describe the editable fields for each activity type so the visual
// escape builder can auto-generate friendly forms (no code / no JSON required).
//
// Field descriptor shapes:
//   { key, label, kind: 'text'|'textarea'|'number'|'select'|'stringlist', ... }
//   select adds { options: [{value,label}] }
//   'options' kind = multiple-choice options editor (list of choices + which is correct)

export const ACTIVITY_SCHEMAS = [
  {
    type: 'multiple-choice',
    icon: '🧩',
    label: 'Multiple choice',
    description: 'A question with clickable options and a correct answer.',
    fields: [
      { key: 'prompt', label: 'Question', kind: 'textarea', placeholder: 'Ask a question…' },
      { key: 'options', label: 'Choices (mark the correct one)', kind: 'options' },
      { key: 'successMessage', label: 'On correct (optional)', kind: 'text', placeholder: 'Correct!' },
      { key: 'wrongMessage', label: 'On wrong (optional)', kind: 'text', placeholder: 'Try again as a team.' },
    ],
    defaults: () => ({ prompt: '', options: [{ id: 'a', label: '' }, { id: 'b', label: '' }], correct: 'a' }),
  },
  {
    type: 'text-answer',
    icon: '✏️',
    label: 'Type the answer',
    description: 'A riddle or question the team answers by typing.',
    fields: [
      { key: 'prompt', label: 'Question / riddle', kind: 'textarea' },
      { key: 'placeholder', label: 'Answer box hint (optional)', kind: 'text' },
      { key: 'accept', label: 'Accepted answers', kind: 'stringlist', placeholder: 'e.g. towel' },
      { key: 'successMessage', label: 'On correct (optional)', kind: 'text' },
      { key: 'wrongMessage', label: 'On wrong (optional)', kind: 'text' },
    ],
    defaults: () => ({ prompt: '', accept: [''] }),
  },
  {
    type: 'cipher',
    icon: '🔐',
    label: 'Secret code (cipher)',
    description: 'Show a scrambled word the team decodes and types.',
    fields: [
      { key: 'prompt', label: 'Instruction', kind: 'text', placeholder: 'Crack the code…' },
      { key: 'scheme', label: 'Cipher type', kind: 'select', options: [
        { value: 'caesar', label: 'Caesar (shift letters)' },
        { value: 'atbash', label: 'Atbash (reverse alphabet)' },
        { value: 'symbol', label: 'Symbols' },
      ] },
      { key: 'shift', label: 'Shift amount (Caesar only)', kind: 'number' },
      { key: 'plaintext', label: 'Secret word/answer', kind: 'text', placeholder: 'TEAMWORK' },
      { key: 'successMessage', label: 'On correct (optional)', kind: 'text' },
    ],
    defaults: () => ({ scheme: 'caesar', shift: 3, plaintext: '' }),
  },
  {
    type: 'combination-lock',
    icon: '🔢',
    label: 'Number lock',
    description: 'Dials the team rolls to a secret number combination.',
    fields: [
      { key: 'prompt', label: 'Instruction', kind: 'text', placeholder: 'Set the dials to the code.' },
      { key: 'combination', label: 'Combination (digits)', kind: 'text', placeholder: '427' },
      { key: 'successMessage', label: 'On correct (optional)', kind: 'text' },
    ],
    defaults: () => ({ combination: '000' }),
  },
  {
    type: 'hidden-clue',
    icon: '🔎',
    label: 'Hidden clue (search)',
    description: 'Team searches the room for a code you hid, then types it.',
    fields: [
      { key: 'prompt', label: 'Instruction', kind: 'textarea' },
      { key: 'where', label: '“Where to look” hint (optional)', kind: 'text' },
      { key: 'accept', label: 'Accepted codes', kind: 'stringlist' },
      { key: 'successMessage', label: 'On correct (optional)', kind: 'text' },
    ],
    defaults: () => ({ prompt: '', accept: [''] }),
  },
  {
    type: 'constructed-answer',
    icon: '📝',
    label: 'Creative writing',
    description: 'Team writes something (a motto, a story) that meets requirements.',
    fields: [
      { key: 'prompt', label: 'Prompt', kind: 'textarea' },
      { key: 'requirements', label: 'Requirements shown to students', kind: 'stringlist' },
      { key: 'minLength', label: 'Minimum length (characters)', kind: 'number' },
      { key: 'successMessage', label: 'On success (optional)', kind: 'text' },
    ],
    defaults: () => ({ prompt: '', requirements: [''], minLength: 20, checks: [] }),
  },
  {
    type: 'team-setup',
    icon: '🧑‍🤝‍🧑',
    label: 'Team sign-in',
    description: 'Collects class period + team member names & subjects.',
    fields: [
      { key: 'periods', label: 'Class periods', kind: 'stringlist' },
      { key: 'minMembers', label: 'Minimum members', kind: 'number' },
      { key: 'maxMembers', label: 'Maximum members', kind: 'number' },
    ],
    defaults: () => ({ periods: ['1', '2', '3', '4', '5', '6'], minMembers: 2, maxMembers: 4 }),
  },
  {
    type: 'team-responses',
    icon: '💬',
    label: 'Everyone answers',
    description: 'Each team member types their own response.',
    fields: [
      { key: 'prompt', label: 'Prompt', kind: 'textarea' },
      { key: 'minLength', label: 'Minimum length each (characters)', kind: 'number' },
      { key: 'successMessage', label: 'On success (optional)', kind: 'text' },
    ],
    defaults: () => ({ prompt: '', minLength: 10, fallbackCount: 3 }),
  },
];

export function getSchema(type) {
  return ACTIVITY_SCHEMAS.find((s) => s.type === type) || null;
}
