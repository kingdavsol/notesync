import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { FileText, Eye, EyeOff, Check, X } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  // Password requirements
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError('Password does not meet requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await register(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const RequirementCheck = ({ met, text }) => (
    <div style={{ 
      ...styles.requirement, 
      color: met ? '#2dbe60' : '#aeb6b8' 
    }}>
      {met ? <Check size={14} /> : <X size={14} />}
      <span>{text}</span>
    </div>
  );

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
        
        <p style={styles.subtitle}>Create your free account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}
          
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
                placeholder="Create a password"
                required
                autoComplete="new-password"
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
            
            {/* Password requirements */}
            {password.length > 0 && (
              <div style={styles.requirements}>
                <RequirementCheck met={hasMinLength} text="At least 8 characters" />
                <RequirementCheck met={hasLetter} text="Contains a letter" />
                <RequirementCheck met={hasNumber} text="Contains a number" />
              </div>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              style={{
                ...styles.input,
                borderColor: confirmPassword.length > 0 
                  ? (passwordsMatch ? '#2dbe60' : '#e53e3e') 
                  : '#e0e4e5'
              }}
            />
          </div>

          <button 
            type="submit" 
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1
            }}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={styles.terms}>
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>

        <div style={styles.divider}>
          <span>or</span>
        </div>

        <p style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
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
  requirements: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '8px'
  },
  requirement: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px'
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
  terms: {
    marginTop: '16px',
    fontSize: '12px',
    color: '#aeb6b8',
    textAlign: 'center',
    lineHeight: 1.5
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
  }
};
