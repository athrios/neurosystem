// pages/ProfilePage.jsx
import React, { useState } from 'react';
import { useAuth } from '../App';
import { updateProfile } from '../lib/supabase';
import { Save, CheckCircle, User, Shield } from 'lucide-react';

function Field({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 5 }}>
        {label}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px',
          border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 13, background: disabled ? 'var(--bg)' : 'var(--surface)',
          color: disabled ? 'var(--text-3)' : 'var(--text)',
        }}
      />
    </div>
  );
}

export default function ProfilePage() {
  const { profile, setProfile } = useAuth();
  const [form, setForm] = useState({ ...profile });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    
    const { data } = await updateProfile(profile.id, {
      nome: form.nome,
      crp: form.crp,
      cpf: form.cpf,
      rg: form.rg,
      endereco: form.endereco,
      complemento: form.complemento,
      municipio: form.municipio,
      uf: form.uf,
      cep: form.cep,
      fone: form.fone,
    });
    
    if (data) {
      setProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Meu Perfil</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
          Esses dados aparecerão no cabeçalho dos relatórios e recibos
        </p>
      </div>

      {/* Role badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)', borderRadius: 10, marginBottom: 20,
      }}>
        <Shield size={16} color="var(--accent)" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
            {profile?.role === 'master' ? '⭐ Acesso Master' : 'Psicólogo(a)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{profile?.email}</div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-2)',
            textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Dados Profissionais
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome completo" value={form.nome} onChange={set('nome')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="CRP" value={form.crp} onChange={set('crp')} />
              <Field label="CPF" value={form.cpf} onChange={set('cpf')} />
              <Field label="RG" value={form.rg} onChange={set('rg')} />
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-2)',
            textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Endereço
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Endereço" value={form.endereco} onChange={set('endereco')} />
            <Field label="Complemento / Bairro" value={form.complemento} onChange={set('complemento')} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <Field label="Município" value={form.municipio} onChange={set('municipio')} />
              <Field label="UF" value={form.uf} onChange={set('uf')} />
              <Field label="CEP" value={form.cep} onChange={set('cep')} />
            </div>
            <Field label="Fone" value={form.fone} onChange={set('fone')} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: saved ? 'var(--success)' : 'var(--accent)',
            color: '#fff', padding: '9px 20px', borderRadius: 8,
            fontSize: 13, fontWeight: 500,
          }}
        >
          {saved ? <><CheckCircle size={14} /> Salvo!</> : <><Save size={14} /> {saving ? 'Salvando...' : 'Salvar alterações'}</>}
        </button>
      </form>
    </div>
  );
}
