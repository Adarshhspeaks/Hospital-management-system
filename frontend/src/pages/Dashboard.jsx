import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { patientCode, formatDate, billCode, formatCurrency } from '../format.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    setLoading(true);
    api('/reports/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">{greeting}, {user.name}</h1>
          <p className="lede">
            {user.role === 'admin' && 'Hospital overview, real-time activity, and performance indicators.'}
            {user.role === 'receptionist' && 'Today\'s appointments, patient registrations, and billing status.'}
            {user.role === 'doctor' && 'Your schedule for today, upcoming consultations, and patient visits.'}
            {user.role === 'pharmacist' && 'Prescriptions queue, medicine stock alerts, and dispensing status.'}
          </p>
        </div>

        {user.role === 'admin' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/reports" className="btn primary">
              📊 View Reports
            </Link>
          </div>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="center-note">Loading dashboard metrics…</p>}

      {!loading && data && (
        <>
          {/* ======================================================== */}
          {/* ADMIN DASHBOARD                                          */}
          {/* ======================================================== */}
          {user.role === 'admin' && (
            <div style={{ display: 'grid', gap: '28px', marginTop: '24px' }}>
              {/* Top KPI Cards Grid */}
              <div className="stats-grid" style={{ margin: 0 }}>
                <Link to="/patients" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Total Patients</div>
                  <div className="stat-val">{data.counts.patients}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Registered records →</small>
                </Link>

                <Link to="/doctors" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Doctors</div>
                  <div className="stat-val">{data.counts.doctors}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Active profiles →</small>
                </Link>

                <Link to="/staff" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Staff Members</div>
                  <div className="stat-val">{data.counts.staff}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Active accounts →</small>
                </Link>

                <Link to="/appointments" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Today's Appointments</div>
                  <div className="stat-val">{data.today.appointments_total}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
                    {data.today.scheduled} scheduled, {data.today.completed} done →
                  </small>
                </Link>

                <Link to="/billing" className="stat-card ok" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Today's Revenue</div>
                  <div className="stat-val" style={{ color: 'var(--ok)' }}>{formatCurrency(data.today.revenue)}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Paid today →</small>
                </Link>
              </div>

              {/* Financial & Revenue Highlights */}
              <div className="panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Financial Overview</h2>
                  <Link to="/reports" style={{ fontSize: '0.88rem', fontWeight: 600 }}>Detailed revenue report →</Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  <div style={{ background: 'var(--paper)', padding: '16px 20px', borderRadius: 'var(--radius)' }}>
                    <div className="muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', fontWeight: 600 }}>
                      Total Hospital Revenue
                    </div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-dark)', marginTop: '4px' }}>
                      {formatCurrency(data.financial.total_revenue)}
                    </div>
                    <small className="muted">All-time collected payments</small>
                  </div>

                  <div style={{ background: 'var(--paper)', padding: '16px 20px', borderRadius: 'var(--radius)' }}>
                    <div className="muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', fontWeight: 600 }}>
                      Pending Receivables
                    </div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: data.financial.pending_bills_count > 0 ? 'var(--danger)' : 'var(--ok)', marginTop: '4px' }}>
                      {formatCurrency(data.financial.pending_bills_amount)}
                    </div>
                    <small className="muted">
                      {data.financial.pending_bills_count} pending bill(s) awaiting payment
                    </small>
                  </div>

                  <div style={{ background: 'var(--paper)', padding: '16px 20px', borderRadius: 'var(--radius)' }}>
                    <div className="muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', fontWeight: 600 }}>
                      Pharmacy Stock Health
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline', marginTop: '6px' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: data.pharmacy.low_stock > 0 ? '#d97706' : 'var(--ok)' }}>
                        {data.pharmacy.low_stock} Low
                      </span>
                      <span style={{ color: 'var(--muted)' }}>•</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: data.pharmacy.out_of_stock > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                        {data.pharmacy.out_of_stock} Empty
                      </span>
                    </div>
                    <Link to="/pharmacy" style={{ fontSize: '0.82rem', display: 'block', marginTop: '4px' }}>
                      Manage inventory stock →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Side-by-side Activity: Recent Appointments & Recent Bills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Recent Appointments */}
                <div className="panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Recent Appointments</h2>
                    <Link to="/appointments" style={{ fontSize: '0.85rem' }}>View all →</Link>
                  </div>

                  <table style={{ width: '100%', fontSize: '0.88rem' }}>
                    <tbody>
                      {data.recent_appointments.map((a) => (
                        <tr key={a.appointment_id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '8px 0' }}>
                            <strong>{a.patient_name}</strong>
                            <div className="muted"><small>Dr. {a.doctor_name} ({a.doctor_specialization})</small></div>
                          </td>
                          <td style={{ padding: '8px 4px', color: 'var(--muted)', textAlign: 'right' }}>
                            {formatDate(a.date)}<br />
                            <small>{a.time_slot}</small>
                          </td>
                          <td style={{ padding: '8px 0 8px 12px', textAlign: 'right' }}>
                            <span className={`tag ${a.status.toLowerCase().replace(/[^a-z]/g, '')}`} style={{ fontSize: '0.78rem' }}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.recent_appointments.length === 0 && (
                        <tr><td colSpan={3} className="empty">No recent appointments.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Recent Invoices */}
                <div className="panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Recent Invoices</h2>
                    <Link to="/billing" style={{ fontSize: '0.85rem' }}>Manage billing →</Link>
                  </div>

                  <table style={{ width: '100%', fontSize: '0.88rem' }}>
                    <tbody>
                      {data.recent_bills.map((b) => (
                        <tr key={b.bill_id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '8px 0' }}>
                            <strong>{billCode(b.bill_id)}</strong>
                            <div className="muted"><small>{b.patient_name}</small></div>
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                            <strong>{formatCurrency(b.total)}</strong>
                            <div className="muted"><small>{b.payment_mode ? b.payment_mode.toUpperCase() : '—'}</small></div>
                          </td>
                          <td style={{ padding: '8px 0 8px 12px', textAlign: 'right' }}>
                            <span className={`tag ${b.status === 'Paid' ? 'completed' : 'cancelled'}`} style={{ fontSize: '0.78rem' }}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.recent_bills.length === 0 && (
                        <tr><td colSpan={3} className="empty">No invoices generated yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Actions Shortcuts */}
              <div className="panel" style={{ padding: '20px 24px' }}>
                <h2 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Quick Navigation</h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link to="/patients" className="btn ghost small">+ Register Patient</Link>
                  <Link to="/appointments" className="btn ghost small">📅 Book Appointment</Link>
                  <Link to="/billing" className="btn ghost small">💳 Generate Invoice</Link>
                  <Link to="/staff" className="btn ghost small">👥 Manage Staff</Link>
                  <Link to="/pharmacy" className="btn ghost small">💊 Check Stock</Link>
                  <Link to="/reports" className="btn primary small">📊 Reports & Analytics</Link>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* RECEPTIONIST DASHBOARD                                   */}
          {/* ======================================================== */}
          {user.role === 'receptionist' && (
            <div style={{ display: 'grid', gap: '24px', marginTop: '24px' }}>
              <div className="stats-grid" style={{ margin: 0 }}>
                <Link to="/appointments" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Today's Appointments</div>
                  <div className="stat-val">{data.today.appointments_total}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
                    {data.today.scheduled} waiting, {data.today.completed} completed →
                  </small>
                </Link>

                <Link to="/patients" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Registered Patients</div>
                  <div className="stat-val">{data.total_patients}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Search & register →</small>
                </Link>

                <Link to="/billing" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Pending Invoices</div>
                  <div className="stat-val" style={{ color: data.pending_bills_count > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                    {data.pending_bills_count}
                  </div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
                    {formatCurrency(data.pending_bills_amount)} unpaid →
                  </small>
                </Link>

                <Link to="/billing" className="stat-card ok" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Ready for Billing</div>
                  <div className="stat-val" style={{ color: 'var(--accent-dark)' }}>{data.unbilled_completed_count}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Completed consultations →</small>
                </Link>
              </div>

              <div className="panel" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>Reception Quick Actions</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Link to="/appointments" className="btn primary">
                    📅 Schedule New Appointment
                  </Link>
                  <Link to="/patients" className="btn ghost">
                    👤 Register New Patient
                  </Link>
                  <Link to="/billing" className="btn ghost">
                    💳 Generate Invoice
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* DOCTOR DASHBOARD                                         */}
          {/* ======================================================== */}
          {user.role === 'doctor' && (
            <div style={{ display: 'grid', gap: '24px', marginTop: '24px' }}>
              <div className="stats-grid" style={{ margin: 0 }}>
                <Link to="/appointments" className="stat-card" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Consultations Today</div>
                  <div className="stat-val">{data.today.appointments_total}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
                    {data.today.scheduled} waiting, {data.today.completed} seen →
                  </small>
                </Link>

                <div className="stat-card ok">
                  <div className="stat-label">Total Patients Treated</div>
                  <div className="stat-val" style={{ color: 'var(--ok)' }}>{data.total_patients_seen}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Completed visits</small>
                </div>
              </div>

              <div className="panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Your Upcoming Scheduled Consultations</h2>
                  <Link to="/appointments" style={{ fontSize: '0.88rem' }}>Full schedule →</Link>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Patient Name</th>
                        <th>Contact</th>
                        <th><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming_appointments && data.upcoming_appointments.map((a) => (
                        <tr key={a.appointment_id}>
                          <td><strong>{formatDate(a.date)}</strong></td>
                          <td>{a.time_slot}</td>
                          <td>
                            <Link to={`/patients/${a.patient_id}`}>
                              {a.patient_name} <span className="muted">({patientCode(a.patient_id)})</span>
                            </Link>
                          </td>
                          <td>{a.patient_phone || '—'}</td>
                          <td className="right">
                            <Link to="/appointments" className="btn primary small">
                              Consult
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {(!data.upcoming_appointments || data.upcoming_appointments.length === 0) && (
                        <tr>
                          <td colSpan={5} className="empty">
                            No upcoming scheduled appointments. Enjoy your day!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PHARMACIST DASHBOARD                                     */}
          {/* ======================================================== */}
          {user.role === 'pharmacist' && (
            <div style={{ display: 'grid', gap: '24px', marginTop: '24px' }}>
              <div className="stats-grid" style={{ margin: 0 }}>
                <Link to="/prescriptions" className="stat-card alert-near" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Pending Prescriptions</div>
                  <div className="stat-val" style={{ color: data.prescriptions.pending > 0 ? '#c2410c' : 'var(--ok)' }}>
                    {data.prescriptions.pending}
                  </div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Awaiting dispensing →</small>
                </Link>

                <div className="stat-card ok">
                  <div className="stat-label">Total Dispensed</div>
                  <div className="stat-val" style={{ color: 'var(--ok)' }}>{data.prescriptions.dispensed}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Completed prescriptions</small>
                </div>

                <Link to="/pharmacy" className="stat-card warning" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Low Stock Items</div>
                  <div className="stat-val" style={{ color: '#d97706' }}>{data.inventory.low_stock}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>At or below threshold →</small>
                </Link>

                <Link to="/pharmacy" className="stat-card danger" style={{ textDecoration: 'none' }}>
                  <div className="stat-label">Out of Stock</div>
                  <div className="stat-val" style={{ color: 'var(--danger)' }}>{data.inventory.out_of_stock}</div>
                  <small className="muted" style={{ display: 'block', marginTop: '4px' }}>Zero quantity →</small>
                </Link>
              </div>

              <div className="panel" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>Pharmacy Quick Actions</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Link to="/prescriptions" className="btn primary">
                    📋 Open Prescriptions Queue
                  </Link>
                  <Link to="/pharmacy" className="btn ghost">
                    💊 Update Medicine Stock
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
