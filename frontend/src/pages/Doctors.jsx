import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import AvailabilityEditor from '../components/AvailabilityEditor.jsx';

const DEFAULT_AVAIL = {
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  start: '09:00',
  end: '13:00',
};

export default function Doctors() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const isDoctor = user.role === 'doctor';

  const [doctors, setDoctors] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterSpec, setFilterSpec] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [saving, setSaving] = useState(false);

  // Add form fields
  const [addForm, setAddForm] = useState({
    user_id: '',
    specialization: '',
    qualification: '',
    fee: '500',
    availability: DEFAULT_AVAIL,
  });

  // Edit form fields
  const [editForm, setEditForm] = useState({
    specialization: '',
    qualification: '',
    fee: '',
    availability: DEFAULT_AVAIL,
  });

  function loadDoctors() {
    let url = '/doctors?';
    if (filterSpec.trim()) url += `specialization=${encodeURIComponent(filterSpec.trim())}&`;
    if (filterDate) url += `date=${encodeURIComponent(filterDate)}&`;

    api(url)
      .then((data) => {
        setDoctors(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function loadCandidates() {
    if (!isAdmin) return;
    api('/doctors/candidates')
      .then((data) => setCandidates(data))
      .catch(() => {});
  }

  useEffect(() => {
    loadDoctors();
  }, [filterSpec, filterDate]);

  useEffect(() => {
    if (isAdmin) loadCandidates();
  }, [isAdmin]);

  async function handleAddDoctor(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = {
        user_id: Number(addForm.user_id),
        specialization: addForm.specialization,
        qualification: addForm.qualification,
        fee: Number(addForm.fee),
        availability: addForm.availability,
      };
      const created = await api('/doctors', { method: 'POST', body: payload });
      setSuccess(`Doctor profile created for ${created.name || 'doctor'}.`);
      setShowAddForm(false);
      setAddForm({
        user_id: '',
        specialization: '',
        qualification: '',
        fee: '500',
        availability: DEFAULT_AVAIL,
      });
      loadDoctors();
      loadCandidates();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(doc) {
    setEditingDoctor(doc);
    setEditForm({
      specialization: doc.specialization,
      qualification: doc.qualification || '',
      fee: String(doc.fee),
      availability: doc.availability || DEFAULT_AVAIL,
    });
    setShowAddForm(false);
    setError('');
    setSuccess('');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingDoctor) return;
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = isAdmin
        ? {
            specialization: editForm.specialization,
            qualification: editForm.qualification,
            fee: Number(editForm.fee),
            availability: editForm.availability,
          }
        : {
            availability: editForm.availability,
          };

      await api(`/doctors/${editingDoctor.doctor_id}`, { method: 'PUT', body: payload });
      setSuccess('Doctor profile updated successfully.');
      setEditingDoctor(null);
      loadDoctors();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">Doctors</h1>
          <p className="lede">View doctor specializations, consultation fees, and working hours.</p>
        </div>

        {isAdmin && !showAddForm && !editingDoctor && (
          <button
            className="btn primary"
            onClick={() => {
              setShowAddForm(true);
              setError('');
              setSuccess('');
            }}
          >
            Add doctor profile
          </button>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      {/* Admin Add Doctor Profile Form */}
      {showAddForm && (
        <form className="panel form-grid" onSubmit={handleAddDoctor}>
          <h2>Create doctor profile</h2>

          <div>
            <label htmlFor="d-user">Select doctor account</label>
            <select
              id="d-user"
              value={addForm.user_id}
              onChange={(e) => setAddForm({ ...addForm, user_id: e.target.value })}
              required
            >
              <option value="">Choose doctor user…</option>
              {candidates.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.name} (@{c.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="d-spec">Specialization</label>
            <input
              id="d-spec"
              placeholder="e.g. Cardiology, Pediatrics"
              value={addForm.specialization}
              onChange={(e) => setAddForm({ ...addForm, specialization: e.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="d-qual">Qualification</label>
            <input
              id="d-qual"
              placeholder="e.g. MBBS, MD"
              value={addForm.qualification}
              onChange={(e) => setAddForm({ ...addForm, qualification: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="d-fee">Consultation fee (₹)</label>
            <input
              id="d-fee"
              type="number"
              min="0"
              step="10"
              value={addForm.fee}
              onChange={(e) => setAddForm({ ...addForm, fee: e.target.value })}
              required
            />
          </div>

          <AvailabilityEditor
            value={addForm.availability}
            onChange={(avail) => setAddForm({ ...addForm, availability: avail })}
          />

          <div className="form-actions">
            <button className="btn primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create profile'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Edit Doctor Modal / Panel */}
      {editingDoctor && (
        <form className="panel form-grid" onSubmit={handleSaveEdit}>
          <h2>Edit {isAdmin ? `Dr. ${editingDoctor.name}` : 'My Availability'}</h2>

          {isAdmin ? (
            <>
              <div>
                <label htmlFor="edit-spec">Specialization</label>
                <input
                  id="edit-spec"
                  value={editForm.specialization}
                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-qual">Qualification</label>
                <input
                  id="edit-qual"
                  value={editForm.qualification}
                  onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="edit-fee">Consultation fee (₹)</label>
                <input
                  id="edit-fee"
                  type="number"
                  min="0"
                  step="10"
                  value={editForm.fee}
                  onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })}
                  required
                />
              </div>
            </>
          ) : null}

          <AvailabilityEditor
            value={editForm.availability}
            onChange={(avail) => setEditForm({ ...editForm, availability: avail })}
          />

          <div className="form-actions">
            <button className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setEditingDoctor(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter controls */}
      <div className="filters-row">
        <div className="filter-group">
          <label htmlFor="filter-spec">Filter by specialization</label>
          <input
            id="filter-spec"
            type="search"
            placeholder="Search specialization…"
            value={filterSpec}
            onChange={(e) => setFilterSpec(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-date">Available on date</label>
          <input
            id="filter-date"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        {(filterSpec || filterDate) && (
          <button
            className="btn ghost small"
            onClick={() => {
              setFilterSpec('');
              setFilterDate('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Doctors Table */}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Specialization</th>
              <th>Qualification</th>
              <th>Fee</th>
              <th>Working Days & Hours</th>
              {(isAdmin || isDoctor) && <th><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => {
              const canEdit = isAdmin || (isDoctor && d.user_id === user.id);
              const daysStr = d.availability?.days?.join(', ') || 'None';
              const hoursStr = `${d.availability?.start || '09:00'} - ${d.availability?.end || '13:00'}`;

              return (
                <tr key={d.doctor_id}>
                  <td>
                    <strong>{d.name}</strong>
                    {isDoctor && d.user_id === user.id && (
                      <span className="tag active" style={{ marginLeft: '8px' }}>You</span>
                    )}
                  </td>
                  <td>{d.specialization}</td>
                  <td>{d.qualification || '—'}</td>
                  <td>₹{d.fee}</td>
                  <td>
                    <div><strong>{daysStr}</strong></div>
                    <small className="muted">{hoursStr}</small>
                  </td>
                  {(isAdmin || isDoctor) && (
                    <td className="right">
                      {canEdit && (
                        <button
                          className="btn ghost small"
                          onClick={() => startEdit(d)}
                        >
                          {isAdmin ? 'Edit profile' : 'Edit hours'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {!loading && doctors.length === 0 && (
              <tr>
                <td colSpan={isAdmin || isDoctor ? 6 : 5} className="empty">
                  {filterSpec || filterDate
                    ? 'No doctors match the selected filters.'
                    : 'No doctor profiles registered yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
