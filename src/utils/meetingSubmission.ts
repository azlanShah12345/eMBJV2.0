const MALAYSIA_LOCALE = 'ms-MY';
const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatMeetingDate = (value: string | null | undefined) => {
  const parsed = parseDate(value);
  if (!parsed) return null;

  return new Intl.DateTimeFormat(MALAYSIA_LOCALE, {
    timeZone: MALAYSIA_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
};

export const formatMeetingDateTime = (value: string | null | undefined) => {
  const parsed = parseDate(value);
  if (!parsed) return null;

  return new Intl.DateTimeFormat(MALAYSIA_LOCALE, {
    timeZone: MALAYSIA_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsed);
};

export const getMeetingSubmissionLabel = (value: string | null | undefined) =>
  formatMeetingDateTime(value) || 'Belum direkod';
