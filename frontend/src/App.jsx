import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import api from './services/api';
import syncService from './services/sync';
import { clearAllData } from './services/db';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SharedNote from './pages/SharedNote';

// Auth Context
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// Sync Context
const SyncContext = createContext(null);

export function useSync() {
  return useContext(SyncContext);
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    error: null
  });
  const navigate = useNavigate();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Setup sync listener
  useEffect(() => {
    const unsubscribe = syncService.addListener((event) => {
      switch (event.type) {
        case 'online':
          setSyncStatus(s => ({ ...s, isOnline: true }));
          break;
        case 'offline':
          setSyncStatus(s => ({ ...s, isOnline: false }));
          break;
        case 'sync_start':
          setSyncStatus(s => ({ ...s, isSyncing: true, error: null }));
          break;
        case 'sync_complete':
          setSyncStatus(s => ({ 
            ...s, 
            isSyncing: false, 
            lastSync: new Date().toISOString() 
          }));
          break;
        case 'sync_error':
          setSyncStatus(s => ({ ...s, isSyncing: false, error: event.error }));
          break;
        case 'conflict':
          // Handle conflict notification
          console.log('Conflict detected for note:', event.noteId);
          break;
      }
    });

    return unsubscribe;
  }, []);

  async function checkAuth() {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      // Trigger initial sync
      syncService.sync();
    } catch (err) {
      console.error('Auth check failed:', err);
      api.logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await api.login(email, password);
    setUser(data.user);
    syncService.sync();
    navigate('/');
  }

  async function register(email, password) {
    const data = await api.register(email, password);
    setUser(data.user);
    navigate('/');
  }

  async function logout() {
    api.logout();
    await clearAllData();
    setUser(null);
    navigate('/login');
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token: api.getToken(), login, register, logout }}>
      <SyncContext.Provider value={{ ...syncStatus, sync: () => syncService.sync() }}>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/" /> : <Register />}
          />
          <Route
            path="/shared/:token"
            element={<SharedNote />}
          />
          <Route
            path="/*"
            element={user ? <Dashboard /> : <Navigate to="/login" />}
          />
        </Routes>
      </SyncContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;
