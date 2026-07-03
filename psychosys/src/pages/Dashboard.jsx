// pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { Users, ClipboardList, Calendar, TrendingUp, ArrowRight, Plus } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = 'var(--shadow-lg)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: color + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
        {onClick && <ArrowRight size={14} color="var(--text-3)" />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ patients: 0, evaluations: 0, recent: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const [pRes, eRes, rRes] = await Promise.all([
      supabase.from('patients').select('id', { count: 'exact', head: true }),
      supabase.from('evaluations').select('id', { count: 'exact', head: true }),
      supabase
        .from('evaluations')
        .select('id, data_aplicacao, status, patients(nome)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    setStats({
      patients: pRes.count || 0,
      evaluations: eRes.count || 0,
      recent: rRes.data || [],
    });
    setLoading(false);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>
          {greeting}, {profile?.nome?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text-2)', marginTop: 4, fontSize: 13 }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {profile?.role === 'master' && (
            <span style={{
              marginLeft: 10, background: 'var(--accent-bg)', color: 'var(--accent)',
              border: '1px solid var(--accent-border)', borderRadius: 20,
              padding: '1px 8px', fontSize: 11, fontWeight: 500
            }}>⭐ Acesso Master</span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard
          icon={Users} label="Pacientes cadastrados"
          value={loading ? '—' : stats.patients}
          color="#534AB7"
          onClick={() => navigate('/patients')}
        />
        <StatCard
          icon={ClipboardList} label="Avaliações realizadas"
          value={loading ? '—' : stats.evaluations}
          color="#1D9E75"
          onClick={() => navigate('/patients')}
        />
        <StatCard
          icon={TrendingUp} label="Testes disponíveis"
          value="52"
          color="#D85A30"
        />
      </div>

      {/* Recent evaluations */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Avaliações recentes</h2>
          <button
            onClick={() => navigate('/patients')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--accent)', fontSize: 12, fontWeight: 500,
              padding: '5px 10px', borderRadius: 6, background: 'var(--accent-bg)',
              border: '1px solid var(--accent-border)',
            }}
          >
            <Plus size={13} /> Nova avaliação
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : stats.recent.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <ClipboardList size={36} color="var(--text-3)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Nenhuma avaliação ainda</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>
              Cadastre um paciente e inicie uma avaliação
            </p>
          </div>
        ) : (
          <div>
            {stats.recent.map((ev, i) => (
              <div
                key={ev.id}
                onClick={() => navigate(`/evaluations/${ev.id}`)}
                style={{
                  padding: '12px 20px',
                  borderBottom: i < stats.recent.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'var(--accent-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: 'var(--accent)',
                  }}>
                    {ev.patients?.nome?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ev.patients?.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {new Date(`${ev.data_aplicacao}T00:00:00`).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: ev.status === 'concluida' ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: ev.status === 'concluida' ? 'var(--success)' : 'var(--warning)',
                    border: `1px solid ${ev.status === 'concluida' ? '#9FE1CB' : '#FAC775'}`,
                    fontWeight: 500,
                  }}>
                    {ev.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                  </span>
                  <ArrowRight size={14} color="var(--text-3)" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
