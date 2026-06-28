// seed_wisc_normas.js
// Executa uma vez para popular a tabela normative_data com os dados do WISC-IV
// node seed_wisc_normas.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // chave service_role

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const wisc_data = JSON.parse(fs.readFileSync('./wisc_iv_normas.json', 'utf8'));

async function seed() {
  console.log('Iniciando seed dos dados normativos WISC-IV...\n');

  // 1. Tabelas de subtestes por faixa etária
  for (const group of wisc_data.subtest_tables) {
    const table_name = `WISC_IV_SUBTESTE_${group.min_days}_${group.max_days}`;
    
    const { error } = await supabase
      .from('normative_data')
      .upsert({
        test_code: 'WISC_IV',
        table_name,
        meta: {
          min_days: group.min_days,
          max_days: group.max_days,
          type: 'subtest_lookup'
        },
        data: group.subtests
      }, { onConflict: 'test_code,table_name' });
    
    if (error) {
      console.error(`Erro em ${table_name}:`, error.message);
    } else {
      console.log(`✓ ${table_name}`);
    }
  }

  // 2. Tabelas de índices compostos
  const index_names = ['ICV', 'IOP', 'IMO', 'IVP', 'QI'];
  for (const idx_name of index_names) {
    const table_name = `WISC_IV_INDEX_${idx_name}`;
    const { error } = await supabase
      .from('normative_data')
      .upsert({
        test_code: 'WISC_IV',
        table_name,
        meta: { index: idx_name, type: 'composite_lookup' },
        data: { rows: wisc_data.index_tables[idx_name] }
      }, { onConflict: 'test_code,table_name' });
    
    if (error) {
      console.error(`Erro em ${table_name}:`, error.message);
    } else {
      console.log(`✓ ${table_name}`);
    }
  }

  console.log('\n✅ Seed concluído!');
}

seed().catch(console.error);
