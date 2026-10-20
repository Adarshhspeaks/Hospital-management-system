import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { patientCode, formatDate } from '../format.js';

function getTodayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Appointments() {
  const { user } = useAuth();
  const isReceptionist = user.role === 'receptionist';
  const isDoctor = user.role === 'doctor';
  const isAdmin = user.role === 'admin';

  const today = getTodayString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Booking panel state (for Receptionist)
  const [showBookPanel, setShowBookPanel] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [allDoctors, setAllDoctors] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState(today);
  const [bookSlots, setBookSlots] = useState([]);
  const [bookSlotLoading, setBookSlotLoading] = useState(false);
  const [bookSlotMessage, setBookSlotMessage] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  // Reschedule modal state
  const [reschedulingAppt, setReschedulingAppt] = useState(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedSlots, setReschedSlots] = useState([]);
  const [reschedSelectedSlot, setReschedSelectedSlot] = useState('');
  const [reschedSaving, setReschedSaving] = useState(false);

  // Consultation modal state (Doctor)
  const [consultAppt, setConsultAppt] = useState(null);
  const [consultSaving, setConsultSaving] = useState(false);
  const [availableMedicines, setAvailableMedicines] = useState([]);
  const [pastRecords, setPastRecords] = useState([]);
  const [showPastRecords, setShowPastRecords] = useState(false);
  const [pastRecordsLoading, setPastRecordsLoading] = useState(false);
  const [consultForm, setConsultForm] = useState({
    symptoms: '',
    diagnosis: '',
    notes: '',
    prescription: [],
  });

  // View Record Modal state (Doctor viewing completed record)
  const [viewingRecord, setViewingRecord] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  // Load appointments
  function loadAppointments() {
    setLoading(true);
    let url = `/appointments?`;
    if (selectedDate) url += `date=${encodeURIComponent(selectedDate)}&`;

    api(url)
      .then((data) => {
        setAppointments(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAppointments();
  }, [selectedDate]);

  // Load doctors for booking dropdown
  useEffect(() => {
    if (isReceptionist) {
      api('/doctors')
        .then((docs) => {
          setAllDoctors(docs);
          if (docs.length > 0 && !bookDoctorId) {
            setBookDoctorId(String(docs[0].doctor_id));
          }
        })
        .catch(() => {});
    }
  }, [isReceptionist]);

  // Load medicines for doctor prescription builder
  useEffect(() => {
    if (isDoctor) {
      api('/medicines')
        .then((meds) => setAvailableMedicines(meds))
        .catch(() => {});
    }
  }, [isDoctor]);

  // Patient live search for booking
  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatientResults([]);
      return;
    }
    const t = setTimeout(() => {
      api(`/patients?q=${encodeURIComponent(patientSearch.trim())}`)
        .then((res) => setPatientResults(res))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Load slots when booking doctor or date changes
  useEffect(() => {
    if (!bookDoctorId || !bookDate) {
      setBookSlots([]);
      setSelectedSlot('');
      return;
    }
    setBookSlotLoading(true);
    setBookSlotMessage('');
    setSelectedSlot('');

    api(`/doctors/${bookDoctorId}/slots?date=${bookDate}`)
      .then((res) => {
        if (!res.working) {
          setBookSlotMessage(res.message || 'Doctor is not available on this day.');
          setBookSlots([]);
        } else {
          setBookSlots(res.slots || []);
        }
      })
      .catch((err) => {
        setBookSlotMessage(err.message);
        setBookSlots([]);
      })
      .finally(() => setBookSlotLoading(false));
  }, [bookDoctorId, bookDate]);

  // Load slots when rescheduling
  useEffect(() => {
    if (!reschedulingAppt || !reschedDate) {
      setReschedSlots([]);
      setReschedSelectedSlot('');
      return;
    }

    api(`/doctors/${reschedulingAppt.doctor_id}/slots?date=${reschedDate}`)
      .then((res) => {
        if (!res.working) {
          setReschedSlots([]);
        } else {
          setReschedSlots(res.slots || []);
        }
      })
      .catch(() => setReschedSlots([]));
  }, [reschedulingAppt, reschedDate]);

  // Handle booking appointment
  async function handleBookAppointment(e) {
    e.preventDefault();
    if (!selectedPatient) {
      setError('Please search and select a patient first.');
      return;
    }
    if (!selectedSlot) {
      setError('Please select an available time slot.');
      return;
    }

    setError('');
    setSuccess('');
    setBookingSaving(true);

    try {
      await api('/appointments', {
        method: 'POST',
        body: {
          patient_id: selectedPatient.patient_id,
          doctor_id: Number(bookDoctorId),
          date: bookDate,
          time_slot: selectedSlot,
        },
      });

      setSuccess(`Appointment booked successfully for ${selectedPatient.name} on ${formatDate(bookDate)} at ${selectedSlot}.`);
      setShowBookPanel(false);
      setSelectedPatient(null);
      setPatientSearch('');
      setSelectedSlot('');
      loadAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setBookingSaving(false);
    }
  }

  // Handle Reschedule
  function openReschedule(appt) {
    setReschedulingAppt(appt);
    setReschedDate(appt.date);
    setReschedSelectedSlot(appt.time_slot);
    setError('');
    setSuccess('');
  }

  async function handleConfirmReschedule(e) {
    e.preventDefault();
    if (!reschedSelectedSlot) {
      setError('Please select a time slot.');
      return;
    }

    setError('');
    setReschedSaving(true);

    try {
      await api(`/appointments/${reschedulingAppt.appointment_id}/reschedule`, {
        method: 'PATCH',
        body: {
          date: reschedDate,
          time_slot: reschedSelectedSlot,
        },
      });

      setSuccess('Appointment rescheduled successfully.');
      setReschedulingAppt(null);
      loadAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setReschedSaving(false);
    }
  }

  // Handle Cancel
  async function handleCancel(appt) {
    const confirmed = window.confirm(`Cancel the appointment for ${appt.patient_name} on ${formatDate(appt.date)} at ${appt.time_slot}?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      await api(`/appointments/${appt.appointment_id}/cancel`, { method: 'PATCH' });
      setSuccess('Appointment cancelled.');
      loadAppointments();
    } catch (err) {
      setError(err.message);
    }
  }

  // Handle Status Update (No-show, Completed)
  async function handleUpdateStatus(appt, newStatus) {
    const actionLabel = newStatus === 'Completed' ? 'mark as Completed' : 'mark as No-show';
    const confirmed = window.confirm(`Are you sure you want to ${actionLabel} for ${appt.patient_name}?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      await api(`/appointments/${appt.appointment_id}/status`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      setSuccess(`Appointment marked as ${newStatus}.`);
      loadAppointments();
    } catch (err) {
      setError(err.message);
    }
  }

  // --- Doctor Consultation Logic ---
  function openConsultation(appt) {
    setConsultAppt(appt);
    setConsultForm({
      symptoms: '',
      diagnosis: '',
      notes: '',
      prescription: [],
    });
    setShowPastRecords(false);
    setPastRecords([]);
    setError('');
    setSuccess('');

    // Pre-fetch past records for this patient
    setPastRecordsLoading(true);
    api(`/records/patient/${appt.patient_id}`)
      .then((records) => setPastRecords(records))
      .catch(() => {})
      .finally(() => setPastRecordsLoading(false));
  }

  function addPrescriptionItem() {
    const defaultMedId = availableMedicines.length > 0 ? availableMedicines[0].medicine_id : '';
    setConsultForm({
      ...consultForm,
      prescription: [
        ...consultForm.prescription,
        {
          medicine_id: defaultMedId,
          dosage: '1 tab twice daily',
          duration: '5 days',
          quantity: 10,
        },
      ],
    });
  }

  function updatePrescriptionItem(index, field, val) {
    const nextItems = [...consultForm.prescription];
    nextItems[index] = { ...nextItems[index], [field]: val };
    setConsultForm({ ...consultForm, prescription: nextItems });
  }

  function removePrescriptionItem(index) {
    setConsultForm({
      ...consultForm,
      prescription: consultForm.prescription.filter((_, i) => i !== index),
    });
  }

  async function handleSaveConsultation(e) {
    e.preventDefault();
    if (!consultForm.diagnosis.trim()) {
      setError('Diagnosis is required to complete consultation.');
      return;
    }

    setError('');
    setConsultSaving(true);

    try {
      const payload = {
        appointment_id: consultAppt.appointment_id,
        symptoms: consultForm.symptoms,
        diagnosis: consultForm.diagnosis,
        notes: consultForm.notes,
        prescription: consultForm.prescription.map((it) => ({
          medicine_id: Number(it.medicine_id),
          dosage: it.dosage,
          duration: it.duration,
          quantity: Number(it.quantity || 1),
        })),
      };

      await api('/records', { method: 'POST', body: payload });
      setSuccess(`Consultation saved and appointment completed for ${consultAppt.patient_name}.`);
      setConsultAppt(null);
      loadAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setConsultSaving(false);
    }
  }

  function openViewRecord(appt) {
    setViewingLoading(true);
    setViewingRecord(null);
    api(`/records/appointment/${appt.appointment_id}`)
      .then((rec) => setViewingRecord(rec))
      .catch((err) => setError(err.message))
      .finally(() => setViewingLoading(false));
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">{isDoctor ? 'My Appointments' : 'Appointments'}</h1>
          <p className="lede">
            {isDoctor
              ? 'Your scheduled consultations for the selected day.'
              : 'Schedule, reschedule, and manage patient appointments.'}
          </p>
        </div>

        {isReceptionist && !showBookPanel && (
          <button
            className="btn primary"
            onClick={() => {
              setShowBookPanel(true);
              setError('');
              setSuccess('');
            }}
          >
            Book appointment
          </button>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      {/* Booking Panel (Receptionist) */}
      {showBookPanel && (
        <form className="panel form-grid" onSubmit={handleBookAppointment}>
          <h2>Book an appointment</h2>

          {/* Patient Selector */}
          <div className="span-2">
            <label htmlFor="search-patient">1. Select Patient</label>
            {selectedPatient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="tag active" style={{ fontSize: '0.95rem', padding: '6px 12px' }}>
                  {selectedPatient.name} ({patientCode(selectedPatient.patient_id)}) - {selectedPatient.phone}
                </span>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientSearch('');
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  id="search-patient"
                  type="search"
                  placeholder="Type patient name, phone number, or ID (e.g. P-0001)…"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  autoFocus
                />
                {patientResults.length > 0 && (
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius)',
                      marginTop: '4px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                    }}
                  >
                    {patientResults.map((p) => (
                      <div
                        key={p.patient_id}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientResults([]);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--line)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                      >
                        <strong>{p.name}</strong> ({patientCode(p.patient_id)}) — {p.phone}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Doctor Selector */}
          <div>
            <label htmlFor="book-doc">2. Select Doctor</label>
            <select
              id="book-doc"
              value={bookDoctorId}
              onChange={(e) => setBookDoctorId(e.target.value)}
              required
            >
              {allDoctors.map((doc) => (
                <option key={doc.doctor_id} value={doc.doctor_id}>
                  {doc.name} ({doc.specialization}) - ₹{doc.fee}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div>
            <label htmlFor="book-date">3. Appointment Date</label>
            <input
              id="book-date"
              type="date"
              min={today}
              value={bookDate}
              onChange={(e) => setBookDate(e.target.value)}
              required
            />
          </div>

          {/* Slot Grid */}
          <div className="span-all">
            <label>4. Select Time Slot (30-minute block)</label>
            {bookSlotLoading ? (
              <p className="muted">Checking doctor availability…</p>
            ) : bookSlotMessage ? (
              <p className="error" style={{ margin: '8px 0' }}>{bookSlotMessage}</p>
            ) : bookSlots.length > 0 ? (
              <div className="slot-grid">
                {bookSlots.map((s) => {
                  const isSelected = selectedSlot === s.time;
                  let title = 'Available';
                  if (s.booked) title = 'Already booked';
                  if (s.past) title = 'Past time';

                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      className={`slot-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(s.time)}
                      title={title}
                    >
                      {s.time}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No slots available for this doctor on this day.</p>
            )}
            {selectedSlot && (
              <p className="success" style={{ marginTop: '10px' }}>
                Selected Slot: <strong>{selectedSlot}</strong> on {formatDate(bookDate)}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button
              className="btn primary"
              disabled={bookingSaving || !selectedPatient || !selectedSlot}
            >
              {bookingSaving ? 'Booking…' : 'Confirm booking'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setShowBookPanel(false);
                setSelectedPatient(null);
                setPatientSearch('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reschedule Modal (Receptionist) */}
      {reschedulingAppt && (
        <div className="modal-overlay" onClick={() => setReschedulingAppt(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reschedule Appointment</h2>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setReschedulingAppt(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px' }}>
              Patient: <strong>{reschedulingAppt.patient_name}</strong>
              <br />
              Doctor: <strong>{reschedulingAppt.doctor_name}</strong> ({reschedulingAppt.doctor_specialization})
            </p>

            <form onSubmit={handleConfirmReschedule}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="resched-date">New Date</label>
                <input
                  id="resched-date"
                  type="date"
                  min={today}
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Select Free Slot</label>
                <div className="slot-grid">
                  {reschedSlots.map((s) => {
                    const isSelected = reschedSelectedSlot === s.time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available && !(reschedDate === reschedulingAppt.date && s.time === reschedulingAppt.time_slot)}
                        className={`slot-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setReschedSelectedSlot(s.time)}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button
                  className="btn primary"
                  disabled={reschedSaving || !reschedSelectedSlot}
                >
                  {reschedSaving ? 'Rescheduling…' : 'Save new slot'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setReschedulingAppt(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Consultation Modal (FR-5.1 to FR-5.4) */}
      {consultAppt && (
        <div className="modal-overlay" onClick={() => setConsultAppt(null)}>
          <div className="modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Doctor Consultation</h2>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setConsultAppt(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--paper)', padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
              <strong>{consultAppt.patient_name}</strong> ({patientCode(consultAppt.patient_id)})
              &nbsp;|&nbsp; Age: {consultAppt.patient_age} ({consultAppt.patient_gender})
              &nbsp;|&nbsp; Phone: {consultAppt.patient_phone || '—'}
            </div>

            {/* Toggle past medical history */}
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowPastRecords(!showPastRecords)}
              >
                {showPastRecords ? 'Hide previous records' : `View previous records (${pastRecords.length})`}
              </button>

              {showPastRecords && (
                <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {pastRecordsLoading ? (
                    <p className="muted">Loading past records…</p>
                  ) : pastRecords.length === 0 ? (
                    <p className="muted">No previous medical records for this patient.</p>
                  ) : (
                    pastRecords.map((pr) => (
                      <div key={pr.record_id} className="record-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <strong>{formatDate(pr.date)} ({pr.time_slot})</strong>
                          <span className="muted">{pr.doctor_name} ({pr.specialization})</span>
                        </div>
                        <p><strong>Diagnosis:</strong> {pr.diagnosis}</p>
                        {pr.symptoms && <p><strong>Symptoms:</strong> {pr.symptoms}</p>}
                        {pr.notes && <p><strong>Notes:</strong> {pr.notes}</p>}
                        {pr.prescription?.items?.length > 0 && (
                          <div style={{ marginTop: '6px' }}>
                            <strong>Prescription:</strong>
                            <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '0.85rem' }}>
                              {pr.prescription.items.map((it) => (
                                <li key={it.item_id}>
                                  {it.medicine_name} — {it.dosage} ({it.duration}) [Qty: {it.quantity}]
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Consultation Form */}
            <form onSubmit={handleSaveConsultation}>
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="c-symptoms">Symptoms</label>
                <textarea
                  id="c-symptoms"
                  rows="2"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}
                  placeholder="Enter patient symptoms and complaints…"
                  value={consultForm.symptoms}
                  onChange={(e) => setConsultForm({ ...consultForm, symptoms: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="c-diag">Diagnosis *</label>
                <input
                  id="c-diag"
                  placeholder="e.g. Acute Bronchitis, Hypertension, Type 2 Diabetes"
                  value={consultForm.diagnosis}
                  onChange={(e) => setConsultForm({ ...consultForm, diagnosis: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="c-notes">Clinical Notes & Advice</label>
                <textarea
                  id="c-notes"
                  rows="2"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}
                  placeholder="Additional observations, diet, or follow-up instructions…"
                  value={consultForm.notes}
                  onChange={(e) => setConsultForm({ ...consultForm, notes: e.target.value })}
                />
              </div>

              {/* Prescription Items Builder */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>Prescription (Medicines)</label>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={addPrescriptionItem}
                  >
                    + Add medicine
                  </button>
                </div>

                {consultForm.prescription.length === 0 ? (
                  <p className="muted" style={{ fontSize: '0.88rem', margin: '8px 0' }}>
                    No medicines added. Click "+ Add medicine" if prescribing medication.
                  </p>
                ) : (
                  <div className="prescription-builder">
                    {consultForm.prescription.map((item, idx) => (
                      <div key={idx} className="prescription-item-grid">
                        <div>
                          <label style={{ fontSize: '0.78rem' }}>Medicine</label>
                          <select
                            value={item.medicine_id}
                            onChange={(e) => updatePrescriptionItem(idx, 'medicine_id', e.target.value)}
                            required
                          >
                            {availableMedicines.map((m) => (
                              <option key={m.medicine_id} value={m.medicine_id}>
                                {m.name} (In stock: {m.quantity})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem' }}>Dosage</label>
                          <input
                            placeholder="e.g. 1 tab twice daily"
                            value={item.dosage}
                            onChange={(e) => updatePrescriptionItem(idx, 'dosage', e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem' }}>Duration</label>
                          <input
                            placeholder="e.g. 5 days"
                            value={item.duration}
                            onChange={(e) => updatePrescriptionItem(idx, 'duration', e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem' }}>Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updatePrescriptionItem(idx, 'quantity', e.target.value)}
                            required
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => removePrescriptionItem(idx)}
                            title="Remove item"
                            style={{ padding: '6px 8px', color: 'var(--danger)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button className="btn primary" disabled={consultSaving}>
                  {consultSaving ? 'Saving…' : 'Save Consultation & Complete'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setConsultAppt(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Completed Record Modal (Doctor) */}
      {viewingRecord && (
        <div className="modal-overlay" onClick={() => setViewingRecord(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Consultation Record</h2>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setViewingRecord(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '0.92rem' }}>
              <p><strong>Patient:</strong> {viewingRecord.patient_name}</p>
              <p><strong>Date & Time:</strong> {formatDate(viewingRecord.date)} at {viewingRecord.time_slot}</p>
              <p><strong>Diagnosis:</strong> {viewingRecord.diagnosis}</p>
              {viewingRecord.symptoms && <p><strong>Symptoms:</strong> {viewingRecord.symptoms}</p>}
              {viewingRecord.notes && <p><strong>Notes:</strong> {viewingRecord.notes}</p>}
            </div>

            {viewingRecord.prescription?.items?.length > 0 ? (
              <div>
                <label>Prescription</label>
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
                    {viewingRecord.prescription.items.map((it) => (
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
              <p className="muted">No medicines prescribed.</p>
            )}

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setViewingRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Filter */}
      <div className="filters-row">
        <div className="filter-group">
          <label htmlFor="filter-appt-date">Select date</label>
          <input
            id="filter-appt-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {selectedDate !== today && (
          <button className="btn ghost small" onClick={() => setSelectedDate(today)}>
            Today
          </button>
        )}

        {selectedDate && (
          <button className="btn ghost small" onClick={() => setSelectedDate('')}>
            View all dates
          </button>
        )}
      </div>

      {/* Appointments List Table */}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Patient</th>
              {!isDoctor && <th>Doctor</th>}
              <th>Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => {
              const statusClass = `tag ${a.status.toLowerCase().replace(/[^a-z]/g, '')}`;
              const isScheduled = a.status === 'Scheduled';
              const isCompleted = a.status === 'Completed';

              return (
                <tr key={a.appointment_id}>
                  <td><strong>{formatDate(a.date)}</strong></td>
                  <td>{a.time_slot}</td>
                  <td>
                    <Link to={`/patients/${a.patient_id}`}>
                      {a.patient_name} <span className="muted">({patientCode(a.patient_id)})</span>
                    </Link>
                    {a.patient_phone && <div className="muted"><small>{a.patient_phone}</small></div>}
                  </td>
                  {!isDoctor && (
                    <td>
                      <strong>{a.doctor_name}</strong>
                      <div className="muted"><small>{a.doctor_specialization}</small></div>
                    </td>
                  )}
                  <td>
                    <span className={statusClass}>{a.status}</span>
                  </td>
                  <td className="right">
                    <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                      {/* Receptionist actions */}
                      {isReceptionist && isScheduled && (
                        <>
                          <button
                            className="btn ghost small"
                            onClick={() => openReschedule(a)}
                          >
                            Reschedule
                          </button>
                          <button
                            className="btn ghost small"
                            onClick={() => handleCancel(a)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn ghost small"
                            onClick={() => handleUpdateStatus(a, 'No-show')}
                          >
                            No-show
                          </button>
                        </>
                      )}

                      {(isReceptionist || isAdmin) && isCompleted && (
                        <Link
                          to={`/billing?appointment_id=${a.appointment_id}`}
                          className="btn ghost small"
                          title="Generate bill for this completed appointment"
                        >
                          Bill
                        </Link>
                      )}

                      {/* Doctor actions */}
                      {isDoctor && isScheduled && (
                        <>
                          <button
                            className="btn primary small"
                            onClick={() => openConsultation(a)}
                            title="Start consultation and write prescription"
                          >
                            Consult
                          </button>
                          <button
                            className="btn ghost small"
                            onClick={() => handleUpdateStatus(a, 'No-show')}
                          >
                            No-show
                          </button>
                        </>
                      )}

                      {isDoctor && isCompleted && (
                        <button
                          className="btn ghost small"
                          onClick={() => openViewRecord(a)}
                        >
                          View Record
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && appointments.length === 0 && (
              <tr>
                <td colSpan={isDoctor ? 5 : 6} className="empty">
                  {selectedDate
                    ? `No appointments found for ${formatDate(selectedDate)}.`
                    : 'No appointments recorded.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
