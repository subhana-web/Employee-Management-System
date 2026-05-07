// app/leaves/page.tsx
'use client';

import { useState, useEffect, CSSProperties } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@/lib/supabaseClientBrowser';
import { useRouter } from 'next/navigation';

type LeaveRequest = {
  leave_id: number;
  employee_id: number;
  leave_type: 'full-day' | 'half-day';
  start_date: string;
  end_date: string;
  duration: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_at: string;
};

export default function LeavesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    leave_type: 'full-day' as 'full-day' | 'half-day',
    start_date: '',
    end_date: '',
    reason: ''
  });

  // -----------------------------------------------------------------
  // 1. AUTH CHECK & GET EMPLOYEE ID
  // -----------------------------------------------------------------
  useEffect(() => {
    const checkSessionAndEmployee = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      setUserEmail(data.session.user.email || '');
      
      // Fetch employee_id - use .maybeSingle() to handle no results gracefully
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('email', data.session.user.email)
        .maybeSingle();

      if (empError) {
        console.error('Error fetching employee:', empError);
        setError('Error loading employee data. Please contact HR.');
        setIsAuthLoading(false);
        return;
      }

      if (!empData) {
        setError('Employee record not found. Please contact HR to add you to the system. Your email: ' + data.session.user.email);
        setIsAuthLoading(false);
        return;
      }

      setEmployeeId(empData.employee_id);
      setIsAuthLoading(false);
    };
    checkSessionAndEmployee();
  }, [router, supabase]);

  // -----------------------------------------------------------------
  // 2. FETCH LEAVE REQUESTS (via API)
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!isAuthLoading && employeeId) {
      fetchLeaveRequests();
    }
  }, [isAuthLoading, employeeId]);

  const fetchLeaveRequests = async () => {
    try {
      const res = await fetch('/api/leaves', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLeaveRequests(data);
    } catch (err: any) {
      console.error('Error fetching leaves:', err);
      setError('Failed to load leave requests');
    }
  };

  // -----------------------------------------------------------------
  // 3. SUBMIT LEAVE REQUEST (via API)
  // -----------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!form.start_date || !form.reason) {
      setError('Start date and reason are required');
      setLoading(false);
      return;
    }

    if (!employeeId) {
      setError('Employee ID not found. Please refresh and try again.');
      setLoading(false);
      return;
    }

    // Calculate duration (keep as is; client-side for quick feedback)
    const startDate = new Date(form.start_date);
    const endDate = form.end_date ? new Date(form.end_date) : startDate;
    
    if (endDate < startDate) {
      setError('End date cannot be before start date');
      setLoading(false);
      return;
    }

    const baseDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const duration = baseDuration;

    // 24-hour rule (client-side for UX; server enforces too)
    if (form.leave_type === 'full-day') {
      const now = new Date();
      const hoursDiff = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        setError('Full-day leave must be requested at least 24 hours in advance');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          reason: form.reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit leave request');
      }

      setSuccess('Leave request submitted successfully!');
      setForm({
        leave_type: 'full-day',
        start_date: '',
        end_date: '',
        reason: ''
      });
      
      // Refresh the list
      fetchLeaveRequests();
    } catch (err: any) {
      console.error('Error submitting leave:', err);
      setError(err.message || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // 4. LOGOUT
  // -----------------------------------------------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  // -----------------------------------------------------------------
  // 5. STYLES
  // -----------------------------------------------------------------
  const containerStyle: CSSProperties = {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
  };

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    fontSize: '2.8rem',
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: '2.5rem'
  };

  const cardStyle: CSSProperties = {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
    marginBottom: '3rem'
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0',
  };

  const thStyle: CSSProperties = {
    padding: '1rem',
    textAlign: 'left' as const,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    borderBottom: '2px solid #e2e8f0',
  };

  const tdStyle: CSSProperties = {
    padding: '1rem',
    borderBottom: '1px solid #e2e8f0',
  };

  if (isAuthLoading) return <div>Loading...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>My Leaves</h1>
      <button onClick={handleLogout}>Logout</button>

      {/* LEAVE FORM */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#334155', margin: '0 0 1.5rem' }}>
          Apply for Leave
        </h2>
        
        {error && (
          <div style={{ 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca', 
            color: '#dc2626', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem' 
          }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ 
            backgroundColor: '#f0fdf4', 
            border: '1px solid #bbf7d0', 
            color: '#16a34a', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem' 
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
              Leave Type *
            </label>
            <select 
              value={form.leave_type} 
              onChange={e => setForm({ ...form, leave_type: e.target.value as 'full-day' | 'half-day' })}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              required
            >
              <option value="full-day">Full Day</option>
              <option value="half-day">Half Day</option>
            </select>
            <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              {form.leave_type === 'full-day' 
                ? 'Must be requested 24 hours in advance' 
                : 'Can be requested anytime'}
            </small>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
              Start Date *
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
              End Date (optional)
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              min={form.start_date}
            />
            <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              Leave blank for single day leave
            </small>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
              Reason *
            </label>
            <textarea
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              placeholder="Please provide a reason for your leave..."
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', minHeight: '80px', resize: 'vertical' }}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              gridColumn: '1 / -1', 
              padding: '0.9rem', 
              backgroundColor: loading ? '#9ca3af' : '#6366f1', 
              color: 'white', 
              border: 'none', 
              borderRadius: '12px', 
              fontWeight: '600', 
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </form>
      </div>

      {/* LEAVE HISTORY */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#334155', margin: '0 0 1.5rem' }}>
          My Leave History ({leaveRequests.length})
        </h2>

        {leaveRequests.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
            No leave requests found.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Start Date</th>
                  <th style={thStyle}>End Date</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Applied On</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.leave_id}>
                    <td style={tdStyle}>
                      <strong>{request.leave_type.toUpperCase()}</strong>
                    </td>
                    <td style={tdStyle}>{request.start_date}</td>
                    <td style={tdStyle}>{request.end_date}</td>
                    <td style={tdStyle}>{request.duration} day{request.duration > 1 ? 's' : ''}</td>
                    <td style={tdStyle}>{request.reason}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          backgroundColor:
                            request.status === 'approved'
                              ? '#10b981'
                              : request.status === 'rejected'
                              ? '#ef4444'
                              : '#f59e0b',
                          color: 'white',
                        }}
                      >
                        {request.status.toUpperCase()}
                      </span>
                      {request.rejection_reason && (
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                          Reason: {request.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {new Date(request.created_at).toLocaleDateString()}
                    </td>
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