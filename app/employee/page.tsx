// app/employee/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClientBrowser';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { JSX } from 'react';

type LeaveRequest = {
  leave_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration: number;
  reason: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
};

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  profile_photo?: string;
  designation?: string;
  department?: { name: string };
  reporting_manager?: { first_name: string; last_name: string };
};

export default function EmployeeDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [productivityScore, setProductivityScore] = useState<number | null>(null); // ← NEW
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'full-day',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'employee') {
        alert('Access denied. Employee access only.');
        router.push('/');
        return;
      }

      const { data: emp } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(name),
          reporting_manager:employees!reporting_manager_id(first_name, last_name)
        `)
        .eq('email', user.email)
        .single();

      if (!emp) {
        alert('Employee record not found. Contact HR.');
        return;
      }

      setEmployee(emp);
      if (emp) {
        fetchLeaveRequests(emp.employee_id);
        fetchProductivityScore(emp.employee_id);   // ← NEW
      }
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async (employeeId: number) => {
    try {
      const { data } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  // NEW: Fetch today's productivity score
  const fetchProductivityScore = async (employeeId: number) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('productivity_metrics')
      .select('productivity_score')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    setProductivityScore(data?.productivity_score ?? 0);
  };

  // NEW: Manual log for testing
  const logProductivity = async () => {
    if (!employee) return;
    try {
      const res = await fetch('/api/productivity/log', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_hours: 8,
          meeting_hours: 1,
          tasks_completed: 5,
        }),
      });
      if (!res.ok) throw new Error('Failed to log');
      alert('✅ Today’s productivity logged successfully!');
      fetchProductivityScore(employee.employee_id);
    } catch (err: any) {
      alert('Error logging productivity: ' + err.message);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveForm),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to submit leave');
      }

      setShowLeaveForm(false);
      setLeaveForm({ leave_type: 'full-day', start_date: '', end_date: '', reason: '' });
      if (employee) fetchLeaveRequests(employee.employee_id);
      alert('Leave request submitted successfully!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Employee Dashboard</h1>
          <p style={styles.welcome}>Welcome back, {employee?.first_name}!</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/meetings')}
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
            }}
          >
            📍 Meetings Module
          </button>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
          <button onClick={() => router.push('/attendance')} style={styles.logoutButton}>📅 Mark Attendance</button>
        </div>
      </div>

      {/* Employee Profile Card */}
      <div style={styles.profileCard}>
        <div style={styles.profileHeader}>
          {employee?.profile_photo ? (
            <Image
              src={employee.profile_photo}
              alt={employee.first_name}
              width={100}
              height={100}
              style={styles.profileImage}
            />
          ) : (
            <div style={styles.profileImagePlaceholder}>
              {employee?.first_name?.[0]}{employee?.last_name?.[0]}
            </div>
          )}
          <div style={styles.profileInfo}>
            <h2 style={styles.profileName}>{employee?.first_name} {employee?.last_name}</h2>
            <p style={styles.profileDetail}><strong>Email:</strong> {employee?.email}</p>
            <p style={styles.profileDetail}><strong>Phone:</strong> {employee?.phone || 'Not provided'}</p>
            <p style={styles.profileDetail}><strong>Department:</strong> {employee?.department?.name || 'Not assigned'}</p>
            <p style={styles.profileDetail}><strong>Designation:</strong> {employee?.designation || 'Not assigned'}</p>
            <p style={styles.profileDetail}>
              <strong>Reporting Manager:</strong> {employee?.reporting_manager 
                ? `${employee.reporting_manager.first_name} ${employee.reporting_manager.last_name || ''}`
                : 'Not assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats + Productivity Card */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{leaveRequests.length}</div>
          <div style={styles.statLabel}>Total Leaves</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {leaveRequests.filter(l => l.status === 'pending').length}
          </div>
          <div style={styles.statLabel}>Pending</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {leaveRequests.filter(l => l.status === 'approved').length}
          </div>
          <div style={styles.statLabel}>Approved</div>
        </div>

        {/* NEW PRODUCTIVITY CARD */}
        <div style={styles.statCard}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1e3a8a' }}>
            {productivityScore ?? 0}<span style={{ fontSize: '1rem' }}>%</span>
          </div>
          <div style={styles.statLabel}>Today's Productivity</div>
          <button
            onClick={logProductivity}
            style={{
              marginTop: '0.8rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Log Today's Activity
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button onClick={() => setShowLeaveForm(true)} style={styles.primaryButton}>
          + Request Leave
        </button>
      </div>

      {/* Leave Request Form Modal - unchanged */}
      {showLeaveForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>New Leave Request</h3>
            <form onSubmit={handleLeaveSubmit}>
              {/* Your existing form fields - unchanged */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  style={styles.select}
                  required
                >
                  <option value="full-day">Full Day</option>
                  <option value="half-day">Half Day</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Start Date</label>
                <input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                  style={styles.input}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>End Date</label>
                <input
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  style={styles.input}
                  min={leaveForm.start_date || new Date().toISOString().split('T')[0]}
                />
                <small style={styles.hint}>Leave blank for single day</small>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  style={styles.textarea}
                  rows={3}
                  placeholder="Please provide a reason for your leave"
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button type="submit" disabled={submitting} style={styles.submitButton}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowLeaveForm(false)} style={styles.cancelButton}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave History - unchanged */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>My Leave Requests</h2>
        {leaveRequests.length === 0 ? (
          <div style={styles.noData}>
            <p>No leave requests found</p>
            <button onClick={() => setShowLeaveForm(true)} style={styles.secondaryButton}>
              Request Your First Leave
            </button>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Start Date</th>
                  <th style={styles.th}>End Date</th>
                  <th style={styles.th}>Duration</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Applied On</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((leave) => (
                  <tr key={leave.leave_id}>
                    <td style={styles.td}>
                      <span style={styles.leaveType}>
                        {leave.leave_type === 'full-day' ? '📅 Full Day' : '🌓 Half Day'}
                      </span>
                    </td>
                    <td style={styles.td}>{formatDate(leave.start_date)}</td>
                    <td style={styles.td}>{formatDate(leave.end_date)}</td>
                    <td style={styles.td}>{leave.duration} {leave.duration === 1 ? 'day' : 'days'}</td>
                    <td style={styles.td}>{leave.reason}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, backgroundColor: getStatusColor(leave.status) }}>
                        {leave.status.toUpperCase()}
                      </span>
                      {leave.rejection_reason && (
                        <div style={styles.rejectionReason}>Reason: {leave.rejection_reason}</div>
                      )}
                    </td>
                    <td style={styles.td}>{formatDate(leave.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #e2e8f0',
    borderTop: '5px solid #1e3a8a',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#64748b',
    fontSize: '1.1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
  },
  welcome: {
    fontSize: '1.1rem',
    color: '#64748b',
    margin: '0.5rem 0 0 0',
  },
  logoutButton: {
    padding: '0.6rem 1.2rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  profileCard: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    marginBottom: '2rem',
  },
  profileHeader: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'center',
  },
  profileImage: {
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '3px solid #1e3a8a',
  },
  profileImagePlaceholder: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: '#1e3a8a',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.5rem',
    fontWeight: '600',
    border: '3px solid #2563eb',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: '1.8rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 0.5rem 0',
  },
  profileDetail: {
    fontSize: '1rem',
    color: '#475569',
    margin: '0.25rem 0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: '0.5rem',
  },
  statLabel: {
    fontSize: '1rem',
    color: '#64748b',
    fontWeight: '500',
  },
  actions: {
    marginBottom: '2rem',
  },
  primaryButton: {
    padding: '0.8rem 1.6rem',
    backgroundColor: '#1e3a8a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '1rem',
    transition: 'background-color 0.2s',
  },
  secondaryButton: {
    padding: '0.6rem 1.2rem',
    backgroundColor: '#64748b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '0.9rem',
    marginTop: '1rem',
  },
  card: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 1.5rem 0',
  },
  tableContainer: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    padding: '1rem',
    textAlign: 'left' as const,
    backgroundColor: '#f8fafc',
    fontWeight: '600',
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '0.9rem',
  },
  td: {
    padding: '1rem',
    borderBottom: '1px solid #e2e8f0',
    color: '#1e293b',
  },
  leaveType: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    fontSize: '0.9rem',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'white',
  },
  rejectionReason: {
    fontSize: '0.85rem',
    color: '#ef4444',
    marginTop: '0.25rem',
  },
  noData: {
    textAlign: 'center' as const,
    padding: '3rem',
    color: '#94a3b8',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 1.5rem 0',
  },
  formGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
    backgroundColor: 'white',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  hint: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '0.25rem',
    display: 'block',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  submitButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#1e3a8a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  cancelButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
};

// Add this to your global CSS or in a style tag
const globalStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// If you need to add the global styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = globalStyles;
  document.head.appendChild(style);
}