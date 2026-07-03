// App.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, getProfile } from './lib/supabase';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import WiscIV from './pages/WiscIV';
import GenericTest from './pages/GenericTest';
import EvaluationDetail from './pages/EvaluationDetail';
import ProfilePage from './pages/ProfilePage';
import AnamnesisEditor from './pages/AnamnesisEditor';
import SharedAnamnesis from './pages/SharedAnamnesis';
import SharedTestResponse from './pages/SharedTestResponse';
import PreReport from './pages/PreReport';
import Layout from './components/Layout';

// ============================================================
// AUTH CONTEXT
// ============================================================
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await getProfile(userId);
    setProfile(data);
    setLoading(false);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// PROTECTED ROUTE
// ============================================================
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }
  
  return session ? children : <Navigate to="/login" replace />;
}

// ============================================================
// APP
// ============================================================
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/escala/:token" element={<SharedAnamnesis />} />
          <Route path="/anamnese/:token" element={<SharedAnamnesis />} />
          <Route path="/teste/:token" element={<SharedTestResponse />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="evaluations/:evalId" element={<EvaluationDetail />} />
            <Route path="evaluations/:evalId/wisc-iv" element={<WiscIV />} />
            <Route path="evaluations/:evalId/tests/:formCode" element={<GenericTest />} />
            <Route path="patients/:patientId/escalas/new" element={<AnamnesisEditor />} />
            <Route path="escalas/:anamnesisId" element={<AnamnesisEditor />} />
            <Route path="patients/:patientId/anamneses/new" element={<AnamnesisEditor />} />
            <Route path="anamneses/:anamnesisId" element={<AnamnesisEditor />} />
            <Route path="patients/:patientId/pre-report" element={<PreReport />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
