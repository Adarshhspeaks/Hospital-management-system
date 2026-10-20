import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// Menu per role. `ready: false` marks modules we build in later steps.
const MENUS = {
  admin: [
    { to: '/', label: 'Dashboard', ready: true },
    { to: '/staff', label: 'Staff accounts', ready: true },
    { to: '/patients', label: 'Patients', ready: true },
    { to: '/doctors', label: 'Doctors', ready: true },
    { to: '/appointments', label: 'Appointments', ready: true },
    { to: '/billing', label: 'Billing', ready: true },
    { to: '/pharmacy', label: 'Medicine stock', ready: true },
    { to: '/prescriptions', label: 'Prescriptions', ready: true },
    { to: '/reports', label: 'Reports', ready: true },
  ],
  receptionist: [
    { to: '/', label: 'Dashboard', ready: true },
    { to: '/patients', label: 'Patients', ready: true },
    { to: '/appointments', label: 'Appointments', ready: true },
    { to: '/doctors', label: 'Doctors', ready: true },
    { to: '/billing', label: 'Billing', ready: true },
    { to: '/reports', label: 'Reports', ready: true },
  ],
  doctor: [
    { to: '/', label: 'Dashboard', ready: true },
    { to: '/appointments', label: 'My appointments', ready: true },
    { to: '/patients', label: 'Patients', ready: true },
    { to: '/doctors', label: 'Doctors', ready: true },
    { to: '/pharmacy', label: 'Medicines', ready: true },
  ],
  pharmacist: [
    { to: '/', label: 'Dashboard', ready: true },
    { to: '/pharmacy', label: 'Medicine stock', ready: true },
    { to: '/prescriptions', label: 'Prescriptions', ready: true },
  ],
};

const ROLE_LABEL = {
  admin: 'Admin',
  receptionist: 'Receptionist',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const menu = MENUS[user.role] || [];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>City Hospital</span>
        </div>

        <nav aria-label="Main">
          {menu.map((item) =>
            item.ready ? (
              <NavLink key={item.label} to={item.to} end className="nav-item">
                {item.label}
              </NavLink>
            ) : (
              <span key={item.label} className="nav-item disabled" aria-disabled="true">
                {item.label}
                <small>Soon</small>
              </span>
            )
          )}
        </nav>

        <div className="who">
          <strong>{user.name}</strong>
          <span>{ROLE_LABEL[user.role]}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
