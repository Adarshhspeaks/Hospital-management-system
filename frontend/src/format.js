// Patient IDs are stored as numbers but shown as P-0001
export const patientCode = (id) => `P-${String(id).padStart(4, '0')}`;

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const billCode = (id) => `INV-B${String(id).padStart(4, '0')}`;

export const formatCurrency = (amt) =>
  `₹${Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

