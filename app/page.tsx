// app/page.tsx
'use client';

import { useState, useEffect, CSSProperties } from 'react';
import Image from 'next/image';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

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

export default function EmployeesPage() {
  const supabase = createPagesBrowserClient();
  const router = useRouter();

  // -----------------------------------------------------------------
  // 1. SESSION CHECK (CLIENT-SIDE)
  // -----------------------------------------------------------------
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [userEmail, setUserEmail] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      const email = data.session.user.email || '';
      setUserEmail(email);

      // Fetch role from profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .limit(1);

      const role = profileData?.[0]?.role || 'employee';
      setUserRole(role);

      // If not employee, redirect to appropriate dashboard
      if (role === 'admin') {
        router.push('/admin');
        return;
      } else if (role === 'manager') {
        router.push('/manager');
        return;
      }

      // Fetch employee_id from employees
      const { data: empData } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('email', email)
        .limit(1);

      setEmployeeId(empData?.[0]?.employee_id || null);
      setIsAuthLoading(false);
    };

    checkSession();
  }, [router, supabase]);

  // -----------------------------------------------------------------
  // LOGOUT FUNCTION
  // -----------------------------------------------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  // -----------------------------------------------------------------
  // 2. MY PROFILE (employee only)
  // -----------------------------------------------------------------
  const [myProfile, setMyProfile] = useState<Employee | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && userEmail && userRole === 'employee') {
      fetchMyProfile();
    }
  }, [isAuthLoading, userEmail, userRole]);

  const fetchMyProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      // Fetch base employee row
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('email', userEmail)
        .limit(1);

      if (empErr) throw empErr;
      if (!empData?.length) {
        setMyProfile(null);
        setProfileLoading(false);
        return;
      }

      const emp = empData[0];

      // Fetch department name if ID exists
      let departmentName = '—';
      if (emp.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('name')
          .eq('department_id', emp.department_id)
          .limit(1);

        departmentName = dept?.[0]?.name || '—';
      }

      // Fetch manager name if ID exists
      let manager = { first_name: '—', last_name: '' };
      if (emp.reporting_manager_id) {
        const { data: mgr } = await supabase
          .from('employees')
          .select('first_name, last_name')
          .eq('employee_id', emp.reporting_manager_id)
          .limit(1);

        if (mgr?.length) {
          manager = mgr[0];
        }
      }

      // Final profile
      setMyProfile({
        ...emp,
        departments: { name: departmentName },
        reporting_manager: manager,
      });
    } catch (e: any) {
      setProfileError(e.message || 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // --------------------------------------------------------------
  // STYLES
  // --------------------------------------------------------------
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
    borderCollapse: 'collapse', 
    fontSize: '0.95rem', 
    backgroundColor: 'white' 
  };
  
  const thStyle: CSSProperties = { 
    padding: '1.2rem 1rem', 
    textAlign: 'left' as const, 
    fontWeight: '600', 
    color: '#475569', 
    borderBottom: '3px solid #e2e8f0', 
    fontSize: '0.9rem', 
    textTransform: 'uppercase', 
    letterSpacing: '0.5px' 
  };
  
  const tdStyle: CSSProperties = { 
    padding: '1.2rem 1rem', 
    borderBottom: '1px solid #e2e8f0', 
    color: '#334155', 
    verticalAlign: 'middle' 
  };

  // -----------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------
  if (isAuthLoading) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading session…</div>;
  }

  // If not employee, don't render (will redirect)
  if (userRole !== 'employee') {
    return null;
  }

  return (
    <div style={containerStyle}>
      {/* HEADER BAR */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem', 
        flexWrap: 'wrap', 
        gap: '0.5rem' 
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: '600' }}>
            Logged in as: {userEmail}{' '}
            <span style={{ color: '#6366f1' }}>[{userRole.toUpperCase()}]</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="/leaves" style={{ 
            backgroundColor: '#8b5cf6', 
            color: 'white', 
            padding: '0.5rem 1rem', 
            borderRadius: '8px', 
            textDecoration: 'none', 
            fontSize: '0.9rem', 
            fontWeight: '600' 
          }}>
            My Leaves
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
              fontSize: '0.9rem' 
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <h1 style={headerStyle}>My Employee Profile</h1>

      {/* EMPLOYEE PROFILE VIEW */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#334155', margin: '0 0 1.5rem' }}>
          Personal Details
        </h2>
        {profileLoading ? (
          <p style={{ textAlign: 'center' }}>Loading your profile…</p>
        ) : profileError ? (
          <p style={{ color: 'red', textAlign: 'center' }}>{profileError}</p>
        ) : myProfile ? (
          <div>
            {/* Profile Header with Photo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
              {myProfile.profile_photo ? (
                <Image 
                  src={myProfile.profile_photo} 
                  alt={myProfile.first_name} 
                  width={120} 
                  height={120} 
                  style={{ borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ 
                  width: 120, 
                  height: 120, 
                  backgroundColor: '#1e3a8a', 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '3rem',
                  fontWeight: '600'
                }}>
                  {myProfile.first_name?.[0]}{myProfile.last_name?.[0]}
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '2rem', margin: 0 }}>{myProfile.first_name} {myProfile.last_name || ''}</h3>
                <p style={{ fontSize: '1.1rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>{myProfile.designation || 'No designation'}</p>
              </div>
            </div>

            {/* Profile Details Table */}
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: '600', width: '200px' }}>Email:</td>
                  <td style={tdStyle}>{myProfile.email || '—'}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>Phone:</td>
                  <td style={tdStyle}>{myProfile.phone || '—'}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>Department:</td>
                  <td style={tdStyle}>{myProfile.departments?.name || '—'}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>Reporting Manager:</td>
                  <td style={tdStyle}>
                    {myProfile.reporting_manager
                      ? `${myProfile.reporting_manager.first_name} ${myProfile.reporting_manager.last_name || ''}`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>Hire Date:</td>
                  <td style={tdStyle}>{myProfile.hire_date || '—'}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>Employee ID:</td>
                  <td style={tdStyle}>{myProfile.employee_id}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>Status:</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: myProfile.status === 'active' ? '#10b981' : '#ef4444',
                      color: 'white',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}>
                      {myProfile.status?.toUpperCase() || 'ACTIVE'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
            No profile found. Please contact HR.
          </p>
        )}
      </div>
    </div>
  );
}