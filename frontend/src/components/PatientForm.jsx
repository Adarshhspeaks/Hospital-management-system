import { useState } from 'react';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const emptyPatient = { name: '', age: '', gender: '', phone: '', bloodGroup: '', address: '' };

// Used for both registering and editing a patient
export default function PatientForm({ initial = emptyPatient, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handle(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmit({ ...form, age: form.age === '' ? '' : Number(form.age) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={handle} noValidate>
      <div className="span-2">
        <label htmlFor="p-name">Full name</label>
        <input id="p-name" value={form.name} onChange={set('name')} autoFocus />
      </div>
      <div>
        <label htmlFor="p-age">Age</label>
        <input id="p-age" type="number" min="0" max="120" value={form.age} onChange={set('age')} />
      </div>
      <div>
        <label htmlFor="p-gender">Gender</label>
        <select id="p-gender" value={form.gender} onChange={set('gender')}>
          <option value="">Choose…</option>
          {GENDERS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="p-phone">Phone</label>
        <input id="p-phone" inputMode="numeric" value={form.phone} onChange={set('phone')} />
      </div>
      <div>
        <label htmlFor="p-blood">Blood group (optional)</label>
        <select id="p-blood" value={form.bloodGroup} onChange={set('bloodGroup')}>
          <option value="">Not known</option>
          {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div className="span-all">
        <label htmlFor="p-address">Address (optional)</label>
        <input id="p-address" value={form.address} onChange={set('address')} />
      </div>

      {error && <p className="error span-all" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
