const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const ALIAS_MAP = {
  "dapsa_1": "dapsa",
  "dapsa": "dapsa",
  "juanvaldez_1": "juan valdez",
  "juanvaldez": "juan valdez",
  "cafemartinez_1": "cafe martinez",
  "laespumeria_1": "la espumeria",
  "laespumeria_2": "pinturas online",
  "morixe_1": "morixe",
  "sodastream_1": "soda stream ml",
  "sodastream": "soda stream ml",
  "stylestore_1": "stylestore",
  "bellapaloma_1": "bella paloma",
  "dapopmakeup_1": "dapop make up",
  "dapopmakeup_2": "dapop make up",
  "dapopmakeup": "dapop make up",
  "belcorp_1": "belcorp",
  "almanativa": "alma nativa",
  "violetta": "violetta cosmeticos",
  "abarka": "abarka",
  "geat": "geat",
  "disuiza": "disuiza colombia",
  "newsanchile": "newsan chile ml",
  "goavance": "go advance",
  "go avance": "go advance",
  "jansport": "jansport argentina",
  "jansport & herschel": "jansport argentina",
  "grupoaxo": "grupo axo - th ml",
  "grupo axo": "grupo axo - th ml",
  "forbasse": "forbasse",
  "naturamexico": "natura mexico"
};

async function main() {
  console.log('=== REINGESTA DE BOTMAKER CON DESFASE DE 1 MES ===\n');

  // 1. Obtener sellers de la base de datos
  const sellersRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_sellers?select=id_seller,nombre_seller,cobrar_botmaker`, {
    headers: HEADERS
  }).then(r => r.json());

  const sellersMap = {};
  sellersRes.forEach(s => {
    sellersMap[normalizeName(s.nombre_seller)] = s.id_seller;
  });

  for (const [alias, realName] of Object.entries(ALIAS_MAP)) {
    const normReal = normalizeName(realName);
    if (sellersMap[normReal]) {
      sellersMap[normalizeName(alias)] = sellersMap[normReal];
    }
  }

  // 2. Limpiar registros de botmaker_consumos para 2026-07-01, 2026-08-01, 2026-09-01, 2026-10-01
  const periodsToClean = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'];
  for (const p of periodsToClean) {
    console.log(`Eliminando registros existentes de botmaker_consumos para periodo ${p}...`);
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/botmaker_consumos?periodo=eq.${p}`, {
      method: 'DELETE',
      headers: { ...HEADERS, 'Prefer': 'return=representation' }
    });
    const deleted = await delRes.json();
    console.log(`  -> Eliminados ${deleted.length} registros para ${p}.`);
  }

  // 3. Procesar los 3 archivos CSV con su respectivo mes de liquidación desfasado (+1 mes)
  const dir = 'forecast/backend/botmaker/output';
  const tasks = [
    {
      file: 'EJRC6X6TLYSTJJYV7ZX1-2026-07-M6Q (1).csv',
      mesConsumo: 'Julio 2026',
      targetPeriodo: '2026-08-01'
    },
    {
      file: 'EJRC6X6TLYSTJJYV7ZX1-2026-08-6I8.csv',
      mesConsumo: 'Agosto 2026',
      targetPeriodo: '2026-09-01'
    },
    {
      file: 'EJRC6X6TLYSTJJYV7ZX1-2026-09-N31.csv',
      mesConsumo: 'Septiembre 2026',
      targetPeriodo: '2026-10-01'
    }
  ];

  for (const t of tasks) {
    const filePath = path.join(dir, t.file);
    console.log(`\nProcesando archivo ${t.file}...`);
    console.log(`  Mes de Consumo: ${t.mesConsumo} -> Mes Liquidación Reply: ${t.targetPeriodo}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(';');

    const feeIdx = headers.findIndex(h => /botmaker platform fee/i.test(h) && /billed/i.test(h) && !/count/i.test(h));
    const childNameIdx = headers.findIndex(h => /child account name/i.test(h));
    const childProjIdIdx = headers.findIndex(h => /child project id/i.test(h));
    const childProjNameIdx = headers.findIndex(h => /child project name/i.test(h));

    const rowsToInsert = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';');
      const childName = (cols[childNameIdx] || '').trim();
      const childProjId = (cols[childProjIdIdx] || '').trim();
      const childProjName = (cols[childProjNameIdx] || '').trim();

      if (!childName || !childProjId) continue;

      const normName = normalizeName(childName);
      const normProj = normalizeName(childProjId);
      const sellerId = sellersMap[normName] || sellersMap[normProj] || null;

      let fee = 0;
      if (feeIdx >= 0 && cols[feeIdx]) {
        fee = parseFloat(cols[feeIdx]) || 0;
      }

      // Reconstruir raw_data con todas las columnas
      const rawData = {};
      headers.forEach((h, colIdx) => {
        if (h) rawData[h] = cols[colIdx] || '';
      });

      rowsToInsert.push({
        periodo: t.targetPeriodo,
        seller_id: sellerId,
        child_project_id: childProjId,
        child_project_name: childProjName || childName,
        total_billed: Math.round(fee * 100) / 100,
        raw_data: rawData
      });
    }

    console.log(`  Insertando ${rowsToInsert.length} registros para periodo ${t.targetPeriodo}...`);
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/botmaker_consumos`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(rowsToInsert)
    });

    if (!insertRes.ok) {
      console.error(`  Error insertando para ${t.targetPeriodo}:`, await insertRes.text());
    } else {
      console.log(`  -> OK: ${rowsToInsert.length} registros insertados exitosamente.`);
    }

    const totalFee = rowsToInsert.reduce((s, r) => s + r.total_billed, 0);
    console.log(`  -> Suma total_billed: $${totalFee.toLocaleString('es-AR')}`);
  }

  // 4. Verificación final de periodos cargados en Supabase
  console.log('\n=== VERIFICACIÓN FINAL EN SUPABASE ===');
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/botmaker_consumos?select=periodo,total_billed`, {
    headers: HEADERS
  }).then(r => r.json());

  const summary = {};
  checkRes.forEach(r => {
    if (!summary[r.periodo]) summary[r.periodo] = { count: 0, total_billed: 0 };
    summary[r.periodo].count++;
    summary[r.periodo].total_billed = Math.round((summary[r.periodo].total_billed + Number(r.total_billed)) * 100) / 100;
  });

  console.log('Resumen de períodos en botmaker_consumos:', summary);
}

main();
