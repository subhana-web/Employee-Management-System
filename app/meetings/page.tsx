// app/meetings/page.tsx
'use client';

import { useState, useEffect, CSSProperties } from 'react';
import { createClient } from '@/lib/supabaseClientBrowser';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type MeetingLog = {
  log_id: number;
  place: string;
  purpose: string;
  check_out_time: string;
  check_in_time: string | null;
  commute_cost: number | null;
  employees: {                    // ← CHANGED: object (not array)
    first_name: string;
    last_name: string | null;
    profile_photo?: string | null;
  };
};

export default function MeetingModule() {
  const supabase = createClient();
  const router = useRouter();

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'employee' | 'hr'>('employee');
  const [logs, setLogs] = useState<MeetingLog[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [place, setPlace] = useState('');
  const [purpose, setPurpose] = useState('');
  const [transport, setTransport] = useState<'bike' | 'car' | ''>('');
  const [km, setKm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const calculatedCost = transport && km ? Number(km) * (transport === 'bike' ? 15 : 22) : 0;

  // -----------------------------------------------------------------
  // 1. AUTH CHECK
  // -----------------------------------------------------------------
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      setUserEmail(data.session.user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      const role = profile?.role || 'employee';
      setUserRole(role as any);

      setIsAuthChecking(false);
    };

    checkAuth();
  }, [router, supabase]);

  // -----------------------------------------------------------------
  // 2. FETCH LOGS
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!isAuthChecking) fetchLogs();
  }, [isAuthChecking]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/meetings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch meetings');
      const data: MeetingLog[] = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load meeting logs');
    }
  };

  // -----------------------------------------------------------------
  // 3. CHECK OUT
  // -----------------------------------------------------------------
  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place.trim() || !purpose.trim()) return;

    const commuteCost = transport && km ? calculatedCost : null;

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place: place.trim(),
          purpose: purpose.trim(),
          commute_cost: commuteCost,
        }),
      });

      if (!res.ok) throw new Error('Check-out failed');
      
      setPlace(''); setPurpose(''); setTransport(''); setKm('');
      setIsCheckingOut(false);
      fetchLogs();
    } catch (err: any) {
      alert(`Check-out failed: ${err.message}`);
    }
  };

  // -----------------------------------------------------------------
  // 4. CHECK IN
  // -----------------------------------------------------------------
  const handleCheckIn = async (logId: number) => {
    try {
      const res = await fetch('/api/meetings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId }),
      });

      if (!res.ok) throw new Error('Check-in failed');
      fetchLogs();
    } catch (err: any) {
      alert(`Check-in failed: ${err.message}`);
    }
  };

  // -----------------------------------------------------------------
  // 5. LOGOUT
  // -----------------------------------------------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  // -----------------------------------------------------------------
  // 6. STYLES (exactly the same as you had)
  // -----------------------------------------------------------------
  const containerStyle: CSSProperties = {
    maxWidth: '1000px',
    margin: '2rem auto',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
  };

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    fontSize: '2.5rem',
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

  if (isAuthChecking) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading…</div>;
  }

  return (
    <div style={containerStyle}>
      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <p style={{ margin: 0, fontWeight: '600' }}>
            Logged in as: {userEmail}{' '}
            <span style={{ color: '#6366f1' }}>[{userRole.toUpperCase()}]</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="/" style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '600' }}>
            Back to EMS
          </a>
          <button onClick={handleLogout} style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
            Logout
          </button>
        </div>
      </div>

      <h1 style={headerStyle}>Meeting Check-In / Check-Out</h1>
      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

{/* CHECK-OUT FORM - only for employees */}
{userRole === 'employee' ? (
  !isCheckingOut ? (
    <div style={cardStyle}>
      <button onClick={() => setIsCheckingOut(true)} style={{ padding: '0.75rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
        + Check Out for Meeting
      </button>
    </div>
  ) : (
    <div style={cardStyle}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#334155', margin: '0 0 1rem' }}>New Meeting Log</h2>
          <form onSubmit={handleCheckOut} style={{ display: 'grid', gap: '1rem' }}>
            {/* ... your existing form fields exactly as before ... */}
            <input type="text" placeholder="Meeting Place (e.g., Client Office, Cafe)" value={place} onChange={(e) => setPlace(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem' }} required />
            <input type="text" placeholder="Purpose (e.g., Client Discussion, Follow-up)" value={purpose} onChange={(e) => setPurpose(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem' }} required />
            <select value={transport} onChange={(e) => setTransport(e.target.value as 'bike' | 'car' | '')} style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem' }}>
              <option value="">Select Transport (optional)</option>
              <option value="bike">Bike (15 PKR/km)</option>
              <option value="car">Car (22 PKR/km)</option>
            </select>
            <input type="number" placeholder="Distance (KM) – optional" value={km} onChange={(e) => setKm(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem' }} min="0" step="0.1" />
            {calculatedCost > 0 && <p style={{ fontSize: '1rem', color: '#10b981', margin: '0' }}>Calculated Commute Cost: PKR {calculatedCost.toFixed(2)}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>Confirm Check-Out</button>
              <button type="button" onClick={() => { setIsCheckingOut(false); setPlace(''); setPurpose(''); setTransport(''); setKm(''); }} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#94a3b8', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        )
      ) : null}
  
        {/* LOG HISTORY - FIXED */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#334155', margin: '0 0 1.5rem' }}>
          Your Meeting Logs ({logs.length})
        </h2>
        {logs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No meetings logged yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Photo</th>
                  <th style={thStyle}>Place</th>
                  <th style={thStyle}>Purpose</th>
                  <th style={thStyle}>Check-Out</th>
                  <th style={thStyle}>Check-In</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isCheckedIn = !!log.check_in_time;
                  return (
                    <tr key={log.log_id}>
                      <td style={tdStyle}>
                        {log.employees?.profile_photo ? (
                          <Image
                            src={log.employees.profile_photo}
                            alt={log.employees.first_name}
                            width={40}
                            height={40}
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 40, backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }}>
                            {log.employees?.first_name?.charAt(0) || ''}
                            {log.employees?.last_name?.charAt(0) || ''}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>{log.place}</td>
                      <td style={tdStyle}>{log.purpose}</td>
                      <td style={tdStyle}>
                        {new Date(log.check_out_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={tdStyle}>
                        {log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={tdStyle}>
                        {log.commute_cost ? `PKR ${log.commute_cost.toFixed(2)}` : '—'}
                      </td>
                      <td style={tdStyle}>
                        {isCheckedIn ? (
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', backgroundColor: '#10b981', color: 'white', fontSize: '0.8rem', fontWeight: '600' }}>Checked In</span>
                        ) : (
                          <button onClick={() => handleCheckIn(log.log_id)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                            Check In
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}