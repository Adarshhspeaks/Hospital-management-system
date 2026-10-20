const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Returns 3-letter weekday for a YYYY-MM-DD date string (e.g. 'Mon')
function getDayOfWeek(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return DAYS[date.getUTCDay()];
}

// Generates 30-minute time slots between start and end (e.g. '09:00' to '13:00')
function generateSlots(startStr, endStr) {
  const slots = [];
  if (!startStr || !endStr || !/^\d{2}:\d{2}$/.test(startStr) || !/^\d{2}:\d{2}$/.test(endStr)) {
    return slots;
  }
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  let currentMins = sH * 60 + sM;
  const endMins = eH * 60 + eM;

  while (currentMins + 30 <= endMins) {
    const h = String(Math.floor(currentMins / 60)).padStart(2, '0');
    const m = String(currentMins % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMins += 30;
  }
  return slots;
}

// Checks if a given slot date and time is in the past
function isPastDateTime(dateStr, timeStr) {
  if (!dateStr) return false;
  const now = new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = (timeStr || '23:59').split(':').map(Number);
  // Construct local date/time for the slot
  const slotDate = new Date(y, m - 1, d, h, min, 0, 0);
  return slotDate.getTime() < now.getTime();
}

// Safely parses availability JSON text
function parseAvailability(raw) {
  const fallback = {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    start: '09:00',
    end: '13:00',
  };
  if (!raw) return fallback;
  if (typeof raw === 'object' && raw !== null) return raw;
  try {
    const parsed = JSON.parse(raw);
    return {
      days: Array.isArray(parsed.days) ? parsed.days : fallback.days,
      start: parsed.start || fallback.start,
      end: parsed.end || fallback.end,
    };
  } catch {
    return fallback;
  }
}

module.exports = {
  DAYS,
  getDayOfWeek,
  generateSlots,
  isPastDateTime,
  parseAvailability,
};
