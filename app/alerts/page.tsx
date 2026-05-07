// app/alerts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

type Alert = {
  id: string;
  title: string;
  type: string;
  message: string;
  status: string;
  sent_by_name: string | null;
  created_at: string;
};

export default function AlertsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [type, setType] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const role = profile?.role || 'employee';
        setUserRole(role);

        if (!['admin', 'hr', 'manager'].includes(role)) {
          alert('Access denied. Admins or HR only.');
          router.push('/');
          return;
        }

        setIsAuthChecking(false);
        fetchAlerts();
        fetchEmployees();
      } catch (error) {
        console.error('Auth error:', error);
        router.push('/auth/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  async function fetchEmployees() {
    const { data } = await supabase
      .from('employees')
      .select('employee_id, first_name, last_name, email')
      .order('first_name');
    setEmployees(data || []);
  }

  async function fetchAlerts() {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false });
    setAlerts(data || []);
  }

  async function handleSendAlert(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { data: admin } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('email', user.email)
        .single();

      const adminName = admin ? `${admin.first_name} ${admin.last_name || ''}`.trim() : 'Admin';

      // Auto-generate title from type
      const title = type 
        ? `${type.toUpperCase()} ALERT` 
        : 'GENERAL ANNOUNCEMENT';

      const { error: alertError } = await supabase
        .from('alerts')
        .insert([{
          title,
          type,
          message,
          sent_by: user.id,
          sent_by_name: adminName,
          status: 'active'
        }]);

      if (alertError) throw alertError;

      // Send emails via API
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message,
          sent_by: adminName,
          target: selectedEmployee
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send emails');
      }

      const result = await response.json();

      setSuccess(`✅ Alert sent to ${result.sentCount || 0} employee(s)!`);
      setType('');
      setMessage('');
      setSelectedEmployee('all');
      fetchAlerts();
    } catch (error: any) {
      console.error('Error sending alert:', error);
      setError(error.message || 'Failed to send alert');
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(alertId: string) {
    await supabase.from('alerts').update({ status: 'resolved' }).eq('id', alertId);
    fetchAlerts();
  }

  async function handleDelete(alertId: string) {
    if (!confirm('Delete this alert?')) return;
    await supabase.from('alerts').delete().eq('id', alertId);
    fetchAlerts();
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'urgent': return { bg: '#fee2e2', text: '#dc2626' };
      case 'warning': return { bg: '#fff3cd', text: '#f59e0b' };
      case 'event': return { bg: '#dbeafe', text: '#3b82f6' };
      case 'security': return { bg: '#f3e8ff', text: '#9333ea' };
      default: return { bg: '#e2e8f0', text: '#475569' };
    }
  };

  if (isAuthChecking) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Alerts Management</h1>
        <button onClick={() => router.push('/admin')} style={styles.backButton}>
          ← Back to Admin
        </button>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Create New Alert</h2>
        <form onSubmit={handleSendAlert}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Send To</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={styles.select}
              required
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.employee_id} value={emp.employee_id}>
                  {emp.first_name} {emp.last_name || ''} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Alert Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={styles.select}
              required
            >
              <option value="">Select type...</option>
              <option value="event">Company Event / Holiday</option>
              <option value="security">Security / Road Blockage</option>
              <option value="warning">Warning</option>
              <option value="urgent">Urgent</option>
              <option value="general">General Announcement</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={styles.textarea}
              rows={4}
              placeholder="Type your alert message here..."
              required
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.submitButton, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Sending...' : 'Send Alert'}
          </button>
        </form>
      </div>

      {/* Alert History */}
      <div style={styles.card}>
        <div style={styles.listHeader}>
          <h2 style={styles.cardTitle}>Alert History</h2>
          <button onClick={fetchAlerts} style={styles.refreshButton}>⟳ Refresh</button>
        </div>

        <div style={styles.alertsList}>
          {alerts.length === 0 ? (
            <p style={styles.noAlerts}>No alerts found</p>
          ) : (
            alerts.map((alert) => {
              const colors = getTypeColor(alert.type);
              return (
                <div
                  key={alert.id}
                  style={{
                    ...styles.alertItem,
                    borderLeftColor: colors.text,
                    backgroundColor: colors.bg,
                  }}
                >
                  <div style={styles.alertHeader}>
                    <div style={styles.alertType}>
                      <span style={{ color: colors.text, fontWeight: '600' }}>
                        {alert.type.toUpperCase()}
                      </span>
                      {alert.status === 'active' && <span style={styles.activeBadge}>ACTIVE</span>}
                    </div>
                    <span style={styles.alertDate}>
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={styles.alertMessage}>{alert.message}</p>
                  <div style={styles.alertFooter}>
                    <span style={styles.sentBy}>
                      Sent by: {alert.sent_by_name || 'System'}
                    </span>
                    <div style={styles.alertActions}>
                      {alert.status === 'active' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          style={styles.resolveButton}
                        >
                          ✓ Resolve
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(alert.id)}
                        style={styles.deleteButton}
                      >
                        ✕ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '1000px', margin: '2rem auto', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' },
  loading: { textAlign: 'center' as const, padding: '4rem', fontSize: '1.2rem', color: '#64748b' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  title: { fontSize: '2.5rem', fontWeight: '700', color: '#1e293b', margin: 0 },
  backButton: { padding: '0.5rem 1rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem' },
  card: { backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '2rem' },
  cardTitle: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' },
  formGroup: { marginBottom: '1.5rem' },
  label: { display: 'block', fontSize: '0.95rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' },
  select: { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: 'white' },
  textarea: { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'inherit', resize: 'vertical' as const },
  submitButton: { width: '100%', padding: '1rem', backgroundColor: '#1e3a8a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' },
  error: { color: '#dc2626', fontSize: '0.95rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: '8px' },
  success: { color: '#059669', fontSize: '0.95rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#d1fae5', borderRadius: '8px' },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  refreshButton: { padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' },
  alertsList: { display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  alertItem: { padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
  alertHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  alertType: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  activeBadge: { fontSize: '0.7rem', padding: '0.25rem 0.5rem', backgroundColor: '#10b981', color: 'white', borderRadius: '9999px', fontWeight: '600' },
  alertDate: { fontSize: '0.85rem', color: '#64748b' },
  alertMessage: { fontSize: '1rem', color: '#1e293b', marginBottom: '1rem', lineHeight: '1.5' },
  alertFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sentBy: { fontSize: '0.85rem', color: '#64748b' },
  alertActions: { display: 'flex', gap: '0.5rem' },
  resolveButton: { padding: '0.25rem 0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' },
  deleteButton: { padding: '0.25rem 0.75rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' },
  noAlerts: { textAlign: 'center' as const, color: '#94a3b8', padding: '3rem' },
};