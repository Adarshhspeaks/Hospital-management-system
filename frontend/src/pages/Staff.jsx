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
  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'receptionist', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  function openEdit(u) {
    setError('');
    setNotice('');
    setEditingStaff(u);
    setEditForm({ name: u.name, role: u.role, password: '' });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingStaff) return;
    setError('');
    setNotice('');
    setSavingEdit(true);

    try {
      const payload = {
        name: editForm.name,
        role: editForm.role,
      };
      if (editForm.password && editForm.password.trim().length > 0) {
        payload.password = editForm.password.trim();
      }

      const updated = await api(`/users/${editingStaff.user_id}`, {
        method: 'PUT',
        body: payload,
      });

      setNotice(`Updated account for ${updated.name}.`);
      setEditingStaff(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Staff accounts</h1>

      <form className="panel form-grid" onSubmit={addStaff}>
        <h2>Add a staff member</h2>

        <div>
          <label htmlFor="s-name">Full name</label>
          <input id="s-name" value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label htmlFor="s-user">Username</label>
          <input id="s-user" value={form.username} onChange={set('username')} autoComplete="off" required />
        </div>
        <div>
          <label htmlFor="s-pass">Password</label>
          <input id="s-pass" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
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
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn ghost small" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    {u.user_id !== me.id && (
                      <button className="btn ghost small" onClick={() => toggle(u)}>
                        {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingStaff && (
        <div className="modal-backdrop" onClick={() => setEditingStaff(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2>Edit Staff: {editingStaff.username}</h2>
            <form onSubmit={handleSaveEdit} className="form-grid">
              <div>
                <label htmlFor="edit-name">Full Name</label>
                <input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="edit-pass">Reset Password (leave blank to keep current)</label>
                <input
                  id="edit-pass"
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn ghost" onClick={() => setEditingStaff(null)} disabled={savingEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
