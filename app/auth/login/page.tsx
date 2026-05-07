// app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

      // Get user role from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const role = profile?.role || 'employee';

      // Redirect based on role
      switch(role) {
        case 'admin':
          router.push('/admin');
          break;
        case 'manager':
          router.push('/manager');
          break;
          case 'hr':                    // ← NEW
          router.push('/hr');
          break;
        case 'employee':
          router.push('/employee');
          break;
        default:
          router.push('/');
      }
      
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Curved navy blue overlay */}
      <div style={styles.curveOverlay}></div>
      <div style={styles.secondCurve}></div>
      
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

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
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
    marginTop: '1rem',
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
};