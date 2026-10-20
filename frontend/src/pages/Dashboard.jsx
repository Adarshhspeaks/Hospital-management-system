import { useAuth } from '../AuthContext.jsx';

const INTRO = {
  admin: 'Manage staff accounts and look up patients. Reports and the hospital overview arrive in a later step.',
  receptionist: 'Register and look up patients from the menu. Appointments and billing will appear as we build them.',
  doctor: 'Look up patients and their visit history from the menu. Your daily appointments will appear once that module is built.',
  pharmacist: 'Medicine stock and prescriptions will appear here once those modules are built.',
};

export default function Dashboard() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <h1 className="page-title">{greeting}, {user.name}</h1>
      <p className="lede">{INTRO[user.role]}</p>
    </>
  );
}
