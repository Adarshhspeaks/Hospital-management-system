import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const ROLES = [
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'admin', label: 'Admin' },
];
const empty = { name: '', username: '', password: '', role: 'receptionist' };

export default function Staff() {
  const { user: me } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () =>
    api('/users').then(setStaff).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function addStaff(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const created = await api('/users', { method: 'POST', body: form });
      setNotice(`Account created for ${created.name}.`);
      setForm(empty);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(u) {
    setError('');
    setNotice('');
    const status = u.status === 'active' ? 'inactive' : 'active';
    try {
      await api(`/users/${u.user_id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h1 className="page-title">Staff accounts</h1>

      <form className="panel form-grid" onSubmit={addStaff}>
        <h2>Add a staff member</h2>

        <div>
          <label htmlFor="s-name">Full name</label>
          <input id="s-name" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label htmlFor="s-user">Username</label>
          <input id="s-user" value={form.username} onChange={set('username')} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="s-pass">Password</label>
          <input id="s-pass" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="s-role">Role</label>
          <select id="s-role" value={form.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="form-actions">
          <button className="btn primary">Create account</button>
        </div>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.user_id}>
                <td>{u.name}</td>
                <td>{u.username}</td>
                <td>{ROLES.find((r) => r.value === u.role)?.label}</td>
                <td><span className={`tag ${u.status}`}>{u.status === 'active' ? 'Active' : 'Deactivated'}</span></td>
                <td className="right">
                  {u.user_id !== me.id && (
                    <button className="btn ghost small" onClick={() => toggle(u)}>
                      {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
