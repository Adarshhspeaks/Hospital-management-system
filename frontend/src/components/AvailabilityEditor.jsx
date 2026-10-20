const ALL_DAYS = [
  { key: 'Mon', label: 'Mon' },
  { key: 'Tue', label: 'Tue' },
  { key: 'Wed', label: 'Wed' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Fri', label: 'Fri' },
  { key: 'Sat', label: 'Sat' },
  { key: 'Sun', label: 'Sun' },
];

export default function AvailabilityEditor({ value = {}, onChange }) {
  const currentDays = Array.isArray(value.days) ? value.days : [];
  const start = value.start || '09:00';
  const end = value.end || '13:00';

  function toggleDay(dayKey) {
    let nextDays;
    if (currentDays.includes(dayKey)) {
      nextDays = currentDays.filter((d) => d !== dayKey);
    } else {
      // Keep sorted by normal day order
      nextDays = ALL_DAYS.map((d) => d.key).filter((d) => currentDays.includes(d) || d === dayKey);
    }
    onChange({ ...value, days: nextDays, start, end });
  }

  function handleTimeChange(field, val) {
    onChange({ ...value, [field]: val, days: currentDays });
  }

  return (
    <div className="span-all">
      <label>Working days</label>
      <div className="days-flex">
        {ALL_DAYS.map(({ key, label }) => (
          <label key={key} className="day-label">
            <input
              type="checkbox"
              checked={currentDays.includes(key)}
              onChange={() => toggleDay(key)}
            />
            {label}
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div>
          <label htmlFor="avail-start">Start time</label>
          <input
            id="avail-start"
            type="time"
            value={start}
            onChange={(e) => handleTimeChange('start', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="avail-end">End time</label>
          <input
            id="avail-end"
            type="time"
            value={end}
            onChange={(e) => handleTimeChange('end', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
