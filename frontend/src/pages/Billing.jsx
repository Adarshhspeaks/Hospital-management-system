import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { patientCode, formatDate, billCode, formatCurrency } from '../format.js';

export default function Billing() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedApptId = searchParams.get('appointment_id');

  // Navigation tabs: 'list' or 'generate'
  const [activeTab, setActiveTab] = useState(preselectedApptId ? 'generate' : 'list');

  // Bills list state
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Unbilled appointments & Generator state
  const [unbilledList, setUnbilledList] = useState([]);
  const [unbilledLoading, setUnbilledLoading] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState(preselectedApptId || '');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [otherCharges, setOtherCharges] = useState(0);
  const [billStatus, setBillStatus] = useState('Paid');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [generating, setGenerating] = useState(false);

  // Mark Paid Modal state
  const [payingBill, setPayingBill] = useState(null);
  const [payMode, setPayMode] = useState('cash');
  const [paySaving, setPaySaving] = useState(false);

  // View Invoice Modal state
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);

  // Global alert messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load Bills
  const loadBills = async () => {
    setBillsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (dateFilter) params.append('date', dateFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      const data = await api(`/bills?${params.toString()}`);
      setBills(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBillsLoading(false);
    }
  };

  // Load Unbilled Appointments
  const loadUnbilled = async () => {
    setUnbilledLoading(true);
    try {
      const data = await api('/bills/unbilled');
      setUnbilledList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUnbilledLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
    loadUnbilled();
  }, [statusFilter, dateFilter]);

  // Handle URL preselection
  useEffect(() => {
    if (preselectedApptId) {
      setSelectedApptId(preselectedApptId);
      setActiveTab('generate');
      fetchPreview(preselectedApptId);
    }
  }, [preselectedApptId]);

  // Fetch bill preview when appointment selected
  async function fetchPreview(apptId) {
    if (!apptId) {
      setPreviewData(null);
      return;
    }
    setPreviewLoading(true);
    setError('');
    try {
      const preview = await api(`/bills/preview/${apptId}`);
      setPreviewData(preview);
    } catch (err) {
      setError(err.message);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleSelectAppointment(e) {
    const apptId = e.target.value;
    setSelectedApptId(apptId);
    if (apptId) {
      fetchPreview(apptId);
    } else {
      setPreviewData(null);
    }
  }

  // Generate Bill
  async function handleGenerateBill(e) {
    e.preventDefault();
    if (!selectedApptId) return;

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        appointment_id: Number(selectedApptId),
        other_charges: Number(otherCharges || 0),
        status: billStatus,
        payment_mode: billStatus === 'Paid' ? paymentMode : null,
      };

      const created = await api('/bills', {
        method: 'POST',
        body: payload,
      });

      setSuccess(`Invoice ${billCode(created.bill_id)} generated successfully! Total: ${formatCurrency(created.total)}`);
      setSelectedApptId('');
      setPreviewData(null);
      setOtherCharges(0);
      setSearchParams({});
      loadBills();
      loadUnbilled();
      setActiveTab('list');

      // Automatically open view modal for immediate printing/viewing
      openViewInvoice(created.bill_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  // Mark Pending Bill as Paid
  async function handleConfirmPay(e) {
    e.preventDefault();
    if (!payingBill) return;

    setPaySaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await api(`/bills/${payingBill.bill_id}/pay`, {
        method: 'PATCH',
        body: { payment_mode: payMode },
      });

      setSuccess(`Invoice ${billCode(updated.bill_id)} marked as Paid via ${payMode.toUpperCase()}.`);
      setPayingBill(null);
      loadBills();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaySaving(false);
    }
  }

  // Open Detailed Invoice Modal
  async function openViewInvoice(billId) {
    setViewInvoiceLoading(true);
    setViewInvoice(null);
    try {
      const full = await api(`/bills/${billId}`);
      setViewInvoice(full);
    } catch (err) {
      setError(err.message);
    } finally {
      setViewInvoiceLoading(false);
    }
  }

  // Download PDF invoice
  async function handleDownloadPdf(billId) {
    try {
      await downloadFile(`/bills/${billId}/pdf`, `Invoice-B${String(billId).padStart(4, '0')}.pdf`);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  }

  // Calculate dynamic live total in Generator
  const consultationFee = previewData ? Number(previewData.consultation_fee || 0) : 0;
  const medicineCharges = previewData ? Number(previewData.medicine_charges || 0) : 0;
  const otherChargesNum = Number(otherCharges || 0);
  const liveTotal = consultationFee + medicineCharges + otherChargesNum;

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">Billing & Invoices</h1>
          <p className="lede">
            Generate itemized patient invoices, review medicine pharmacy charges, and manage payments.
          </p>
        </div>

        <div className="tab-group" style={{ margin: 0 }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            All Invoices ({bills.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('generate');
              loadUnbilled();
            }}
          >
            + Generate Invoice {unbilledList.length > 0 && `(${unbilledList.length} ready)`}
          </button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      {/* --- TAB 1: GENERATE INVOICE --- */}
      {activeTab === 'generate' && (
        <div className="panel" style={{ marginTop: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Generate Patient Invoice</h2>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="unbilled-select">1. Select Appointment to Bill</label>
            {unbilledLoading ? (
              <p className="muted">Loading eligible appointments…</p>
            ) : (
              <select
                id="unbilled-select"
                value={selectedApptId}
                onChange={handleSelectAppointment}
                style={{ maxWidth: '640px' }}
              >
                <option value="">-- Choose completed or scheduled appointment --</option>
                {unbilledList.map((a) => (
                  <option key={a.appointment_id} value={a.appointment_id}>
                    {a.patient_name} ({patientCode(a.patient_id)}) — Dr. {a.doctor_name} ({a.doctor_specialization}) | {formatDate(a.date)} at {a.time_slot} [{a.status}]
                  </option>
                ))}
              </select>
            )}
            {unbilledList.length === 0 && !unbilledLoading && (
              <p className="muted" style={{ marginTop: '6px', fontSize: '0.88rem' }}>
                No unbilled appointments found. Completed appointments ready for billing will appear here.
              </p>
            )}
          </div>

          {previewLoading && <p className="muted">Calculating fees and dispensed medicines breakdown…</p>}

          {previewData && previewData.already_billed && (
            <div className="panel" style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '16px' }}>
              <p style={{ color: 'var(--danger)', fontWeight: 600 }}>
                This appointment has already been billed under Invoice #{previewData.existing_bill.bill_id}.
              </p>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => openViewInvoice(previewData.existing_bill.bill_id)}
                style={{ marginTop: '8px' }}
              >
                View Existing Invoice
              </button>
            </div>
          )}

          {previewData && !previewData.already_billed && (
            <form onSubmit={handleGenerateBill} style={{ display: 'grid', gap: '20px' }}>
              {/* Patient & Doctor Banner */}
              <div
                style={{
                  background: 'var(--paper)',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '12px',
                }}
              >
                <div>
                  <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Patient</div>
                  <strong style={{ fontSize: '1.05rem' }}>{previewData.appointment.patient_name}</strong>{' '}
                  <span className="muted">({patientCode(previewData.appointment.patient_id)})</span>
                  <div style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '2px' }}>
                    {previewData.appointment.patient_gender}, {previewData.appointment.patient_age} yrs • {previewData.appointment.patient_phone || 'No phone'}
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Consulting Doctor</div>
                  <strong style={{ fontSize: '1.05rem' }}>Dr. {previewData.appointment.doctor_name}</strong>
                  <div style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '2px' }}>
                    {previewData.appointment.doctor_specialization} • Visit: {formatDate(previewData.appointment.date)} ({previewData.appointment.time_slot})
                  </div>
                </div>
              </div>

              {/* Itemized Charges Section */}
              <div>
                <label style={{ fontSize: '1rem', marginBottom: '8px' }}>2. Itemized Charges Breakdown</label>
                <table style={{ width: '100%', background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                  <thead>
                    <tr style={{ background: 'var(--paper)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>Item Description</th>
                      <th style={{ padding: '10px 14px', width: '100px' }}>Qty</th>
                      <th style={{ padding: '10px 14px', width: '130px', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '10px 14px', width: '150px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Doctor Fee */}
                    <tr>
                      <td style={{ padding: '10px 14px' }}>
                        <strong>Doctor Consultation Fee</strong>
                        <div className="muted" style={{ fontSize: '0.82rem' }}>Dr. {previewData.appointment.doctor_name} ({previewData.appointment.doctor_specialization})</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>1</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatCurrency(consultationFee)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}><strong>{formatCurrency(consultationFee)}</strong></td>
                    </tr>

                    {/* Pharmacy Dispensed Items */}
                    {previewData.prescription_items && previewData.prescription_items.length > 0 ? (
                      previewData.prescription_items.map((it) => (
                        <tr key={it.item_id}>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Pharmacy: {it.medicine_name}</span>
                            <div className="muted" style={{ fontSize: '0.82rem' }}>Dosage: {it.dosage} ({it.duration})</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>{it.quantity}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatCurrency(it.unit_price)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatCurrency(it.line_total)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ padding: '10px 14px', color: 'var(--muted)', fontStyle: 'italic', background: 'var(--paper)' }}>
                          No dispensed medicines recorded for this visit. (Medicines will appear here once dispensed by the pharmacy).
                        </td>
                      </tr>
                    )}

                    {/* Other Charges Input */}
                    <tr style={{ background: '#fcfdfd' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <strong>Other / Hospital Service Charges</strong>
                        <div className="muted" style={{ fontSize: '0.82rem' }}>Registration, nursing, laboratory, or dressing</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>—</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>—</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <span>₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={otherCharges}
                            onChange={(e) => setOtherCharges(e.target.value)}
                            style={{ width: '100px', textAlign: 'right', padding: '6px 8px' }}
                            required
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--ink)', background: 'var(--accent-tint)' }}>
                      <td colSpan={3} style={{ padding: '14px', fontWeight: 700, fontSize: '1.1rem' }}>
                        Total Amount Due
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent-dark)' }}>
                        {formatCurrency(liveTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Payment Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  background: 'var(--paper)',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div>
                  <label htmlFor="bill-status">3. Payment Status</label>
                  <select
                    id="bill-status"
                    value={billStatus}
                    onChange={(e) => setBillStatus(e.target.value)}
                  >
                    <option value="Paid">Paid (Payment Received)</option>
                    <option value="Pending">Pending (Pay Later / Credit)</option>
                  </select>
                </div>

                {billStatus === 'Paid' && (
                  <div>
                    <label htmlFor="payment-mode">4. Payment Mode</label>
                    <select
                      id="payment-mode"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Debit / Credit Card</option>
                      <option value="upi">UPI / Online Transfer</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="form-actions" style={{ marginTop: '8px' }}>
                <button type="submit" className="btn primary" disabled={generating}>
                  {generating ? 'Generating Invoice…' : `Generate Invoice (${formatCurrency(liveTotal)})`}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setSelectedApptId('');
                    setPreviewData(null);
                    setOtherCharges(0);
                  }}
                >
                  Reset
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* --- TAB 2: ALL BILLS LIST --- */}
      {activeTab === 'list' && (
        <>
          <div className="filters-row" style={{ marginTop: '20px' }}>
            {/* Search Input */}
            <div className="filter-group" style={{ flex: 1, minWidth: '220px' }}>
              <label htmlFor="search-bills">Search Patient</label>
              <input
                id="search-bills"
                type="search"
                placeholder="Search by patient name or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadBills(); }}
              />
            </div>

            {/* Status Filter */}
            <div className="filter-group">
              <label htmlFor="status-filter">Payment Status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="filter-group">
              <label htmlFor="date-filter">Invoice Date</label>
              <input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            {/* Clear Filters */}
            {(statusFilter || searchQuery || dateFilter) && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  className="btn ghost small"
                  onClick={() => {
                    setStatusFilter('');
                    setSearchQuery('');
                    setDateFilter('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          <div className="panel table-wrap" style={{ marginTop: '16px' }}>
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Patient</th>
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
                      <td>
                        <strong>{billCode(b.bill_id)}</strong>
                      </td>
                      <td>{formatDate(b.date)}</td>
                      <td>
                        <Link to={`/patients/${b.patient_id}`}>
                          {b.patient_name} <span className="muted">({patientCode(b.patient_id)})</span>
                        </Link>
                        {b.patient_phone && <div className="muted"><small>{b.patient_phone}</small></div>}
                      </td>
                      <td>
                        {b.doctor_name ? (
                          <>
                            <strong>Dr. {b.doctor_name}</strong>
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
                        <strong style={{ fontSize: '1.05rem', color: isPaid ? 'var(--ok)' : 'var(--danger)' }}>
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
                          {!isPaid && (
                            <button
                              type="button"
                              className="btn primary small"
                              onClick={() => {
                                setPayingBill(b);
                                setPayMode('cash');
                              }}
                              title="Mark bill as Paid"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => openViewInvoice(b.bill_id)}
                            title="View printable invoice"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => handleDownloadPdf(b.bill_id)}
                            title="Download official PDF invoice"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!billsLoading && bills.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty">
                      No invoices found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- MODAL 1: RECORD PAYMENT FOR PENDING BILL --- */}
      {payingBill && (
        <div className="modal-overlay" onClick={() => setPayingBill(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setPayingBill(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px' }}>
              Invoice: <strong>{billCode(payingBill.bill_id)}</strong>
              <br />
              Patient: <strong>{payingBill.patient_name}</strong>
              <br />
              Total Due: <strong style={{ color: 'var(--accent-dark)', fontSize: '1.2rem' }}>{formatCurrency(payingBill.total)}</strong>
            </p>

            <form onSubmit={handleConfirmPay}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="pay-mode-select">Select Payment Mode</label>
                <select
                  id="pay-mode-select"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="card">Debit / Credit Card</option>
                  <option value="upi">UPI / Online Transfer</option>
                </select>
              </div>

              <div className="form-actions">
                <button className="btn primary" disabled={paySaving}>
                  {paySaving ? 'Recording…' : `Confirm Payment (${formatCurrency(payingBill.total)})`}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setPayingBill(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: PRINTABLE INVOICE MODAL (FR-6.4) --- */}
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
                  title="Print invoice"
                >
                  🖨️ Print
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => handleDownloadPdf(viewInvoice.bill_id)}
                  title="Download PDF"
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

            {/* Printable Invoice Container */}
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

              {/* Patient & Doctor Meta */}
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

              {/* Line Items Table */}
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

              {/* Total Banner */}
              <div className="invoice-summary" style={{ marginTop: '20px' }}>
                <span>Total Amount {viewInvoice.status === 'Paid' ? 'Paid' : 'Due'}:</span>
                <span style={{ color: 'var(--accent-dark)' }}>{formatCurrency(viewInvoice.total)}</span>
              </div>

              <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)' }}>
                This is a computer-generated invoice from City Hospital Management System. Valid without signature.
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
