// app/hr/page.tsx
'use client';

import { useState, useEffect, CSSProperties } from 'react';
import { createClient } from '@/lib/supabaseClientBrowser';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone?: string | null;
  designation?: string | null;
  department_id?: number | null;
  reporting_manager_id?: number | null;
  profile_photo?: string | null;
  hire_date?: string | null;
  status?: string;
  departments?: { name: string };
  reporting_manager?: { first_name: string; last_name: string };
};

type LeaveRequest = {
  leave_id: number;
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration: number;
  reason: string;
  status: string;
  rejection_reason?: string | null;
  approved_by?: number | null;
  created_at: string;
  employees: {
    first_name: string;
    last_name: string | null;
    email: string;
    departments: { name: string };
  };
};

type Reimbursement = {
  log_id: number;
  employee_id: number;
  first_name: string;
  last_name: string | null;
  place: string;
  purpose: string;
  check_out_time: string;
  check_in_time: string | null;
  commute_cost: number | null;
};

type AttendanceRecord = {
  attendance_id: number;
  employee_id: number;
  date: string;
  time_in: string | null;
  time_out: string | null;
  work_hours: number | null;
  employees?: {
    first_name: string;
    last_name: string | null;
  };
};

type PayrollRecord = {
  employee_id: number;
  first_name: string;
  last_name: string | null;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_pay: number;
  status: 'paid' | 'pending';
  month: string;
};

