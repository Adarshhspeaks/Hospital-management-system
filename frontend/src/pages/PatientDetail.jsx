import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { patientCode, formatDate, billCode, formatCurrency } from '../format.js';
import PatientForm from '../components/PatientForm.jsx';

export default function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Medical Record modal for doctors (FR-5.4)
  const [activeRecord, setActiveRecord] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);

  // Billing history state (FR-6.3)
  const [bills, setBills] = useState([]);
  const [viewInvoice, setViewInvoice] = useState(null);

  const load = () =>
    api(`/patients/${id}`).then(setData).catch((e) => setError(e.message));

  const loadBills = () =>
    api(`/bills/patient/${id}`).then(setBills).catch(() => {});

  useEffect(() => {
    load();
    loadBills();
  }, [id]);

  async function save(form) {
    await api(`/patients/${id}`, { method: 'PUT', body: form });
    setEditing(false);
    setSaved(true);
    load();
  }

  function viewFullRecord(appointmentId) {
    setRecordLoading(true);
    setActiveRecord(null);
    api(`/records/appointment/${appointmentId}`)
      .then((rec) => setActiveRecord(rec))
      .catch((err) => setError(err.message))
      .finally(() => setRecordLoading(false));
  }

  if (error) return <><p className="error" role="alert">{error}</p><Link to="/patients">Back to patients</Link></>;
  if (!data) return <p className="center-note">Loading…</p>;

  const { patient: p, visits } = data;
  const canSeeDiagnosis = user.role === 'doctor';

  return (
    <>
      <p><Link to="/patients">← All patients</Link></p>

      <div className="title-row">
        <h1 className="page-title">{p.name} <span className="code">{patientCode(p.patient_id)}</span></h1>
        {user.role === 'receptionist' && !editing && (
          <button className="btn ghost" onClick={() => { setEditing(true); setSaved(false); }}>Edit details</button>
        )}
      </div>

      {saved && <p className="success" role="status">Details updated.</p>}

      {editing ? (
        <PatientForm
          initial={{
            name: p.name, age: p.age, gender: p.gender, phone: p.phone,
            bloodGroup: p.blood_group || '', address: p.address || '',
          }}
          submitLabel="Save changes"
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <dl className="panel details">
          <div><dt>Age</dt><dd>{p.age}</dd></div>
          <div><dt>Gender</dt><dd>{p.gender}</dd></div>
          <div><dt>Phone</dt><dd>{p.phone}</dd></div>
          <div><dt>Blood group</dt><dd>{p.blood_group || 'Not known'}</dd></div>
          <div className="span-all"><dt>Address</dt><dd>{p.address || 'Not given'}</dd></div>
          <div><dt>Registered</dt><dd>{formatDate(p.created_at)}</dd></div>
        </dl>
      )}

      {/* Doctor-only Medical Record Details Modal */}
      {canSeeDiagnosis && activeRecord && (
        <div className="modal-overlay" onClick={() => setActiveRecord(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Medical Record Details</h2>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setActiveRecord(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '0.92rem' }}>
              <p><strong>Date & Time:</strong> {formatDate(activeRecord.date)} at {activeRecord.time_slot}</p>
              <p><strong>Attending Doctor:</strong> {activeRecord.doctor_name} ({activeRecord.specialization})</p>
              <p><strong>Diagnosis:</strong> {activeRecord.diagnosis}</p>
              {activeRecord.symptoms && <p><strong>Symptoms:</strong> {activeRecord.symptoms}</p>}
              {activeRecord.notes && <p><strong>Clinical Notes:</strong> {activeRecord.notes}</p>}
            </div>

            {activeRecord.prescription?.items?.length > 0 ? (
              <div>
                <label>Prescribed Medicines</label>
                <table className="record-prescription-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Dosage</th>
                      <th>Duration</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRecord.prescription.items.map((it) => (
                      <tr key={it.item_id}>
                        <td>{it.medicine_name}</td>
                        <td>{it.dosage}</td>
                        <td>{it.duration}</td>
                        <td>{it.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.88rem' }}>No medicines prescribed.</p>
            )}

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setActiveRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="section-title">Visit history</h2>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Time</th><th>Doctor</th><th>Status</th>
              {canSeeDiagnosis && <th>Diagnosis</th>}
              {canSeeDiagnosis && <th><span className="sr-only">Details</span></th>}
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.appointment_id}>
                <td>{formatDate(v.date)}</td>
                <td>{v.time_slot}</td>
                <td>{v.doctor_name} <span className="muted">({v.specialization})</span></td>
                <td>{v.status}</td>
                {canSeeDiagnosis && <td>{v.diagnosis || '—'}</td>}
                {canSeeDiagnosis && (
                  <td className="right">
                    {v.diagnosis && (
                      <button
                        className="btn ghost small"
                        onClick={() => viewFullRecord(v.appointment_id)}
                      >
                        Details
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {visits.length === 0 && (
              <tr>
                <td colSpan={canSeeDiagnosis ? 6 : 4} className="empty">
                  No visits yet. Appointments will appear here once they are booked.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Patient Billing & Payment History (FR-6.3) */}
      <h2 className="section-title" style={{ marginTop: '36px' }}>Billing & Payment history</h2>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Doctor</th>
              <th>Breakdown</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Status</th>
              <th>Mode</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const isPaid = b.status === 'Paid';
              return (
                <tr key={b.bill_id}>
                  <td><strong>{billCode(b.bill_id)}</strong></td>
                  <td>{formatDate(b.date)}</td>
                  <td>
                    {b.doctor_name ? (
                      <>
                        Dr. {b.doctor_name}
                        <div className="muted"><small>{b.doctor_specialization}</small></div>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <div>Dr: {formatCurrency(b.consultation_fee)}</div>
                    <div>Meds: {formatCurrency(b.medicine_charges)}</div>
                    {b.other_charges > 0 && <div>Other: {formatCurrency(b.other_charges)}</div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1rem', color: isPaid ? 'var(--ok)' : 'var(--danger)' }}>
                      {formatCurrency(b.total)}
                    </strong>
                  </td>
                  <td>
                    <span className={`tag ${isPaid ? 'completed' : 'cancelled'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    {b.payment_mode ? (
                      <span style={{ textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 600 }}>
                        {b.payment_mode}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right">
                    <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => {
                          api(`/bills/${b.bill_id}`).then(setViewInvoice);
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => {
                          downloadFile(`/bills/${b.bill_id}/pdf`, `Invoice-B${String(b.bill_id).padStart(4, '0')}.pdf`);
                        }}
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {bills.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  No billing history recorded for this patient.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Modal */}
      {viewInvoice && (
        <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
          <div className="modal-card large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h2>Invoice {billCode(viewInvoice.bill_id)}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => window.print()}
                >
                  🖨️ Print
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    downloadFile(`/bills/${viewInvoice.bill_id}/pdf`, `Invoice-B${String(viewInvoice.bill_id).padStart(4, '0')}.pdf`);
                  }}
                >
                  ⬇ PDF
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setViewInvoice(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="invoice-card" style={{ border: 'none', padding: '16px 0', width: '100%' }}>
              <div className="invoice-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="brand-mark" aria-hidden="true" />
                    <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>City Hospital</span>
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    123 Healthcare Boulevard, Medical District<br />
                    Phone: +91 11 2345 6789 • Email: billing@cityhospital.org
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)' }}>
                    {billCode(viewInvoice.bill_id)}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: '2px' }}>
                    Date: <strong>{formatDate(viewInvoice.date)}</strong>
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <span className={`tag ${viewInvoice.status === 'Paid' ? 'completed' : 'cancelled'}`}>
                      {viewInvoice.status.toUpperCase()} {viewInvoice.payment_mode ? `(${viewInvoice.payment_mode.toUpperCase()})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="invoice-meta-grid">
                <div style={{ background: 'var(--paper)', padding: '12px 14px', borderRadius: 'var(--radius)' }}>
                  <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Billed To</div>
                  <strong>{viewInvoice.patient_name}</strong> ({patientCode(viewInvoice.patient_id)})<br />
                  <span className="muted" style={{ fontSize: '0.88rem' }}>
                    Age: {viewInvoice.patient_age} ({viewInvoice.patient_gender})<br />
                    Phone: {viewInvoice.patient_phone || 'N/A'}<br />
                    {viewInvoice.patient_address && `Address: ${viewInvoice.patient_address}`}
                  </span>
                </div>

                <div style={{ background: 'var(--paper)', padding: '12px 14px', borderRadius: 'var(--radius)' }}>
                  <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Consulting Doctor</div>
                  <strong>Dr. {viewInvoice.doctor_name || 'Hospital Staff'}</strong><br />
                  <span className="muted" style={{ fontSize: '0.88rem' }}>
                    Specialization: {viewInvoice.doctor_specialization || 'General'}<br />
                    {viewInvoice.appointment_date && `Visit Date: ${formatDate(viewInvoice.appointment_date)} (${viewInvoice.time_slot})`}
                  </span>
                </div>
              </div>

              <table style={{ width: '100%', marginTop: '16px', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--ink)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 4px' }}>Description</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: '70px' }}>Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', width: '120px' }}>Rate</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', width: '130px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 4px' }}>
                      <strong>Doctor Consultation Fee</strong>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>Dr. {viewInvoice.doctor_name} ({viewInvoice.doctor_specialization})</div>
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'center' }}>1</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(viewInvoice.consultation_fee)}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right' }}><strong>{formatCurrency(viewInvoice.consultation_fee)}</strong></td>
                  </tr>

                  {viewInvoice.prescription_items && viewInvoice.prescription_items.length > 0 && (
                    viewInvoice.prescription_items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <span>Pharmacy: <strong>{it.medicine_name}</strong></span>
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(it.unit_price)}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(it.line_total)}</td>
                      </tr>
                    ))
                  )}

                  {Number(viewInvoice.other_charges) > 0 && (
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 4px' }}>
                        <strong>Other / Hospital Service Charges</strong>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>—</td>
                      <td style={{ padding: '10px 4px', textAlign: 'right' }}>—</td>
                      <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(viewInvoice.other_charges)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="invoice-summary" style={{ marginTop: '20px' }}>
                <span>Total Amount {viewInvoice.status === 'Paid' ? 'Paid' : 'Due'}:</span>
                <span style={{ color: 'var(--accent-dark)' }}>{formatCurrency(viewInvoice.total)}</span>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setViewInvoice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
