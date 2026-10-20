import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import { patientCode, formatDate, billCode, formatCurrency } from '../format.js';

function getTodayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getSevenDaysAgoString() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function getStartOfMonthString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export default function Reports() {
  // Tabs: 'appointments', 'revenue', 'doctors'
  const [activeTab, setActiveTab] = useState('appointments');

  // Date Range state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Appointments Report state
  const [apptDoctorFilter, setApptDoctorFilter] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('');
  const [apptsData, setApptsData] = useState(null);
  const [apptsLoading, setApptsLoading] = useState(false);

  // Revenue Report state
  const [revPaymentMode, setRevPaymentMode] = useState('');
  const [revData, setRevData] = useState(null);
  const [revLoading, setRevLoading] = useState(false);

  // Doctor Performance state
  const [docPerfData, setDocPerfData] = useState(null);
  const [docPerfLoading, setDocPerfLoading] = useState(false);

  // Doctors list for dropdown
  const [doctorsList, setDoctorsList] = useState([]);

  // Errors & CSV downloading state
  const [error, setError] = useState('');
  const [csvDownloading, setCsvDownloading] = useState(false);

  // Load Doctors for filtering
  useEffect(() => {
    api('/doctors')
      .then(setDoctorsList)
      .catch(() => {});
  }, []);

  // Preset Date Handlers
  const setPresetToday = () => {
    const today = getTodayString();
    setFromDate(today);
    setToDate(today);
  };

  const setPreset7Days = () => {
    setFromDate(getSevenDaysAgoString());
    setToDate(getTodayString());
  };

  const setPresetMonth = () => {
    setFromDate(getStartOfMonthString());
    setToDate(getTodayString());
  };

  const clearDatePreset = () => {
    setFromDate('');
    setToDate('');
  };

  // Load Appointments Report
  const loadAppointmentsReport = () => {
    setApptsLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (apptDoctorFilter) params.append('doctor_id', apptDoctorFilter);
    if (apptStatusFilter) params.append('status', apptStatusFilter);

    api(`/reports/appointments?${params.toString()}`)
      .then(setApptsData)
      .catch((err) => setError(err.message))
      .finally(() => setApptsLoading(false));
  };

  // Load Revenue Report
  const loadRevenueReport = () => {
    setRevLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (revPaymentMode) params.append('payment_mode', revPaymentMode);

    api(`/reports/revenue?${params.toString()}`)
      .then(setRevData)
      .catch((err) => setError(err.message))
      .finally(() => setRevLoading(false));
  };

  // Load Doctor Performance Report
  const loadDocPerformanceReport = () => {
    setDocPerfLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    api(`/reports/doctor-performance?${params.toString()}`)
      .then(setDocPerfData)
      .catch((err) => setError(err.message))
      .finally(() => setDocPerfLoading(false));
  };

  // Trigger report fetch when tab or date changes
  useEffect(() => {
    if (activeTab === 'appointments') {
      loadAppointmentsReport();
    } else if (activeTab === 'revenue') {
      loadRevenueReport();
    } else if (activeTab === 'doctors') {
      loadDocPerformanceReport();
    }
  }, [activeTab, fromDate, toDate, apptDoctorFilter, apptStatusFilter, revPaymentMode]);

  // Export CSV handler
  async function handleExportCsv() {
    setCsvDownloading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      if (activeTab === 'appointments') {
        if (apptDoctorFilter) params.append('doctor_id', apptDoctorFilter);
        if (apptStatusFilter) params.append('status', apptStatusFilter);
        await downloadFile(`/reports/appointments/csv?${params.toString()}`, `appointments-report-${getTodayString()}.csv`);
      } else if (activeTab === 'revenue') {
        if (revPaymentMode) params.append('payment_mode', revPaymentMode);
        await downloadFile(`/reports/revenue/csv?${params.toString()}`, `revenue-report-${getTodayString()}.csv`);
      }
    } catch (err) {
      setError(`CSV Export Failed: ${err.message}`);
    } finally {
      setCsvDownloading(false);
    }
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">Hospital Reports & Analytics</h1>
          <p className="lede">
            Track patient visit trends, appointment completion rates, pharmacy medicine revenue, and doctor performance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {activeTab !== 'doctors' && (
            <button
              type="button"
              className="btn primary small"
              onClick={handleExportCsv}
              disabled={csvDownloading}
              title="Download report data as CSV spreadsheet"
            >
              {csvDownloading ? 'Exporting…' : '📥 Export CSV'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {/* Tabs */}
      <div className="tab-group" style={{ marginTop: '16px' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          📅 Appointments Analytics
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          💳 Revenue & Financials
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'doctors' ? 'active' : ''}`}
          onClick={() => setActiveTab('doctors')}
        >
          🩺 Doctor Performance
        </button>
      </div>

      {/* Unified Date Range Filter Bar */}
      <div className="filters-row" style={{ marginTop: '20px' }}>
        <div className="filter-group">
          <label htmlFor="report-from-date">From Date</label>
          <input
            id="report-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="report-to-date">To Date</label>
          <input
            id="report-to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* Date presets */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
          <button type="button" className="btn ghost small" onClick={setPresetToday}>
            Today
          </button>
          <button type="button" className="btn ghost small" onClick={setPreset7Days}>
            Last 7 Days
          </button>
          <button type="button" className="btn ghost small" onClick={setPresetMonth}>
            This Month
          </button>
          {(fromDate || toDate) && (
            <button type="button" className="btn ghost small" onClick={clearDatePreset}>
              All Time
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: APPOINTMENTS ANALYTICS (FR-8.2)                   */}
      {/* ======================================================== */}
      {activeTab === 'appointments' && (
        <>
          {/* Sub-filters */}
          <div className="filters-row" style={{ marginTop: '12px' }}>
            <div className="filter-group">
              <label htmlFor="appt-doctor-select">Filter by Doctor</label>
              <select
                id="appt-doctor-select"
                value={apptDoctorFilter}
                onChange={(e) => setApptDoctorFilter(e.target.value)}
              >
                <option value="">All Doctors</option>
                {doctorsList.map((doc) => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    {doc.name} ({doc.specialization})
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="appt-status-select">Filter by Status</label>
              <select
                id="appt-status-select"
                value={apptStatusFilter}
                onChange={(e) => setApptStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-show">No-show</option>
              </select>
            </div>
          </div>

          {apptsLoading && <p className="center-note">Generating appointments report…</p>}

          {!apptsLoading && apptsData && (
            <div style={{ display: 'grid', gap: '24px', marginTop: '20px' }}>
              {/* Summary Metric Cards */}
              <div className="stats-grid" style={{ margin: 0 }}>
                <div className="stat-card">
                  <div className="stat-label">Total Appointments</div>
                  <div className="stat-val">{apptsData.summary.total}</div>
                  <small className="muted">In selected period</small>
                </div>

                <div className="stat-card ok">
                  <div className="stat-label">Completed Visits</div>
                  <div className="stat-val" style={{ color: 'var(--ok)' }}>{apptsData.summary.completed}</div>
                  <small className="muted">{apptsData.summary.completion_rate}% completion rate</small>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Scheduled / Pending</div>
                  <div className="stat-val">{apptsData.summary.scheduled}</div>
                  <small className="muted">Awaiting consultation</small>
                </div>

                <div className="stat-card warning">
                  <div className="stat-label">Cancelled Visits</div>
                  <div className="stat-val" style={{ color: '#d97706' }}>{apptsData.summary.cancelled}</div>
                  <small className="muted">{apptsData.summary.cancellation_rate}% cancellation rate</small>
                </div>

                <div className="stat-card danger">
                  <div className="stat-label">No-Shows</div>
                  <div className="stat-val" style={{ color: 'var(--danger)' }}>{apptsData.summary.no_show}</div>
                  <small className="muted">Patient missed slot</small>
                </div>
              </div>

              {/* By Doctor Breakdown Table */}
              <div className="panel">
                <h2 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>Appointments by Doctor</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Specialization</th>
                        <th>Total</th>
                        <th>Completed</th>
                        <th>Scheduled</th>
                        <th>Cancelled</th>
                        <th>No-Show</th>
                        <th style={{ textAlign: 'right' }}>Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apptsData.by_doctor.map((d) => {
                        const rate = d.total > 0 ? ((d.completed / d.total) * 100).toFixed(1) : 0;
                        return (
                          <tr key={d.doctor_id}>
                            <td><strong>Dr. {d.doctor_name}</strong></td>
                            <td className="muted">{d.specialization}</td>
                            <td><strong>{d.total}</strong></td>
                            <td style={{ color: 'var(--ok)', fontWeight: 600 }}>{d.completed}</td>
                            <td>{d.scheduled}</td>
                            <td style={{ color: '#d97706' }}>{d.cancelled}</td>
                            <td style={{ color: 'var(--danger)' }}>{d.no_show}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{rate}%</td>
                          </tr>
                        );
                      })}
                      {apptsData.by_doctor.length === 0 && (
                        <tr><td colSpan={8} className="empty">No doctors found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Appointments Table */}
              <div className="panel">
                <h2 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>
                  Detailed Appointments Log ({apptsData.appointments.length} records)
                </h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date & Time</th>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apptsData.appointments.map((a) => (
                        <tr key={a.appointment_id}>
                          <td>#{a.appointment_id}</td>
                          <td>
                            <strong>{formatDate(a.date)}</strong> at {a.time_slot}
                          </td>
                          <td>
                            <Link to={`/patients/${a.patient_id}`}>
                              {a.patient_name} <span className="muted">({patientCode(a.patient_id)})</span>
                            </Link>
                          </td>
                          <td>Dr. {a.doctor_name} ({a.specialization})</td>
                          <td>
                            <span className={`tag ${a.status.toLowerCase().replace(/[^a-z]/g, '')}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {apptsData.appointments.length === 0 && (
                        <tr><td colSpan={5} className="empty">No appointments found matching your filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB 2: REVENUE & FINANCIALS (FR-8.3)                     */}
      {/* ======================================================== */}
      {activeTab === 'revenue' && (
        <>
          {/* Sub-filters */}
          <div className="filters-row" style={{ marginTop: '12px' }}>
            <div className="filter-group">
              <label htmlFor="rev-mode-select">Filter by Payment Mode</label>
              <select
                id="rev-mode-select"
                value={revPaymentMode}
                onChange={(e) => setRevPaymentMode(e.target.value)}
              >
                <option value="">All Payment Modes</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
              </select>
            </div>
          </div>

          {revLoading && <p className="center-note">Generating financial report…</p>}

          {!revLoading && revData && (
            <div style={{ display: 'grid', gap: '24px', marginTop: '20px' }}>
              {/* Financial Summary Cards */}
              <div className="stats-grid" style={{ margin: 0 }}>
                <div className="stat-card ok">
                  <div className="stat-label">Total Revenue Collected</div>
                  <div className="stat-val" style={{ color: 'var(--ok)' }}>
                    {formatCurrency(revData.summary.total_revenue)}
                  </div>
                  <small className="muted">{revData.summary.paid_count} paid invoices</small>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Doctor Consultation Fees</div>
                  <div className="stat-val">{formatCurrency(revData.summary.consultation_total)}</div>
                  <small className="muted">Medical visits</small>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Pharmacy Medicines</div>
                  <div className="stat-val">{formatCurrency(revData.summary.medicine_total)}</div>
                  <small className="muted">Dispensed prescriptions</small>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Hospital Service Charges</div>
                  <div className="stat-val">{formatCurrency(revData.summary.other_total)}</div>
                  <small className="muted">Other fees</small>
                </div>

                <div className="stat-card danger">
                  <div className="stat-label">Pending Receivables</div>
                  <div className="stat-val" style={{ color: revData.summary.pending_amount > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                    {formatCurrency(revData.summary.pending_amount)}
                  </div>
                  <small className="muted">{revData.summary.pending_count} unpaid bills</small>
                </div>
              </div>

              {/* Payment Mode Distribution Panel */}
              <div className="panel" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>Collection by Payment Mode</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {revData.by_payment_mode.map((m) => (
                    <div key={m.payment_mode} style={{ background: 'var(--paper)', padding: '16px 20px', borderRadius: 'var(--radius)' }}>
                      <div className="muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', fontWeight: 700 }}>
                        {m.payment_mode}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-dark)', marginTop: '4px' }}>
                        {formatCurrency(m.amount)}
                      </div>
                      <small className="muted">{m.count} transaction(s)</small>
                    </div>
                  ))}
                  {revData.by_payment_mode.length === 0 && (
                    <p className="muted">No payments recorded in this period.</p>
                  )}
                </div>
              </div>

              {/* Invoices List Table */}
              <div className="panel">
                <h2 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>
                  Itemized Bills & Invoices ({revData.bills.length} records)
                </h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Consultation</th>
                        <th>Pharmacy</th>
                        <th>Other</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th>Status</th>
                        <th>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revData.bills.map((b) => (
                        <tr key={b.bill_id}>
                          <td><strong>{billCode(b.bill_id)}</strong></td>
                          <td>{formatDate(b.date)}</td>
                          <td>
                            <Link to={`/patients/${b.patient_id}`}>
                              {b.patient_name} <span className="muted">({patientCode(b.patient_id)})</span>
                            </Link>
                          </td>
                          <td>{b.doctor_name ? `Dr. ${b.doctor_name}` : '—'}</td>
                          <td>{formatCurrency(b.consultation_fee)}</td>
                          <td>{formatCurrency(b.medicine_charges)}</td>
                          <td>{formatCurrency(b.other_charges)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(b.total)}
                          </td>
                          <td>
                            <span className={`tag ${b.status === 'Paid' ? 'completed' : 'cancelled'}`}>
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
                        </tr>
                      ))}
                      {revData.bills.length === 0 && (
                        <tr><td colSpan={10} className="empty">No invoices found for this range.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB 3: DOCTOR PERFORMANCE                                */}
      {/* ======================================================== */}
      {activeTab === 'doctors' && (
        <>
          {docPerfLoading && <p className="center-note">Analyzing doctor performance…</p>}

          {!docPerfLoading && docPerfData && (
            <div className="panel" style={{ marginTop: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Doctor Clinical & Financial Output</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Doctor</th>
                      <th>Specialization</th>
                      <th>Consultation Fee</th>
                      <th>Total Bookings</th>
                      <th>Completed Consultations</th>
                      <th>Cancellations</th>
                      <th>No-Shows</th>
                      <th>Completion %</th>
                      <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docPerfData.map((d) => (
                      <tr key={d.doctor_id}>
                        <td><strong>Dr. {d.doctor_name}</strong></td>
                        <td className="muted">{d.specialization}</td>
                        <td>{formatCurrency(d.doctor_fee)}</td>
                        <td><strong>{d.total_appointments}</strong></td>
                        <td style={{ color: 'var(--ok)', fontWeight: 700 }}>{d.completed}</td>
                        <td style={{ color: '#d97706' }}>{d.cancelled}</td>
                        <td style={{ color: 'var(--danger)' }}>{d.no_show}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: d.completion_rate >= 80 ? 'var(--ok)' : 'inherit' }}>
                            {d.completion_rate}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-dark)' }}>
                          {formatCurrency(d.revenue_generated)}
                        </td>
                      </tr>
                    ))}
                    {docPerfData.length === 0 && (
                      <tr><td colSpan={9} className="empty">No doctors recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