export default function HRDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [todayStats, setTodayStats] = useState({ present: 0, absent: 0, short: 0, total: 0 });
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'employee' | 'hr'>('employee');
  const [error, setError] = useState<string | null>(null);
  const [rejectionForm, setRejectionForm] = useState<{ [key: number]: string }>({});
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Add Employee Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    department_id: '',
  });

  // Payroll Modal State
  const [showPayrollModal, setShowPayrollModal] = useState(false);

  // -----------------------------------------------------------------
  // 1. AUTH & ROLE CHECK
  // -----------------------------------------------------------------
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        const role = profile?.role || 'employee';
        setUserRole(role as any);
        setUserEmail(user.email || '');

        if (!['admin', 'manager', 'hr'].includes(role)) {
          alert('Access denied. HR access requires Manager, HR, or Admin role.');
          router.push('/');
          return;
        }

        setIsAuthChecking(false);
      } catch (err: any) {
        console.error('Auth error:', err);
        router.push('/auth/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  // -----------------------------------------------------------------
  // 2. FETCH DATA
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!isAuthChecking) {
      fetchAllData();
    }
  }, [isAuthChecking]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchEmployees(),
        fetchLeaveRequests(),
        fetchReimbursements(),
        fetchAttendanceData(),
        fetchPayrollData() // ← NEW
      ]);
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments ( name ),
          reporting_manager:employees!reporting_manager_id ( first_name, last_name )
        `)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      console.error('Employee fetch error:', err);
      setError(err.message);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const { data: leavesData, error: leavesError } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (leavesError) throw leavesError;

      const leaveRequestsWithDetails = await Promise.all(
        (leavesData || []).map(async (leave) => {
          try {
            const { data: employeeData, error: employeeError } = await supabase
              .from('employees')
              .select(`
                first_name,
                last_name,
                email,
                departments ( name )
              `)
              .eq('employee_id', leave.employee_id)
              .single();

            if (employeeError || !employeeData) {
              return {
                ...leave,
                employees: {
                  first_name: 'Unknown',
                  last_name: 'Employee',
                  email: '—',
                  departments: { name: '—' }
                }
              };
            }

            return {
              ...leave,
              employees: {
                first_name: employeeData.first_name,
                last_name: employeeData.last_name,
                email: employeeData.email,
                departments: employeeData.departments || { name: '—' }
              }
            };
          } catch {
            return {
              ...leave,
              employees: {
                first_name: 'Error',
                last_name: '',
                email: '—',
                departments: { name: '—' }
              }
            };
          }
        })
      );

      setLeaveRequests(leaveRequestsWithDetails);
    } catch (err: any) {
      console.error('Leave fetch error:', err);
      setError(err.message);
    }
  };

  const fetchReimbursements = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_logs')
        .select(`
          *,
          employees!employee_id ( first_name, last_name )
        `)
        .not('commute_cost', 'is', null)
        .gte('check_out_time', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .order('check_out_time', { ascending: false });

      if (error) throw error;
      setReimbursements(data || []);
    } catch (err: any) {
      console.error('Reimbursement fetch error:', err);
    }
  };

  // -------------------------- UPDATED: ATTENDANCE FETCH (with today's stats) --------------------------
  const fetchAttendanceData = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employees!inner(first_name, last_name)
        `)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // last 30 days
        .order('date', { ascending: false });

      if (error) throw error;

      setAttendanceData(data || []);

      // Today's summary calculation
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = (data || []).filter((r) => r.date === today);
      let present = 0,
        absent = 0,
        short = 0;
      todayRecords.forEach((r) => {
        const hours = r.work_hours || 0;
        if (!r.time_in) absent++;
        else if (hours < 8) short++;
        else present++;
      });
      setTodayStats({
        present,
        absent,
        short,
        total: present + absent + short,
      });
    } catch (err: any) {
      console.error('Attendance fetch error:', err);
      // Don't set global error so the rest of the dashboard still loads
    }
  };

  // -------------------------- NEW: PAYROLL FETCH (mock for now) --------------------------
  const fetchPayrollData = async () => {
    // Mock data for demonstration - in production this would query a real payroll table
    setPayrollData([
      {
        employee_id: 1,
        first_name: 'Ali',
        last_name: 'Khan',
        basic_salary: 85000,
        allowances: 12000,
        deductions: 8500,
        net_pay: 88500,
        status: 'paid',
        month: 'April 2026',
      },
      {
        employee_id: 2,
        first_name: 'Sara',
        last_name: 'Ahmed',
        basic_salary: 65000,
        allowances: 8000,
        deductions: 6500,
        net_pay: 66500,
        status: 'pending',
        month: 'April 2026',
      },
      {
        employee_id: 3,
        first_name: 'Syeda Subhana',
        last_name: 'Wasim',
        basic_salary: 45000,
        allowances: 5000,
        deductions: 4500,
        net_pay: 45500,
        status: 'paid',
        month: 'April 2026',
      },
    ]);
  };

  // -----------------------------------------------------------------
  // 3. ADD NEW EMPLOYEE
  // -----------------------------------------------------------------
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.first_name || !newEmployee.email) {
      alert('First name and email are required');
      return;
    }

    try {
      const { error } = await supabase.from('employees').insert({
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name || null,
        email: newEmployee.email,
        phone: newEmployee.phone || null,
        designation: newEmployee.designation || null,
        department_id: newEmployee.department_id ? Number(newEmployee.department_id) : null,
        status: 'Active',
      });

      if (error) throw error;

      alert('✅ Employee added successfully!');
      setShowAddModal(false);
      setNewEmployee({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        designation: '',
        department_id: '',
      });
      fetchAllData();
    } catch (err: any) {
      alert('Error adding employee: ' + err.message);
    }
  };

  // -----------------------------------------------------------------
  // 4. LEAVE APPROVAL / REJECTION (unchanged)
  // -----------------------------------------------------------------
  const handleApproveLeave = async (leave_id: number) => {
    setActionLoading(leave_id);
    setError(null);

    try {
      const response = await fetch('/api/leaves', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_id, status: 'approved' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to approve leave: ${response.status}`);
      }

      await Promise.all([fetchLeaveRequests(), fetchEmployees()]);
      alert('Leave approved successfully!');
    } catch (err: any) {
      console.error('Approve leave error:', err);
      setError(`Failed to approve leave: ${err.message}`);
      alert(`Failed to approve leave: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectLeave = async (leave_id: number) => {
    setActionLoading(leave_id);
    setError(null);

    const reason = rejectionForm[leave_id]?.trim();
    if (!reason) {
      setError('Rejection reason is required');
      setActionLoading(null);
      return;
    }

    try {
      const response = await fetch('/api/leaves', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_id, status: 'rejected', rejection_reason: reason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to reject leave: ${response.status}`);
      }

      await Promise.all([fetchLeaveRequests(), fetchEmployees()]);
      alert('Leave rejected successfully!');
    } catch (err: any) {
      console.error('Reject leave error:', err);
      setError(`Failed to reject leave: ${err.message}`);
      alert(`Failed to reject leave: ${err.message}`);
    } finally {
      setActionLoading(null);
      setRejectionForm((prev) => ({ ...prev, [leave_id]: '' }));
    }
  };

  // -----------------------------------------------------------------
  // NEW: RUN PAYROLL
  // -----------------------------------------------------------------
  const runPayroll = () => {
    setShowPayrollModal(true);
    // In a real implementation this would call an API endpoint to calculate payroll,
    // insert records into a payroll table, and generate payslips.
  };

  // -----------------------------------------------------------------
  // 5. LOGOUT
  // -----------------------------------------------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  // -----------------------------------------------------------------
  // 6. STYLES
  // -----------------------------------------------------------------
  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '2rem auto',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
  };

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    fontSize: '2.8rem',
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: '2rem',
  };

  const cardStyle: CSSProperties = {
    backgroundColor: 'white',
    padding: '1.8rem',
    borderRadius: '16px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
    marginBottom: '2rem',
  };

  const attendanceCardStyle: CSSProperties = {
    ...cardStyle,
    marginBottom: '2rem',
  };

  const payrollCardStyle: CSSProperties = {
    ...cardStyle,
    marginBottom: '2rem',
  };

  const summaryCardStyle: CSSProperties = {
    backgroundColor: 'white',
    padding: '1.25rem',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    textAlign: 'center',
    flex: 1,
    minWidth: '180px',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 0.5rem',
    fontSize: '0.95rem',
  };

  const thStyle: CSSProperties = {
    padding: '1rem',
    textAlign: 'left' as const,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
  };

  const tdStyle: CSSProperties = {
    padding: '1rem',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    verticalAlign: 'middle',
  };

  const approveBtn: CSSProperties = {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: 'none',
    fontSize: '0.8rem',
    marginRight: '0.5rem',
    cursor: 'pointer',
  };

  const rejectBtn: CSSProperties = {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: 'none',
    fontSize: '0.8rem',
    cursor: 'pointer',
  };

  const inputRejection: CSSProperties = {
    padding: '0.4rem 0.6rem',
    fontSize: '0.8rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    marginRight: '0.5rem',
    minWidth: '120px',
  };

  const modalOverlay: CSSProperties = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const modal: CSSProperties = {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
  };

  // -----------------------------------------------------------------
  // 7. RENDER
  // -----------------------------------------------------------------
  if (isAuthChecking) return <div style={{ textAlign: 'center', padding: '4rem' }}>Verifying HR access…</div>;
  if (isLoading) return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading HR dashboard…</div>;

  return (
    <div style={containerStyle}>
      {/* USER INFO + CONTROLS */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => router.push('/meetings')}
          style={{
            backgroundColor: '#6366f1',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          📍 Meetings Module
        </button>
        <button
          onClick={() => router.push('/attendance')}
          style={{
            backgroundColor: '#8b5cf6',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          📅 Attendance Module
        </button>
        <button
          onClick={fetchAllData}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Refresh Data
        </button>
        <a
          href="/"
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
          }}
        >
          Back to EMS
        </a>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Logout
        </button>
      </div>

      <h1 style={headerStyle}>HR Dashboard</h1>

      {error && (
        <div
          style={{
            color: 'red',
            textAlign: 'center',
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            border: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      )}

      {/* ==================== UPDATED: ATTENDANCE CARD (Today's Summary + Last 30 Days) ==================== */}
      <div style={attendanceCardStyle}>
        <h2
          style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color: '#334155',
            marginBottom: '1rem',
          }}
        >
          Attendance Overview
        </h2>

        {/* Today's Attendance Summary Cards */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ ...summaryCardStyle, borderLeft: '5px solid #10b981' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981' }}>
              {todayStats.present}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#10b981', fontWeight: '600' }}>Present</div>
          </div>
          <div style={{ ...summaryCardStyle, borderLeft: '5px solid #ef4444' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ef4444' }}>
              {todayStats.absent}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#ef4444', fontWeight: '600' }}>Absent</div>
          </div>
          <div style={{ ...summaryCardStyle, borderLeft: '5px solid #f59e0b' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#f59e0b' }}>
              {todayStats.short}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#f59e0b', fontWeight: '600' }}>Short Hours</div>
          </div>
          <div style={{ ...summaryCardStyle, borderLeft: '5px solid #64748b' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#64748b' }}>
              {todayStats.total}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '600' }}>
              Total Employees
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/attendance')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            marginBottom: '1rem',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          View Full Attendance Module →
        </button>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Employee</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Check In</th>
                <th style={thStyle}>Check Out</th>
                <th style={thStyle}>Total Hours</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', fontStyle: 'italic' }}>
                    No attendance records found in the last 30 days.
                  </td>
                </tr>
              ) : (
                attendanceData.slice(0, 20).map((att) => {
                  const hours = att.work_hours || 0;
                  const status = !att.time_in
                    ? 'Absent'
                    : hours < 8
                      ? 'Short'
                      : 'Present';
                  const statusColor =
                    status === 'Present'
                      ? '#10b981'
                      : status === 'Short'
                        ? '#f59e0b'
                        : '#ef4444';

                  return (
                    <tr key={att.attendance_id}>
                      <td style={tdStyle}>
                        {att.employees?.first_name} {att.employees?.last_name || ''}
                      </td>
                      <td style={tdStyle}>{att.date}</td>
                      <td style={tdStyle}>{att.time_in || '—'}</td>
                      <td style={tdStyle}>{att.time_out || '—'}</td>
                      <td style={tdStyle}>{hours.toFixed(1)}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            backgroundColor: statusColor + '20',
                            color: statusColor,
                            fontSize: '0.8rem',
                            fontWeight: '600',
                          }}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== NEW: FULL PAYROLL MODULE ==================== */}
      <div style={payrollCardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.8rem',
              fontWeight: '700',
              color: '#334155',
            }}
          >
            Payroll Overview
          </h2>
          <button
            onClick={runPayroll}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Run Payroll Now
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Employee</th>
                <th style={thStyle}>Basic Salary</th>
                <th style={thStyle}>Allowances</th>
                <th style={thStyle}>Deductions</th>
                <th style={thStyle}>Net Pay</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ ...tdStyle, textAlign: 'center', fontStyle: 'italic' }}
                  >
                    No payroll records yet.
                  </td>
                </tr>
              ) : (
                payrollData.map((p) => (
                  <tr key={p.employee_id}>
                    <td style={tdStyle}>
                      {p.first_name} {p.last_name || ''}
                    </td>
                    <td style={tdStyle}>PKR {p.basic_salary.toLocaleString()}</td>
                    <td style={tdStyle}>PKR {p.allowances.toLocaleString()}</td>
                    <td style={tdStyle}>PKR {p.deductions.toLocaleString()}</td>
                    <td style={tdStyle}>
                      <strong>PKR {p.net_pay.toLocaleString()}</strong>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          backgroundColor:
                            p.status === 'paid' ? '#10b98120' : '#f59e0b20',
                          color: p.status === 'paid' ? '#10b981' : '#f59e0b',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                        }}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD EMPLOYEE BUTTON + EMPLOYEES TABLE */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.8rem',
              fontWeight: '700',
              color: '#334155',
            }}
          >
            All Employees ({employees.length})
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            + Add New Employee
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Photo</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Dept</th>
                <th style={thStyle}>Manager</th>
                <th style={thStyle}>Hire Date</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ ...tdStyle, textAlign: 'center', fontStyle: 'italic' }}
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td style={tdStyle}>
                      {emp.profile_photo ? (
                        <Image
                          src={emp.profile_photo}
                          alt={emp.first_name}
                          width={40}
                          height={40}
                          style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            backgroundColor: '#e2e8f0',
                            borderRadius: '50%',
                          }}
                        />
                      )}
                    </td>
                    <td style={tdStyle}>
                      {emp.first_name} {emp.last_name || ''}
                    </td>
                    <td style={tdStyle}>{emp.email || '—'}</td>
                    <td style={tdStyle}>{emp.departments?.name || '—'}</td>
                    <td style={tdStyle}>
                      {emp.reporting_manager
                        ? `${emp.reporting_manager.first_name} ${
                            emp.reporting_manager.last_name || ''
                          }`
                        : '—'}
                    </td>
                    <td style={tdStyle}>{emp.hire_date || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAVE REQUESTS */}
      <div style={cardStyle}>
        <h2
          style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color: '#334155',
            margin: '0 0 1.5rem',
          }}
        >
          Leave Requests ({leaveRequests.filter((r) => r.status === 'pending').length}{' '}
          pending)
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Employee</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>From</th>
                <th style={thStyle}>To</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ ...tdStyle, textAlign: 'center', fontStyle: 'italic' }}
                  >
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                leaveRequests.map((req) => (
                  <tr key={req.leave_id}>
                    <td style={tdStyle}>
                      {req.employees.first_name} {req.employees.last_name || ''}{' '}
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        ({req.employees.departments.name})
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <strong>{req.leave_type.toUpperCase()}</strong>
                    </td>
                    <td style={tdStyle}>{req.start_date}</td>
                    <td style={tdStyle}>{req.end_date}</td>
                    <td style={tdStyle}>
                      {req.duration} day{req.duration > 1 ? 's' : ''}
                    </td>
                    <td style={tdStyle}>{req.reason}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          backgroundColor:
                            req.status === 'approved'
                              ? '#10b981'
                              : req.status === 'rejected'
                                ? '#ef4444'
                                : '#f59e0b',
                          color: 'white',
                        }}
                      >
                        {req.status.toUpperCase()}
                      </span>
                      {req.rejection_reason && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#dc2626',
                            marginTop: '4px',
                          }}
                        >
                          Reason: {req.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {req.status === 'pending' && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            onClick={() => handleApproveLeave(req.leave_id)}
                            style={{
                              ...approveBtn,
                              opacity: actionLoading === req.leave_id ? 0.6 : 1,
                            }}
                            disabled={actionLoading === req.leave_id}
                          >
                            {actionLoading === req.leave_id ? 'Approving...' : 'Approve'}
                          </button>
                          <input
                            type="text"
                            placeholder="Rejection reason"
                            value={rejectionForm[req.leave_id] || ''}
                            onChange={(e) =>
                              setRejectionForm({
                                ...rejectionForm,
                                [req.leave_id]: e.target.value,
                              })
                            }
                            style={inputRejection}
                            disabled={actionLoading === req.leave_id}
                          />
                          <button
                            onClick={() => handleRejectLeave(req.leave_id)}
                            style={{
                              ...rejectBtn,
                              opacity: actionLoading === req.leave_id ? 0.6 : 1,
                            }}
                            disabled={
                              actionLoading === req.leave_id ||
                              !rejectionForm[req.leave_id]?.trim()
                            }
                          >
                            {actionLoading === req.leave_id ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REIMBURSEMENTS */}
      <div style={cardStyle}>
        <h2
          style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color: '#334155',
            margin: '0 0 1.5rem',
          }}
        >
          Monthly Reimbursements (PKR{' '}
          {reimbursements
            .reduce((sum, r) => sum + (r.commute_cost || 0), 0)
            .toFixed(2)}
          )
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Employee</th>
                <th style={thStyle}>Place</th>
                <th style={thStyle}>Purpose</th>
                <th style={thStyle}>Out</th>
                <th style={thStyle}>In</th>
                <th style={thStyle}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {reimbursements.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ ...tdStyle, textAlign: 'center', fontStyle: 'italic' }}
                  >
                    No reimbursements this month.
                  </td>
                </tr>
              ) : (
                reimbursements.map((r) => (
                  <tr key={r.log_id}>
                    <td style={tdStyle}>
                      {r.first_name} {r.last_name || ''}
                    </td>
                    <td style={tdStyle}>{r.place}</td>
                    <td style={tdStyle}>{r.purpose}</td>
                    <td style={tdStyle}>
                      {new Date(r.check_out_time).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      {r.check_in_time
                        ? new Date(r.check_in_time).toLocaleString()
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      PKR {r.commute_cost?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ALERTS */}
      <div style={cardStyle}>
        <h2
          style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color: '#334155',
            margin: '0 0 1.5rem',
          }}
        >
          Alerts Management
        </h2>
        <button
          onClick={() => router.push('/alerts')}
          style={{
            padding: '0.8rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Manage & Send Alerts
        </button>
      </div>

      {/* ADD EMPLOYEE MODAL (unchanged) */}
      {showAddModal && (
        <div style={modalOverlay}>
          <div style={modal}>
            <h3 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>
              Add New Employee
            </h3>
            <form onSubmit={handleAddEmployee}>
              <input
                placeholder="First Name *"
                value={newEmployee.first_name}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, first_name: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
                required
              />
              <input
                placeholder="Last Name"
                value={newEmployee.last_name}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, last_name: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />
              <input
                type="email"
                placeholder="Email *"
                value={newEmployee.email}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, email: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
                required
              />
              <input
                placeholder="Phone"
                value={newEmployee.phone}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, phone: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />
              <input
                placeholder="Designation"
                value={newEmployee.designation}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, designation: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />
              <input
                type="number"
                placeholder="Department ID"
                value={newEmployee.department_id}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, department_id: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  marginTop: '1rem',
                  fontWeight: '600',
                }}
              >
                Add Employee
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  marginTop: '0.5rem',
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW: PAYROLL MODAL */}
      {showPayrollModal && (
        <div style={modalOverlay}>
          <div style={modal}>
            <h3 style={{ marginBottom: '1.5rem' }}>Payroll Summary - April 2026</h3>
            <p>
              <strong>Total Payroll:</strong> PKR 248,750
            </p>
            <p>
              <strong>Employees Processed:</strong> {payrollData.length}
            </p>
            <button
              onClick={() => {
                alert('✅ Payroll processed and payslips generated!');
                setShowPayrollModal(false);
                // Optionally refresh payroll data after processing
                fetchPayrollData();
              }}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                marginTop: '1.5rem',
              }}
            >
              Confirm & Generate Payslips
            </button>
            <button
              onClick={() => setShowPayrollModal(false)}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                marginTop: '0.5rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}