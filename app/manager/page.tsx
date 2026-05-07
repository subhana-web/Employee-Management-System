// app/manager/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type LeaveRequest = {
  leave_id: number;
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration: number;
  reason: string;
  status: string;
  created_at: string;
  employees: {
    first_name: string;
    last_name: string;
    email: string;
    department_id: number;
  };
};

type Department = {
  department_id: number;
  name: string;
};

export default function ManagerDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [rejectionReason, setRejectionReason] = useState<{ [key: number]: string }>({});
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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
        .select('role, department_id')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'manager') {
        alert('Access denied. Manager access only.');
        router.push('/auth/login');
        return;
      }

      const { data: dept } = await supabase
        .from('departments')
        .select('*')
        .eq('department_id', profile.department_id)
        .single();

      setDepartment(dept);

      fetchTeamMembers(profile.department_id);
      fetchPendingLeaves(profile.department_id);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (departmentId: number) => {
    try {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('department_id', departmentId);
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const fetchPendingLeaves = async (departmentId: number) => {
    try {
      const { data } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employees!inner(*)
        `)
        .eq('employees.department_id', departmentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingLeaves(data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  const handleApprove = async (leaveId: number) => {
    setActionLoading(leaveId);
    try {
      const response = await fetch('/api/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_id: leaveId, status: 'approved' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      fetchPendingLeaves(department!.department_id);
    } catch (error) {
      alert('Error approving leave');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (leaveId: number) => {
    const reason = rejectionReason[leaveId]?.trim();
    if (!reason) {
      alert('Please provide a rejection reason');
      return;
    }
    setActionLoading(leaveId);
    try {
      const response = await fetch('/api/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leave_id: leaveId, 
          status: 'rejected', 
          rejection_reason: reason 
        }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      setRejectionReason({ ...rejectionReason, [leaveId]: '' });
      fetchPendingLeaves(department!.department_id);
    } catch (error) {
      alert('Error rejecting leave');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Manager Dashboard</h1>
          <p style={styles.subtitle}>Department: {department?.name || 'Loading...'}</p>
        </div>
     <div style={{ display: 'flex', gap: '1rem' }}>
  <button
    onClick={() => router.push('/meetings')}
    style={{
      padding: '0.5rem 1rem',
      backgroundColor: '#6366f1',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: '600',
    }}
  >
    📍 Team Meetings
  </button>
  <button onClick={() => router.push('/manager/productivity')} style={styles.productivityButton}>
    Productivity Tracker
  </button>
  <button onClick={handleLogout} style={styles.logoutButton}>
    Logout
  </button>
</div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <h3 style={styles.statValue}>{teamMembers.length}</h3>
          <p style={styles.statLabel}>Team Members</p>
        </div>
        <div style={styles.statCard}>
          <h3 style={styles.statValue}>{pendingLeaves.length}</h3>
          <p style={styles.statLabel}>Pending Requests</p>
        </div>
      </div>

      {/* Pending Leave Requests */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Pending Leave Requests</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Employee</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Start Date</th>
                <th style={styles.th}>End Date</th>
                <th style={styles.th}>Duration</th>
                <th style={styles.th}>Reason</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.noData}>No pending requests</td>
                </tr>
              ) : (
                pendingLeaves.map((leave) => (
                  <tr key={leave.leave_id}>
                    <td style={styles.td}>
                      {leave.employees?.first_name} {leave.employees?.last_name}
                    </td>
                    <td style={styles.td}>{leave.leave_type}</td>
                    <td style={styles.td}>{leave.start_date}</td>
                    <td style={styles.td}>{leave.end_date}</td>
                    <td style={styles.td}>{leave.duration} days</td>
                    <td style={styles.td}>{leave.reason}</td>
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button
                          onClick={() => handleApprove(leave.leave_id)}
                          disabled={actionLoading === leave.leave_id}
                          style={styles.approveButton}
                        >
                          Approve
                        </button>
                        <input
                          type="text"
                          placeholder="Rejection reason"
                          value={rejectionReason[leave.leave_id] || ''}
                          onChange={(e) => setRejectionReason({
                            ...rejectionReason,
                            [leave.leave_id]: e.target.value
                          })}
                          style={styles.rejectionInput}
                        />
                        <button
                          onClick={() => handleReject(leave.leave_id)}
                          disabled={actionLoading === leave.leave_id}
                          style={styles.rejectButton}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Members */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>My Team</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.noData}>No team members</td>
                </tr>
              ) : (
                teamMembers.map((member) => (
                  <tr key={member.employee_id}>
                    <td style={styles.td}>{member.first_name} {member.last_name}</td>
                    <td style={styles.td}>{member.email}</td>
                    <td style={styles.td}>{member.phone || '-'}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: member.status === 'active' ? '#10b981' : '#ef4444',
                        color: 'white'
                      }}>
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
  loading: {
    textAlign: 'center' as const,
    padding: '4rem',
    fontSize: '1.2rem',
    color: '#64748b',
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
  subtitle: {
    fontSize: '1rem',
    color: '#64748b',
    margin: '0.5rem 0 0 0',
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  productivityButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '600',
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
    fontSize: '2rem',
    fontWeight: '700',
    color: '#1e3a8a',
    margin: '0 0 0.5rem 0',
  },
  statLabel: {
    fontSize: '0.95rem',
    color: '#64748b',
    margin: 0,
  },
  card: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    marginBottom: '2rem',
  },
  cardTitle: {
    fontSize: '1.3rem',
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
    padding: '0.75rem',
    textAlign: 'left' as const,
    backgroundColor: '#f8fafc',
    fontWeight: '600',
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
  },
  td: {
    padding: '0.75rem',
    borderBottom: '1px solid #e2e8f0',
    color: '#1e293b',
  },
  noData: {
    padding: '2rem',
    textAlign: 'center' as const,
    color: '#94a3b8',
  },
  actionButtons: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  approveButton: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  rejectButton: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  rejectionInput: {
    padding: '0.25rem',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '0.85rem',
    width: '120px',
  },
  statusBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
};