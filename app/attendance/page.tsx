// app/attendance/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { CSSProperties } from 'react';

type AttendanceRecord = {
  attendance_id: number;
  date: string;
  time_in: string | null;
  time_out: string | null;
  work_hours: number | null;
  employees?: {
    first_name: string;
    last_name: string | null;
  };
};

export default function AttendancePage() {
  const supabase = createClient();
  const router = useRouter();

  const [isHR, setIsHR] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/auth/login');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || 'employee';
      const isHrRole = ['hr', 'manager', 'admin'].includes(role);
      setIsHR(isHrRole);

      if (isHrRole) {
        // HR View - All employees
        const { data, error } = await supabase
          .from('attendance')
          .select(`
            *,
            employees!inner(first_name, last_name)
          `)
          .gte('date', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (error) throw error;
        setAttendanceHistory(data || []);
      } else {
        // Employee View
        const { data: emp } = await supabase
          .from('employees')
          .select('employee_id')
          .eq('email', user.email)
          .single();

        if (!emp) throw new Error('Employee record not found');

        setEmployeeId(emp.employee_id);
        await Promise.all([
          fetchTodayRecord(emp.employee_id),
          fetchHistory(emp.employee_id)
        ]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayRecord = async (empId: number) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', empId)
      .eq('date', today)
      .single();
    setTodayRecord(data || null);
  };

  const fetchHistory = async (empId: number) => {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', empId)
      .order('date', { ascending: false })
      .limit(30);
    setAttendanceHistory(data || []);
  };

  const getCurrentTimeString = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  const calculateHours = (timeIn: string, timeOut: string): number => {
    if (!timeIn || !timeOut) return 0;
    const [h1, m1] = timeIn.split(':').map(Number);
    const [h2, m2] = timeOut.split(':').map(Number);
    const minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(0, minutes / 60);
  };

  const handleCheckIn = async () => {
    if (!employeeId) return;
    setCheckingIn(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const timeString = getCurrentTimeString();

      const { error } = await supabase
        .from('attendance')
        .upsert({ employee_id: employeeId, date: today, time_in: timeString }, { onConflict: 'employee_id,date' });

      if (error) throw error;
      await fetchTodayRecord(employeeId);
      alert('✅ Checked in successfully!');
    } catch (err: any) {
      setError('Check-in failed: ' + err.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!employeeId || !todayRecord?.attendance_id) return;
    setCheckingOut(true);
    setError(null);
    try {
      const timeString = getCurrentTimeString();
      const hoursWorked = todayRecord.time_in
        ? calculateHours(todayRecord.time_in, timeString)
        : 0;

      const { error } = await supabase
        .from('attendance')
        .update({ time_out: timeString, work_hours: hoursWorked })
        .eq('attendance_id', todayRecord.attendance_id);

      if (error) throw error;
      await fetchTodayRecord(employeeId);
      alert('✅ Checked out successfully!');
    } catch (err: any) {
      setError('Check-out failed: ' + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  // Compute employee metrics
  const employeeMetrics = useMemo(() => {
    if (isHR || attendanceHistory.length === 0) return null;
    let totalHours = 0;
    let presentDays = 0;
    for (const record of attendanceHistory) {
      const hours = record.work_hours ?? (record.time_in && record.time_out ? calculateHours(record.time_in, record.time_out) : 0);
      if (record.time_in) {
        presentDays++;
        totalHours += hours;
      }
    }
    return {
      totalHours: totalHours.toFixed(1),
      presentDays,
      averageHours: presentDays ? (totalHours / presentDays).toFixed(1) : '0',
    };
  }, [attendanceHistory, isHR]);

  // Compute HR metrics
  const hrMetrics = useMemo(() => {
    if (!isHR || attendanceHistory.length === 0) return null;
    const uniqueEmployees = new Set();
    let totalHours = 0;
    let presentRecords = 0;
    for (const record of attendanceHistory) {
      if (record.employees?.first_name) {
        uniqueEmployees.add(record.employees.first_name + (record.employees.last_name || ''));
      }
      const hours = record.work_hours ?? (record.time_in && record.time_out ? calculateHours(record.time_in, record.time_out) : 0);
      if (record.time_in) {
        presentRecords++;
        totalHours += hours;
      }
    }
    return {
      totalEmployees: uniqueEmployees.size,
      totalRecords: attendanceHistory.length,
      presentRecords,
      avgHours: presentRecords ? (totalHours / presentRecords).toFixed(1) : '0',
    };
  }, [attendanceHistory, isHR]);

  // Filter HR table data
  const filteredHistory = useMemo(() => {
    if (!isHR) return [];
    if (!searchTerm.trim()) return attendanceHistory;
    return attendanceHistory.filter(record => {
      const fullName = `${record.employees?.first_name || ''} ${record.employees?.last_name || ''}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase());
    });
  }, [attendanceHistory, searchTerm, isHR]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading Attendance Module...</p>
      </div>
    );
  }

  const hasCheckedIn = todayRecord?.time_in;
  const hasCheckedOut = todayRecord?.time_out;
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={styles.container}>
      {/* Global Styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .attendance-table-row:hover {
          background-color: #f8fafc !important;
          transition: background-color 0.2s ease;
        }
        .btn-back:hover {
          background-color: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px);
        }
        .check-in-btn:hover:not(:disabled) {
          background-color: #059669 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -6px rgba(16, 185, 129, 0.3);
        }
        .check-out-btn:hover:not(:disabled) {
          background-color: #dc2626 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -6px rgba(239, 68, 68, 0.3);
        }
        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.08);
          transition: all 0.25s ease;
        }
        .fade-in {
          animation: fadeInUp 0.4s ease-out;
        }
      `}</style>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            {isHR ? 'Team Attendance Dashboard' : 'My Attendance'}
          </h1>
          <p style={styles.subtitle}>
            {isHR 
              ? 'Monitor team attendance & work hours' 
              : `${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • ${currentTime}`}
          </p>
        </div>
        <button 
          onClick={() => router.push(isHR ? '/hr' : '/employee')} 
          style={styles.backButton}
          className="btn-back"
        >
          ← Back to Dashboard
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {isHR ? (
        // ====================== HR PROFESSIONAL VIEW ======================
        <div className="fade-in">
          {/* Metrics Row */}
          {hrMetrics && (
            <div style={styles.metricsGrid}>
              <div style={styles.metricCard} className="card-hover">
                <div style={styles.metricIcon}>👥</div>
                <div>
                  <div style={styles.metricValue}>{hrMetrics.totalEmployees}</div>
                  <div style={styles.metricLabel}>Active Employees</div>
                </div>
              </div>
              <div style={styles.metricCard} className="card-hover">
                <div style={styles.metricIcon}>📋</div>
                <div>
                  <div style={styles.metricValue}>{hrMetrics.totalRecords}</div>
                  <div style={styles.metricLabel}>Total Records</div>
                </div>
              </div>
              <div style={styles.metricCard} className="card-hover">
                <div style={styles.metricIcon}>✅</div>
                <div>
                  <div style={styles.metricValue}>{hrMetrics.presentRecords}</div>
                  <div style={styles.metricLabel}>Days Present</div>
                </div>
              </div>
              <div style={styles.metricCard} className="card-hover">
                <div style={styles.metricIcon}>⏱️</div>
                <div>
                  <div style={styles.metricValue}>{hrMetrics.avgHours}</div>
                  <div style={styles.metricLabel}>Avg Hours/Day</div>
                </div>
              </div>
            </div>
          )}

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Attendance Overview</h2>
                <p style={styles.cardSubtitle}>Last 60 days · All team members</p>
              </div>
              <div style={styles.searchWrapper}>
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
                <span style={styles.searchIcon}>🔍</span>
              </div>
            </div>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Check In</th>
                    <th style={styles.th}>Check Out</th>
                    <th style={styles.th}>Total Hours</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={6} style={styles.noData}>No attendance records found</td></tr>
                  ) : (
                    filteredHistory.map((r) => {
                      const hours = r.work_hours ?? (r.time_in && r.time_out ? calculateHours(r.time_in, r.time_out) : 0);
                      const status = !r.time_in ? 'Absent' : hours < 8 ? 'Short' : 'Present';
                      const statusColor = status === 'Present' ? '#10b981' : status === 'Short' ? '#f59e0b' : '#ef4444';
                      const initials = `${(r.employees?.first_name?.[0] || '')}${(r.employees?.last_name?.[0] || '')}`.toUpperCase();

                      return (
                        <tr key={r.attendance_id} className="attendance-table-row" style={styles.tableRow}>
                          <td style={styles.td}>
                            <div style={styles.employeeCell}>
                              <div style={{...styles.avatar, backgroundColor: `${statusColor}15`, color: statusColor}}>
                                {initials || 'U'}
                              </div>
                              <span style={styles.employeeName}>
                                {r.employees?.first_name} {r.employees?.last_name || ''}
                              </span>
                            </div>
                          </td>
                          <td style={styles.td}>{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                          <td style={styles.td}>{r.time_in || '—'}</td>
                          <td style={styles.td}>{r.time_out || '—'}</td>
                          <td style={styles.td}>{hours.toFixed(2)}</td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusBadge, backgroundColor: `${statusColor}10`, color: statusColor, borderLeftColor: statusColor }}>
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
        </div>
      ) : (
        // ====================== EMPLOYEE VIEW ======================
        <div className="fade-in">
          {/* Metrics Row */}
          {employeeMetrics && (
            <div style={styles.metricsGrid}>
              <div style={styles.metricCard} className="card-hover">
                <div style={styles.metricIcon}>📅</div>
                <div>
                  <div style={styles.metricValue}>{employeeMetrics.presentDays}</div>
                  <div style={styles.metricLabel}>Days Present</div>
                </div>
              </div>
              <div style={styles.metricCard} className="card-hover">
                <div style={styles.metricIcon}>⏱️</div>
                <div>
                  <div style={styles.metricValue}>{employeeMetrics.totalHours}</div>
                  <div style={styles.metricLabel}>Total Hours</div>
                </div>
              </div>
              <div style={styles.metricCard} className="card-hover">
                <div style={styles.metricIcon}>📊</div>
                <div>
                  <div style={styles.metricValue}>{employeeMetrics.averageHours}</div>
                  <div style={styles.metricLabel}>Avg Hours/Day</div>
                </div>
              </div>
            </div>
          )}

          <div style={styles.todayCard} className="card-hover">
            <div style={styles.todayHeader}>
              <div>
                <h2 style={styles.todayTitle}>Today's Attendance</h2>
                <p style={styles.todaySubtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </div>
              <div style={styles.timeWidget}>
                <span style={styles.timeIcon}>🕒</span>
                <span style={styles.currentTime}>{currentTime}</span>
              </div>
            </div>
            <div style={styles.todayContent}>
              {!hasCheckedIn ? (
                <button 
                  onClick={handleCheckIn} 
                  disabled={checkingIn} 
                  style={checkingIn ? {...styles.checkInButton, ...styles.buttonDisabled} : styles.checkInButton}
                  className="check-in-btn"
                >
                  {checkingIn ? (
                    <span style={styles.buttonLoading}>
                      <span style={styles.spinnerSmall}></span> Checking In...
                    </span>
                  ) : (
                    <>
                      <span style={styles.buttonIcon}>🟢</span> Check In Now
                    </>
                  )}
                </button>
              ) : hasCheckedOut ? (
                <div style={styles.checkedOutBadge}>
                  <span style={styles.badgeIcon}>✅</span> Completed · {todayRecord?.time_out ? `Checked out at ${todayRecord.time_out}` : 'Day finished'}
                </div>
              ) : (
                <button 
                  onClick={handleCheckOut} 
                  disabled={checkingOut} 
                  style={checkingOut ? {...styles.checkOutButton, ...styles.buttonDisabled} : styles.checkOutButton}
                  className="check-out-btn"
                >
                  {checkingOut ? (
                    <span style={styles.buttonLoading}>
                      <span style={styles.spinnerSmall}></span> Checking Out...
                    </span>
                  ) : (
                    <>
                      <span style={styles.buttonIcon}>🔴</span> Check Out Now
                    </>
                  )}
                </button>
              )}
            </div>
            {hasCheckedIn && !hasCheckedOut && (
              <div style={styles.checkInInfo}>
                <span style={styles.infoIcon}>⏰</span>
                Checked in at <strong>{todayRecord?.time_in}</strong> • Working in progress
              </div>
            )}
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>Recent Activity</h3>
                <p style={styles.cardSubtitle}>Last 30 days attendance history</p>
              </div>
              <span style={styles.badge}>30d history</span>
            </div>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Check In</th>
                    <th style={styles.th}>Check Out</th>
                    <th style={styles.th}>Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.length === 0 ? (
                    <tr><td colSpan={4} style={styles.noData}>No attendance records yet. Start by checking in!</td></tr>
                  ) : (
                    attendanceHistory.map((record) => {
                      const hours = record.work_hours ?? (record.time_in && record.time_out ? calculateHours(record.time_in, record.time_out) : 0);
                      return (
                        <tr key={record.attendance_id} className="attendance-table-row" style={styles.tableRow}>
                          <td style={styles.td}>{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td style={styles.td}>{record.time_in || '—'}</td>
                          <td style={styles.td}>{record.time_out || '—'}</td>
                          <td style={styles.td}>
                            <span style={hours >= 8 ? styles.hoursGood : hours > 0 ? styles.hoursWarn : styles.hoursNeutral}>
                              {hours.toFixed(2)}h
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
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: CSSProperties } = {
  container: { 
    maxWidth: '1440px', 
    margin: '0 auto', 
    padding: '2rem 1.5rem', 
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
    backgroundColor: '#f8fafc', 
    minHeight: '100vh' 
  },
  header: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
 title: { 
  fontSize: '2rem', 
  fontWeight: '700', 
  margin: 0,
  letterSpacing: '-0.02em',
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent'
},
  subtitle: { 
    color: '#64748b', 
    fontSize: '0.9rem', 
    marginTop: '0.25rem',
    fontWeight: '400'
  },
  
  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '1rem'
  },
  spinner: {
    width: '44px',
    height: '44px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  spinnerSmall: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    marginRight: '8px'
  },

  // Cards & Metrics
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  },
  metricCard: {
    backgroundColor: 'white',
    padding: '1.25rem',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
    transition: 'all 0.2s ease'
  },
  metricIcon: {
    fontSize: '2rem',
    lineHeight: 1
  },
  metricValue: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 1.2
  },
  metricLabel: {
    fontSize: '0.8rem',
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  },
  card: { 
    backgroundColor: 'white', 
    padding: '1.75rem', 
    borderRadius: '24px', 
    boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.02)', 
    border: '1px solid #f1f5f9',
    marginBottom: '2rem',
    transition: 'box-shadow 0.2s ease'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  cardTitle: { 
    fontSize: '1.35rem', 
    fontWeight: '600', 
    color: '#0f172a', 
    margin: 0,
    letterSpacing: '-0.01em'
  },
  cardSubtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '0.25rem'
  },
  badge: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    padding: '0.25rem 0.75rem',
    borderRadius: '40px',
    fontSize: '0.7rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  },

  // Today Card (Employee)
  todayCard: { 
    backgroundColor: 'white', 
    padding: '2rem', 
    borderRadius: '28px', 
    boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.06)', 
    border: '1px solid #f1f5f9',
    marginBottom: '2rem',
    transition: 'all 0.2s ease'
  },
  todayHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.75rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  todayTitle: { 
    fontSize: '1.4rem', 
    fontWeight: '600', 
    color: '#0f172a',
    margin: 0
  },
  todaySubtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '0.25rem'
  },
  timeWidget: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#f8fafc',
    padding: '0.5rem 1rem',
    borderRadius: '40px',
    border: '1px solid #e2e8f0'
  },
  timeIcon: {
    fontSize: '1rem'
  },
  currentTime: {
    fontWeight: '600',
    color: '#0f172a',
    fontSize: '0.9rem'
  },
  todayContent: {
    display: 'flex',
    justifyContent: 'center',
    margin: '1rem 0'
  },
  checkInInfo: {
    marginTop: '1.25rem',
    padding: '0.75rem',
    backgroundColor: '#fefce8',
    borderRadius: '16px',
    color: '#854d0e',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    border: '1px solid #fde047'
  },
  infoIcon: {
    fontSize: '1rem'
  },

  // Buttons
  backButton: { 
    padding: '0.5rem 1.25rem', 
    backgroundColor: '#ffffff', 
    color: '#334155', 
    border: '1px solid #e2e8f0', 
    borderRadius: '40px', 
    cursor: 'pointer', 
    fontWeight: '500',
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
  },
  checkInButton: { 
    padding: '1rem 2.5rem', 
    backgroundColor: '#10b981', 
    color: 'white', 
    border: 'none', 
    borderRadius: '60px', 
    fontSize: '1rem', 
    fontWeight: '600', 
    cursor: 'pointer',
    boxShadow: '0 6px 14px -4px rgba(16, 185, 129, 0.25)',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  checkOutButton: { 
    padding: '1rem 2.5rem', 
    backgroundColor: '#ef4444', 
    color: 'white', 
    border: 'none', 
    borderRadius: '60px', 
    fontSize: '1rem', 
    fontWeight: '600', 
    cursor: 'pointer',
    boxShadow: '0 6px 14px -4px rgba(239, 68, 68, 0.25)',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
    transform: 'none'
  },
  buttonIcon: {
    fontSize: '1.1rem'
  },
  buttonLoading: {
    display: 'flex',
    alignItems: 'center'
  },
  checkedOutBadge: { 
    padding: '0.75rem 2rem', 
    backgroundColor: '#ecfdf5', 
    color: '#047857', 
    borderRadius: '60px', 
    fontSize: '0.9rem', 
    fontWeight: '500', 
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #a7f3d0'
  },
  badgeIcon: {
    fontSize: '1rem'
  },

  // Table
  tableContainer: { 
    overflowX: 'auto',
    borderRadius: '16px',
  },
  table: { 
    width: '100%', 
    borderCollapse: 'separate', 
    borderSpacing: '0', 
    fontSize: '0.85rem',
  },
  th: { 
    padding: '0.85rem 1rem', 
    textAlign: 'left', 
    fontWeight: '600', 
    color: '#475569', 
    backgroundColor: '#fafbfc', 
    borderBottom: '1px solid #eef2f6',
    whiteSpace: 'nowrap',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  td: { 
    padding: '1rem 1rem', 
    backgroundColor: '#ffffff', 
    borderBottom: '1px solid #f1f5f9', 
    verticalAlign: 'middle',
    color: '#1e293b'
  },
  tableRow: {
    transition: 'background-color 0.15s ease',
  },
  employeeCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '0.75rem',
    backgroundColor: '#eef2ff'
  },
  employeeName: {
    fontWeight: '500',
    color: '#0f172a'
  },
  statusBadge: { 
    padding: '0.25rem 0.75rem', 
    borderRadius: '40px', 
    fontSize: '0.7rem', 
    fontWeight: '600',
    display: 'inline-block',
    borderLeft: '3px solid',
    textTransform: 'capitalize'
  },
  searchWrapper: {
    position: 'relative',
    display: 'inline-block'
  },
  searchInput: {
    padding: '0.5rem 2rem 0.5rem 1rem',
    borderRadius: '40px',
    border: '1px solid #e2e8f0',
    fontSize: '0.8rem',
    width: '200px',
    outline: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#fafbfc'
  },
  searchIcon: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '0.8rem',
    color: '#94a3b8'
  },
  noData: { 
    textAlign: 'center', 
    padding: '3rem', 
    color: '#94a3b8', 
    fontSize: '0.85rem',
    fontWeight: '400'
  },
  error: { 
    color: '#b91c1c', 
    backgroundColor: '#fef2f2', 
    padding: '0.85rem 1.25rem', 
    borderRadius: '16px', 
    marginBottom: '1.5rem',
    border: '1px solid #fecaca',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  hoursGood: {
    fontWeight: '600',
    color: '#10b981'
  },
  hoursWarn: {
    fontWeight: '600',
    color: '#f59e0b'
  },
  hoursNeutral: {
    fontWeight: '500',
    color: '#64748b'
  }
};