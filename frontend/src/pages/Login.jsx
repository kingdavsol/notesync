import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { FileText, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      // Check if the error response indicates unverified email
      if (err.message?.includes('verify your email')) {
        setNeedsVerification(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <FileText size={28} color="#2dbe60" />
          </div>
          <h1 style={styles.logoText}>NoteSync</h1>
        </div>
        
        <p style={styles.subtitle}>Remember everything important.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.error}>
              {error}
              {needsVerification && (
                <div style={{ marginTop: '8px' }}>
                  <Link to="/verify" style={{ color: '#2dbe60', fontWeight: '600', fontSize: '13px' }}>
                    Resend verification email
                  </Link>
                </div>
              )}
            </div>
          )}
          
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoFocus
              autoComplete="email"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                style={styles.input}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.divider}>
          <span>or</span>
        </div>

        <p style={styles.footer}>
          New to NoteSync? <Link to="/register" style={styles.link}>Create account</Link>
        </p>
      </div>

      <p style={styles.tagline}>
        Your notes, everywhere you need them.
      </p>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'linear-gradient(180deg, #f7f7f7 0%, #ffffff 100%)'
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px 32px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)'
  },
  logo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '8px'
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'rgba(45, 190, 96, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px'
  },
  logoText: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a1a'
  },
  subtitle: {
    textAlign: 'center',
    color: '#7b868a',
    marginBottom: '32px',
    fontSize: '15px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#525e63'
  },
  input: {
    padding: '12px 14px',
    fontSize: '15px',
    border: '1px solid #e0e4e5',
    borderRadius: '8px',
    background: '#fff',
    color: '#1a1a1a',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    width: '100%'
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: '#7b868a',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  button: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    background: '#2dbe60',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    marginTop: '8px'
  },
  error: {
    background: 'rgba(229, 62, 62, 0.08)',
    border: '1px solid rgba(229, 62, 62, 0.3)',
    borderRadius: '8px',
    padding: '12px 14px',
    color: '#e53e3e',
    fontSize: '14px'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '24px 0',
    color: '#aeb6b8',
    fontSize: '13px'
  },
  footer: {
    textAlign: 'center',
    color: '#525e63',
    fontSize: '14px'
  },
  link: {
    color: '#2dbe60',
    fontWeight: '600',
    textDecoration: 'none'
  },
  tagline: {
    marginTop: '24px',
    color: '#7b868a',
    fontSize: '14px'
  }
};
