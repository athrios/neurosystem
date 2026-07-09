// pages/Patients.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getPatients, createPatient, supabase } from '../lib/supabase';
import { Plus, Search, User, ChevronRight, Calendar, X, Loader } from 'lucide-react';

const ESCOLARIDADE = [
  'Ensino Pré-Escolar', 'Ensino Fundamental', 'Ensino Médio',
  'Ensino Superior', 'EJA - Educação de Jovens e Adultos',
  'FA - Ensino Fundamental de Adultos',
];
const INSTITUICAO_ENSINO = ['Pública', 'Privado'];

function calcIdade(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function PatientModal({ onClose, onSave, profile }) {
  const [form, setForm] = useState({
    nome: '', data_nascimento: '', sexo: 'Masculino', escolaridade: '',
    instituicao: 'Pública', serie_ano: '', lateralidade: 'Destro',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nome.trim()) return setError('Nome é obrigatório');
    setSaving(true);
    setError('');

    const { error } = await createPatient({
      ...form,
      psicologo_id: profile.id,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      onSave();
    }
  }

  const field = (label, key, type = 'text', opts = null) => (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-2)' }}>
        {label}
      </label>
      {opts ? (
        <select
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}
        >
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}
        />
      )}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 28,
        width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Novo Paciente</h2>
          <button onClick={onClose} style={{ color: 'var(--text-3)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('Nome completo *', 'nome')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('Data de nascimento', 'data_nascimento', 'date')}
            {field('Sexo', 'sexo', 'select', ['Masculino', 'Feminino', 'Outro'])}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('Escolaridade', 'escolaridade', 'select', ['', ...ESCOLARIDADE])}
            {field('Série/Ano', 'serie_ano')}
          </div>
          {field('Instituição de ensino', 'instituicao', 'select', INSTITUICAO_ENSINO)}
          {field('Lateralidade', 'lateralidade', 'select', ['Destro', 'Sinistro', 'Ambidestro'])}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              color: 'var(--text-2)', fontSize: 13,
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{
              padding: '8px 20px', borderRadius: 8,
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500,
            }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Patients() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadPatients();
  }, [search]);

  async function loadPatients() {
    setLoading(true);
    const { data } = await getPatients(search);
    setPatients(data || []);
    setLoading(false);
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Pacientes</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--accent)', color: '#fff',
            padding: '9px 16px', borderRadius: 8, fontWeight: 500, fontSize: 13,
          }}
        >
          <Plus size={15} /> Novo paciente
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={15} style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)',
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          style={{
            width: '100%', padding: '10px 12px 10px 36px',
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--surface)', fontSize: 13,
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-3)', padding: 2,
          }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* List */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <User size={40} color="var(--text-3)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
              {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>
              {!search && 'Clique em "Novo paciente" para começar'}
            </p>
          </div>
        ) : (
          patients.map((p, i) => (
            <div
              key={p.id}
              onClick={() => navigate(`/patients/${p.id}`)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 20px',
                borderBottom: i < patients.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'var(--accent-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                }}>
                  {p.nome?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                    {p.data_nascimento && `${calcIdade(p.data_nascimento)} anos · `}
                    {p.sexo} · {p.escolaridade || 'Escolaridade não informada'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {profile?.role === 'master' && p.profiles && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {p.profiles?.nome}
                  </span>
                )}
                <ChevronRight size={15} color="var(--text-3)" />
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <PatientModal
          profile={profile}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadPatients(); }}
        />
      )}
    </div>
  );
}
