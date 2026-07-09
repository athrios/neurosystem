// components/Layout.jsx
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { signOut } from '../lib/supabase';
import {
  LayoutDashboard, Users, ClipboardList, Receipt,
  Settings, LogOut, Menu, X, Brain, ChevronRight
} from 'lucide-react';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients',  icon: Users,            label: 'Pacientes' },
];

export default function Layout() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: collapsed ? 60 : 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width .2s',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '16px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
          minHeight: 60,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Brain size={18} color="#fff" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Lluria</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: -1 }}>v 1.0</div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '10px 14px' : '10px 16px',
              margin: '2px 8px',
              borderRadius: 8,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-2)',
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            })}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
          {profile && !collapsed && (
            <NavLink to="/profile" style={{ display: 'block', padding: '8px', borderRadius: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{profile.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {profile.role === 'master' ? '⭐ Master' : `CRP: ${profile.crp || '—'}`}
              </div>
            </NavLink>
          )}
          
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8, width: '100%',
              color: 'var(--text-2)', fontSize: 13,
            }}
          >
            <LogOut size={16} />
            {!collapsed && 'Sair'}
          </button>
        </div>

        {/* Toggle collapse */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            position: 'absolute',
            left: collapsed ? 44 : 204,
            top: 20,
            width: 20, height: 20,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-3)',
            cursor: 'pointer',
            transition: 'left .2s',
            zIndex: 10,
          }}
        >
          {collapsed ? <ChevronRight size={11} /> : <X size={11} />}
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  );
}
