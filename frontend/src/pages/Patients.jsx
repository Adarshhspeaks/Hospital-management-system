import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { patientCode } from '../format.js';
import PatientForm from '../components/PatientForm.jsx';

export default function Patients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [patients, setPatients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);

  // Search as you type, waiting a moment so we don't call the API on every key
  useEffect(() => {
    const t = setTimeout(() => {
      api(`/patients?q=${encodeURIComponent(q.trim())}`)
        .then((rows) => { setPatients(rows); setError(''); })
        .catch((e) => setError(e.message))
        .finally(() => setLoaded(true));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function register(data) {
    const created = await api('/patients', { method: 'POST', body: data });
    navigate(`/patients/${created.patient_id}`);
  }

  return (
    <>
      <div className="title-row">
        <h1 className="page-title">Patients</h1>
        {user.role === 'receptionist' && !registering && (
          <button className="btn primary" onClick={() => setRegistering(true)}>Register patient</button>
        )}
      </div>

      {registering && (
        <PatientForm submitLabel="Register patient" onSubmit={register} onCancel={() => setRegistering(false)} />
      )}

      <div className="search">
        <label htmlFor="search" className="sr-only">Search patients</label>
        <input
          id="search"
          type="search"
          placeholder="Search by name, phone or patient ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Phone</th></tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.patient_id}>
                <td>{patientCode(p.patient_id)}</td>
                <td><Link to={`/patients/${p.patient_id}`}>{p.name}</Link></td>
                <td>{p.age}</td>
                <td>{p.gender}</td>
                <td>{p.phone}</td>
              </tr>
            ))}
            {loaded && patients.length === 0 && (
              <tr>
                <td colSpan="5" className="empty">
                  {q ? 'No patient matches that search. Check the spelling or try the phone number.' : 'No patients registered yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
