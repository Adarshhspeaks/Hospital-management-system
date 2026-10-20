import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { patientCode, formatDate } from '../format.js';

export default function Prescriptions() {
  const { user } = useAuth();
  const isPharmacist = user.role === 'pharmacist';

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'dispensed', ''
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dispensingId, setDispensingId] = useState(null);

  function loadPrescriptions() {
    setLoading(true);
    let url = '/prescriptions?';
    if (statusFilter) url += `status=${statusFilter}&`;
    if (search.trim()) url += `q=${encodeURIComponent(search.trim())}&`;

    api(url)
      .then((data) => {
        setPrescriptions(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPrescriptions();
  }, [statusFilter, search]);

  async function handleDispense(pr) {
    const confirmed = window.confirm(
      `Dispense prescription #RX-${pr.prescription_id} for ${pr.patient_name}?\n\nThis will deduct the prescribed quantities from pharmacy stock.`
    );
    if (!confirmed) return;

    setError('');
    setSuccess('');
    setDispensingId(pr.prescription_id);

    try {
      const res = await api(`/prescriptions/${pr.prescription_id}/dispense`, {
        method: 'POST',
      });
      setSuccess(res.message || `Prescription #RX-${pr.prescription_id} dispensed successfully.`);
      loadPrescriptions();
    } catch (err) {
      setError(err.message);
    } finally {
      setDispensingId(null);
    }
  }

  const pendingCount = prescriptions.filter((p) => !p.dispensed).length;

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">Prescriptions & Dispensing</h1>
          <p className="lede">
            Review prescriptions, verify inventory availability, and dispense medicines to patients.
          </p>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      {/* Status Tabs */}
      <div className="tab-group">
        <button
          className={`tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          Awaiting Dispensing
        </button>
        <button
          className={`tab-btn ${statusFilter === 'dispensed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('dispensed')}
        >
          Dispensed
        </button>
        <button
          className={`tab-btn ${statusFilter === '' ? 'active' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          All Prescriptions
        </button>
      </div>

      {/* Search Bar */}
      <div className="filters-row" style={{ marginTop: '16px' }}>
        <div className="filter-group" style={{ flex: '1 1 320px' }}>
          <label htmlFor="rx-search">Search patient name or phone</label>
          <input
            id="rx-search"
            type="search"
            placeholder="Type patient name or phone number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Prescriptions List */}
      <div style={{ marginTop: '20px' }}>
        {prescriptions.map((pr) => {
          const isPending = !pr.dispensed;
          const hasDeficit = pr.items.some((it) => !it.has_sufficient_stock);

          return (
            <div key={pr.prescription_id} className="prescription-card">
              <div className="prescription-header">
                <div className="prescription-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <strong style={{ fontSize: '1.1rem' }}>#RX-{pr.prescription_id}</strong>
                    <span className={`tag ${pr.dispensed ? 'completed' : 'scheduled'}`}>
                      {pr.dispensed ? 'Dispensed' : 'Awaiting Dispensing'}
                    </span>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    Patient:{' '}
                    <Link to={`/patients/${pr.patient_id}`}>
                      <strong>{pr.patient_name}</strong> ({patientCode(pr.patient_id)})
                    </Link>{' '}
                    | Phone: {pr.patient_phone || '—'} | Age: {pr.patient_age} ({pr.patient_gender})
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Prescribed by <strong>{pr.doctor_name}</strong>
                  </div>
                  <small className="muted">
                    {formatDate(pr.date)} at {pr.time_slot}
                  </small>
                </div>
              </div>

              {/* Items Table */}
              <div className="table-wrap" style={{ marginTop: '12px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Dosage</th>
                      <th>Duration</th>
                      <th>Prescribed Qty</th>
                      <th>Available Stock</th>
                      <th>Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pr.items.map((it) => (
                      <tr key={it.item_id}>
                        <td><strong>{it.medicine_name}</strong></td>
                        <td>{it.dosage || '—'}</td>
                        <td>{it.duration || '—'}</td>
                        <td><strong>{it.prescribed_quantity}</strong></td>
                        <td>{it.available_stock}</td>
                        <td>
                          {it.has_sufficient_stock ? (
                            <span className="stock-ok">✓ In Stock</span>
                          ) : (
                            <span className="stock-deficit">
                              ⚠ Insufficient (Short by {it.prescribed_quantity - it.available_stock})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--line)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  {isPending && hasDeficit && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600 }}>
                      ⚠ Cannot dispense: one or more prescribed medicines lack sufficient stock.
                    </span>
                  )}
                  {isPending && !hasDeficit && (
                    <span className="stock-ok" style={{ fontSize: '0.9rem' }}>
                      ✓ All prescribed items are available in stock.
                    </span>
                  )}
                  {!isPending && (
                    <span className="muted" style={{ fontSize: '0.9rem' }}>
                      Medication was dispensed to the patient.
                    </span>
                  )}
                </div>

                {isPharmacist && isPending && (
                  <button
                    className="btn primary"
                    disabled={!pr.can_dispense || dispensingId === pr.prescription_id}
                    onClick={() => handleDispense(pr)}
                  >
                    {dispensingId === pr.prescription_id ? 'Dispensing…' : 'Dispense Medicines'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && prescriptions.length === 0 && (
          <div className="panel empty">
            {statusFilter === 'pending'
              ? 'No prescriptions awaiting dispensing.'
              : search
              ? 'No prescriptions match your search.'
              : 'No prescriptions found.'}
          </div>
        )}
      </div>
    </>
  );
}
