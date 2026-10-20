import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { formatDate } from '../format.js';

export default function Pharmacy() {
  const { user } = useAuth();
  const isPharmacist = user.role === 'pharmacist';

  const [medicines, setMedicines] = useState([]);
  const [alerts, setAlerts] = useState({ total: 0, low_stock: 0, near_expiry: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(''); // '' (all), 'low_stock', 'near_expiry', 'expired'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    price: '',
    expiry_date: '',
    threshold: '10',
  });

  function loadAlerts() {
    api('/medicines/alerts')
      .then((data) => setAlerts(data))
      .catch(() => {});
  }

  function loadMedicines() {
    let url = '/medicines?';
    if (search.trim()) url += `q=${encodeURIComponent(search.trim())}&`;
    if (activeFilter) url += `status=${encodeURIComponent(activeFilter)}&`;

    api(url)
      .then((data) => {
        setMedicines(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [search, activeFilter]);

  function resetForm() {
    setFormData({
      name: '',
      quantity: '',
      price: '',
      expiry_date: '',
      threshold: '10',
    });
  }

  function handleOpenAdd() {
    resetForm();
    setShowAddForm(true);
    setEditingMed(null);
    setError('');
    setSuccess('');
  }

  function handleStartEdit(med) {
    setEditingMed(med);
    setFormData({
      name: med.name,
      quantity: String(med.quantity),
      price: String(med.price),
      expiry_date: med.expiry_date || '',
      threshold: String(med.threshold),
    });
    setShowAddForm(false);
    setError('');
    setSuccess('');
  }

  async function handleSaveMedicine(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        quantity: Number(formData.quantity),
        price: Number(formData.price),
        threshold: Number(formData.threshold),
        expiry_date: formData.expiry_date || null,
      };

      if (editingMed) {
        await api(`/medicines/${editingMed.medicine_id}`, { method: 'PUT', body: payload });
        setSuccess(`Medicine "${payload.name}" updated successfully.`);
        setEditingMed(null);
      } else {
        await api('/medicines', { method: 'POST', body: payload });
        setSuccess(`Medicine "${payload.name}" added to pharmacy inventory.`);
        setShowAddForm(false);
      }

      resetForm();
      loadMedicines();
      loadAlerts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMedicine(med) {
    const confirmed = window.confirm(`Are you sure you want to delete "${med.name}" from inventory?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      const res = await api(`/medicines/${med.medicine_id}`, { method: 'DELETE' });
      setSuccess(res.message || `"${med.name}" deleted.`);
      loadMedicines();
      loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">{isPharmacist ? 'Medicine Stock' : 'Pharmacy Medicines'}</h1>
          <p className="lede">
            {isPharmacist
              ? 'Manage pharmacy inventory, track stock levels, and monitor expiration dates.'
              : 'Browse available medicines, check inventory quantities and prices.'}
          </p>
        </div>

        {isPharmacist && !showAddForm && !editingMed && (
          <button className="btn primary" onClick={handleOpenAdd}>
            Add medicine
          </button>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      {/* Alerts Summary Cards */}
      <div className="stats-grid">
        <div
          className={`stat-card ${activeFilter === '' ? 'selected' : ''}`}
          onClick={() => setActiveFilter('')}
          title="Show all medicines"
        >
          <span className="stat-label">Total Medicines</span>
          <div className="stat-val">{alerts.total || 0}</div>
        </div>

        <div
          className={`stat-card warning ${activeFilter === 'low_stock' ? 'selected' : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'low_stock' ? '' : 'low_stock')}
          title="Filter low stock items"
        >
          <span className="stat-label">Low Stock</span>
          <div className="stat-val">{alerts.low_stock || 0}</div>
        </div>

        <div
          className={`stat-card alert-near ${activeFilter === 'near_expiry' ? 'selected' : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'near_expiry' ? '' : 'near_expiry')}
          title="Filter items expiring within 30 days"
        >
          <span className="stat-label">Expiring Soon (30d)</span>
          <div className="stat-val">{alerts.near_expiry || 0}</div>
        </div>

        <div
          className={`stat-card danger ${activeFilter === 'expired' ? 'selected' : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'expired' ? '' : 'expired')}
          title="Filter expired items"
        >
          <span className="stat-label">Expired</span>
          <div className="stat-val">{alerts.expired || 0}</div>
        </div>
      </div>

      {/* Add / Edit Form Panel */}
      {(showAddForm || editingMed) && (
        <form className="panel form-grid" onSubmit={handleSaveMedicine}>
          <h2>{editingMed ? `Edit "${editingMed.name}"` : 'Add new medicine to stock'}</h2>

          <div className="span-2">
            <label htmlFor="m-name">Medicine name & dosage</label>
            <input
              id="m-name"
              placeholder="e.g. Paracetamol 500mg, Amoxicillin 250mg"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="m-qty">Quantity in stock</label>
            <input
              id="m-qty"
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="m-price">Unit price (₹)</label>
            <input
              id="m-price"
              type="number"
              min="0"
              step="0.5"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="m-thresh">Low stock threshold</label>
            <input
              id="m-thresh"
              type="number"
              min="0"
              value={formData.threshold}
              onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="m-exp">Expiry date (optional)</label>
            <input
              id="m-exp"
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : editingMed ? 'Save changes' : 'Add medicine'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setShowAddForm(false);
                setEditingMed(null);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search and Active Filter Chips */}
      <div className="filters-row">
        <div className="filter-group" style={{ flex: '1 1 320px' }}>
          <label htmlFor="med-search">Search medicine name</label>
          <input
            id="med-search"
            type="search"
            placeholder="Search by name (e.g. Paracetamol, Metformin)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {activeFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              Showing: <strong>{activeFilter.replace('_', ' ')}</strong>
            </span>
            <button className="btn ghost small" onClick={() => setActiveFilter('')}>
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Medicines Table */}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Expiry Date</th>
              <th>Status Alerts</th>
              {isPharmacist && <th><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => {
              const isOut = m.quantity === 0;

              return (
                <tr key={m.medicine_id}>
                  <td>
                    <strong>{m.name}</strong>
                  </td>
                  <td>
                    <strong style={{ color: isOut ? 'var(--danger)' : m.is_low_stock ? '#b45309' : 'inherit' }}>
                      {m.quantity}
                    </strong>
                    <span className="muted" style={{ fontSize: '0.8rem', marginLeft: '6px' }}>
                      (threshold: {m.threshold})
                    </span>
                  </td>
                  <td>₹{m.price.toFixed(2)}</td>
                  <td>
                    {m.expiry_date ? (
                      <span style={{ color: m.is_expired ? 'var(--danger)' : m.is_near_expiry ? '#c2410c' : 'inherit' }}>
                        {formatDate(m.expiry_date)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {m.is_expired && <span className="tag expired">Expired</span>}
                      {!m.is_expired && m.is_near_expiry && (
                        <span className="tag near-expiry">Near Expiry (&le;30d)</span>
                      )}
                      {isOut ? (
                        <span className="tag expired">Out of stock</span>
                      ) : (
                        m.is_low_stock && <span className="tag low-stock">Low Stock</span>
                      )}
                      {!m.is_expired && !m.is_near_expiry && !m.is_low_stock && !isOut && (
                        <span className="tag in-stock">In Stock</span>
                      )}
                    </div>
                  </td>
                  {isPharmacist && (
                    <td className="right">
                      <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn ghost small"
                          onClick={() => handleStartEdit(m)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost small"
                          onClick={() => handleDeleteMedicine(m)}
                          style={{ color: 'var(--danger)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {!loading && medicines.length === 0 && (
              <tr>
                <td colSpan={isPharmacist ? 6 : 5} className="empty">
                  {search || activeFilter
                    ? 'No medicines match the selected filter or search term.'
                    : 'No medicines in inventory yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
