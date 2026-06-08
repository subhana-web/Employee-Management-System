// app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false); // Separate state for demo button
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) throw error;

      await handleRoleBasedRedirect(data.user.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Extracted for reuse between normal login and demo login
  const handleRoleBasedRedirect = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'employee';

    switch (role) {
      case 'admin':
        router.push('/admin');
        break;
      case 'manager':
        router.push('/manager');
        break;
      case 'hr':                    // ← HR Role Support
        router.push('/hr');
        break;
      case 'employee':
        router.push('/employee');
        break;
      default:
        router.push('/');
    }
    
    router.refresh();
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'demo@oratech.com',
        password: 'Demo@1234',
      });

      if (error) throw error;

      await handleRoleBasedRedirect(data.user.id);
    } catch (err: any) {
      setError(err.message || 'Demo login failed. Please check if demo account exists.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Curved navy blue overlay */}
      <div style={styles.curveOverlay}></div>
      <div style={styles.secondCurve}></div>

{/* Demo Credentials Card - Improved */}
<div style={{
  position: 'fixed' as const,
  bottom: '2rem',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
  zIndex: 1000,                    // Higher z-index
  minWidth: '340px',
  maxWidth: '420px',
  border: '1px solid #e2e8f0',
  maxHeight: '85vh',
  overflowY: 'auto',
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
    <p style={{ 
      margin: 0, 
      fontSize: '0.85rem', 
      fontWeight: '700', 
      color: '#64748b', 
      textTransform: 'uppercase', 
      letterSpacing: '0.05em' 
    }}>
      🔑 Demo Credentials — Click to Fill
    </p>
    {/* Optional Close Button */}
    <button
      onClick={() => {
        const card = document.getElementById('demo-card');
        if (card) card.style.display = 'none';
      }}
      style={{
        background: 'none',
        border: 'none',
        fontSize: '1.1rem',
        cursor: 'pointer',
        color: '#94a3b8',
        padding: '0 4px'
      }}
    >
      ✕
    </button>
  </div>

  {[
    { role: 'Admin', email: 'admin@ora.com', password: '123456', color: '#7c3aed' },
    { role: 'HR', email: 'hr@ora.com', password: '123456', color: '#0891b2' },
    { role: 'Manager', email: 'manager@ora.com', password: '123456', color: '#059669' },
    { role: 'Employee', email: 'test2@ora.com', password: '123456', color: '#d97706' },
  ].map((d) => (
    <div
      key={d.role}
      onClick={() => {
        const form = document.querySelector('form');
        if (form) {
          const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement;
          const passInput = form.querySelector('input[name="password"]') as HTMLInputElement;
          
          if (emailInput) emailInput.value = d.email.trim();
          if (passInput) passInput.value = d.password;
          
          // Optional: focus password field
          passInput?.focus();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.6rem 0.75rem',
        marginBottom: '0.5rem',
        borderRadius: '10px',
        cursor: 'pointer',
        border: '1px solid #f1f5f9',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#f8fafc';
        e.currentTarget.style.borderColor = '#e2e8f0';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = '#f1f5f9';
      }}
    >
      <span style={{
        backgroundColor: d.color + '15',
        color: d.color,
        fontWeight: '700',
        fontSize: '0.75rem',
        padding: '0.25rem 0.6rem',
        borderRadius: '6px',
        minWidth: '62px',
        textAlign: 'center',
      }}>{d.role}</span>
      <span style={{ 
        fontSize: '0.82rem', 
        color: '#475569', 
        fontFamily: 'monospace',
        flex: 1 
      }}>{d.email}</span>
    </div>
  ))}

  <p style={{ 
    margin: '0.75rem 0 0', 
    fontSize: '0.73rem', 
    color: '#94a3b8', 
    textAlign: 'center',
    lineHeight: '1.4'
  }}>
    Click any role → credentials autofill → press Login
  </p>
</div>
      
      
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <svg width="60" height="60" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M25 2L48 13V37L25 48L2 37V13L25 2Z" stroke="#1e3a8a" strokeWidth="2" fill="white"/>
            <circle cx="25" cy="25" r="8" fill="#1e3a8a"/>
          </svg>
        </div>
        <h1 style={styles.title}>ORA TECH</h1>
        <p style={styles.subtitle}>Employee Management System</p>
        
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              name="email"
              type="email"
              placeholder="Enter your email"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              name="password"
              type="password"
              placeholder="Enter your password"
              required
              minLength={6}
              style={styles.input}
            />
          </div>

          {/* Demo Login Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            style={{
              ...styles.button,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              marginTop: '0.5rem',
              opacity: (demoLoading || loading) ? 0.7 : 1,
            }}
          >
            {demoLoading ? 'Logging in with Demo...' : '🚀 Try Demo Login'}
          </button>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading || demoLoading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%)',
    position: 'relative' as const,
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  curveOverlay: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: '60%',
    height: '100%',
    background: '#1e3a8a',
    clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)',
    opacity: 0.95,
    zIndex: 1,
  },
  secondCurve: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: '55%',
    height: '100%',
    background: '#2563eb',
    clipPath: 'polygon(100% 0, 10% 100%, 100% 100%)',
    opacity: 0.5,
    zIndex: 0,
  },
  card: {
    maxWidth: '450px',
    width: '100%',
    background: 'white',
    borderRadius: '24px',
    padding: '2.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    position: 'relative' as const,
    zIndex: 10,
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem',
    letterSpacing: '1px',
    textAlign: 'center' as const,
  },
  subtitle: {
    color: '#64748b',
    fontSize: '0.95rem',
    fontWeight: '400',
    textAlign: 'center' as const,
    marginBottom: '2rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    color: '#1e293b',
    fontSize: '0.9rem',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '1rem',
    borderRadius: '12px',
    border: '2px solid #e2e8f0',
    background: 'white',
    fontSize: '1rem',
    color: '#1e293b',
    outline: 'none',
    transition: 'all 0.3s ease',
  },
  button: {
    padding: '1rem',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
    color: 'white',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 6px -1px rgba(30, 58, 138, 0.2)',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.9rem',
    textAlign: 'center' as const,
    padding: '0.75rem',
    background: '#fee2e2',
    borderRadius: '8px',
    border: '1px solid #fecaca',
  },
} as const;
