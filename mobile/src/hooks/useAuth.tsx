import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface User {
  id: number;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  requiresVerification: boolean;
  verificationEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        api.setToken(token);
        try {
          const data = await api.getMe();
          setUser(data.user);
        } catch (err: any) {
          // Handle 401 or 403 errors (token expired or email not verified)
          if (err.message?.includes('401') || err.message?.includes('403')) {
            await AsyncStorage.removeItem('token');
            api.setToken(null);
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      await AsyncStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const data = await api.login(email, password);

      if (data.requiresVerification) {
        setRequiresVerification(true);
        setVerificationEmail(email);
        throw new Error('Email verification required. Please check your email.');
      }

      await AsyncStorage.setItem('token', data.token);
      api.setToken(data.token);
      setUser(data.user);
      setRequiresVerification(false);
      setVerificationEmail(null);
    } catch (err: any) {
      if (err.message?.includes('verify')) {
        setRequiresVerification(true);
        setVerificationEmail(email);
      }
      throw err;
    }
  }

  async function register(email: string, password: string) {
    const data = await api.register(email, password);

    // Check if email verification is required
    if (data.requiresVerification || !data.token) {
      setRequiresVerification(true);
      setVerificationEmail(email);
      throw new Error('Please check your email to verify your account.');
    }

    // If we got a token, proceed with login
    await AsyncStorage.setItem('token', data.token);
    api.setToken(data.token);
    setUser(data.user);
  }

  async function verifyEmail(token: string) {
    const data = await api.verifyEmail(token);

    if (data.token) {
      await AsyncStorage.setItem('token', data.token);
      api.setToken(data.token);
      setUser(data.user);
      setRequiresVerification(false);
      setVerificationEmail(null);
    }
  }

  async function resendVerification(email: string) {
    await api.resendVerification(email);
  }

  async function logout() {
    await AsyncStorage.removeItem('token');
    api.setToken(null);
    setUser(null);
    setRequiresVerification(false);
    setVerificationEmail(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        requiresVerification,
        verificationEmail,
        login,
        register,
        logout,
        verifyEmail,
        resendVerification
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
