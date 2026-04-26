import assert from 'node:assert/strict';
import { formatMeetingDateTime, getMeetingSubmissionLabel } from '../src/utils/meetingSubmission.js';

const runTest = (name: string, assertion: () => void) => {
  assertion();
  console.log(`LULUS: ${name}`);
};

runTest('unit: formatMeetingDateTime memformat tarikh penghantaran mengikut zon masa Malaysia', () => {
  const formatted = formatMeetingDateTime('2026-04-26T02:30:00.000Z');
  assert.match(formatted || '', /^26 April 2026(?:,| pada)? 10:30$/);
});

runTest('integration: getMeetingSubmissionLabel memaparkan label rekod HQ yang lengkap', () => {
  const label = getMeetingSubmissionLabel('2026-04-26T02:30:00.000Z');
  assert.match(label, /^26 April 2026(?:,| pada)? 10:30$/);
});

runTest('security: input tarikh tidak sah tidak memecahkan paparan dan dipulangkan sebagai label selamat', () => {
  assert.equal(formatMeetingDateTime('bukan-tarikh'), null);
  assert.equal(getMeetingSubmissionLabel('bukan-tarikh'), 'Belum direkod');
  assert.equal(getMeetingSubmissionLabel(null), 'Belum direkod');
});
