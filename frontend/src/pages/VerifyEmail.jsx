import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../services/api';
import { FileText, CheckCircle, XCircle, Loader, Mail } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState(token ? 'verifying' : 'idle'); // verifying, success, error, expired, idle
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  async function verifyToken(verificationToken) {
    setStatus('verifying');
    try {
      const response = await fetch(`/api/auth/verify?token=${encodeURIComponent(verificationToken)}`);
      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);

        // Auto-login if token returned
        if (data.token) {
          api.setToken(data.token);
          if (data.csrfToken) {
            api.setCsrfToken(data.csrfToken);
          }
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      } else {
        if (data.expired) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        setMessage(data.error);
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  async function handleResend() {
    if (!email) return;
    setResendLoading(true);
    setResendMessage('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      setResendMessage(data.message || 'Verification email sent!');
    } catch (err) {
      setResendMessage('Failed to send. Please try again.');
    } finally {
      setResendLoading(false);
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

        {/* Verifying state */}
        {status === 'verifying' && (
          <div style={styles.statusBlock}>
            <Loader size={48} color="#2dbe60" style={{ animation: 'spin 1s linear infinite' }} />
            <h2 style={styles.statusTitle}>Verifying your email...</h2>
            <p style={styles.statusText}>Please wait a moment.</p>
          </div>
        )}

        {/* Success state */}
        {status === 'success' && (
          <div style={styles.statusBlock}>
            <CheckCircle size={48} color="#2dbe60" />
            <h2 style={styles.statusTitle}>Email Verified!</h2>
            <p style={styles.statusText}>{message}</p>
            <p style={styles.statusText}>Redirecting to your dashboard...</p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div style={styles.statusBlock}>
            <XCircle size={48} color="#e53e3e" />
            <h2 style={styles.statusTitle}>Verification Failed</h2>
            <p style={styles.statusText}>{message}</p>
            <p style={styles.statusText}>
              Your account may already be verified. Try signing in.
            </p>
            <Link to="/login" style={styles.actionButton}>Go to Sign In</Link>
          </div>
        )}

        {/* Expired state */}
        {status === 'expired' && (
          <div style={styles.statusBlock}>
            <XCircle size={48} color="#e5a83e" />
            <h2 style={styles.statusTitle}>Link Expired</h2>
            <p style={styles.statusText}>Your verification link has expired. Enter your email to get a new one.</p>

            <div style={styles.resendForm}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={styles.input}
              />
              <button
                onClick={handleResend}
                disabled={resendLoading || !email}
                style={{
                  ...styles.actionButton,
                  opacity: resendLoading || !email ? 0.6 : 1
                }}
              >
                {resendLoading ? 'Sending...' : 'Resend Verification'}
              </button>
              {resendMessage && <p style={styles.resendMsg}>{resendMessage}</p>}
            </div>
          </div>
        )}

        {/* Idle state - no token, just show resend form */}
        {status === 'idle' && (
          <div style={styles.statusBlock}>
            <Mail size={48} color="#2dbe60" />
            <h2 style={styles.statusTitle}>Check Your Email</h2>
            <p style={styles.statusText}>
              We sent a verification link to your email address. Click the link to activate your account.
            </p>

            <div style={styles.resendForm}>
              <p style={styles.resendLabel}>Didn't receive the email?</p>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={styles.input}
              />
              <button
                onClick={handleResend}
                disabled={resendLoading || !email}
                style={{
                  ...styles.actionButton,
                  opacity: resendLoading || !email ? 0.6 : 1
                }}
              >
                {resendLoading ? 'Sending...' : 'Resend Verification Email'}
              </button>
              {resendMessage && <p style={styles.resendMsg}>{resendMessage}</p>}
            </div>
          </div>
        )}

        <div style={styles.divider}><span>or</span></div>

        <p style={styles.footer}>
          <Link to="/login" style={styles.link}>Back to Sign In</Link>
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
    maxWidth: '440px',
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px 32px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)'
  },
  logo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px'
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
  statusBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px'
  },
  statusTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: '8px 0 0'
  },
  statusText: {
    fontSize: '15px',
    color: '#525e63',
    lineHeight: 1.6,
    margin: 0
  },
  actionButton: {
    display: 'inline-block',
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: '600',
    background: '#2dbe60',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textDecoration: 'none',
    marginTop: '8px',
    transition: 'background 0.15s ease'
  },
  resendForm: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px'
  },
  resendLabel: {
    fontSize: '14px',
    color: '#7b868a',
    margin: 0,
    textAlign: 'center'
  },
  input: {
    padding: '12px 14px',
    fontSize: '15px',
    border: '1px solid #e0e4e5',
    borderRadius: '8px',
    background: '#fff',
    color: '#1a1a1a',
    width: '100%'
  },
  resendMsg: {
    fontSize: '14px',
    color: '#2dbe60',
    textAlign: 'center',
    margin: 0
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

// Add spin animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleSheet);
}
