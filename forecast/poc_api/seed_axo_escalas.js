const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const SELLER_ID = 550082876; // Grupo Axo - TH ML (representante de Grupo Axo Consolidado)

// 18 tiers defined by the user
const TIERS_TEMPLATE = [
  // 1. Minimos
  { tipo_cargo: 'MINIMO_HASTA_1650', alicuota: 0, monto_objetivo: 120000.00 },
  { tipo_cargo: 'MINIMO_HASTA_2200', alicuota: 0, monto_objetivo: 140000.00 },
  
  // 2. Porcentual Hasta 1650 créditos
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0175, monto_objetivo: 8000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0150, monto_objetivo: 9500000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0130, monto_objetivo: 11000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0120, monto_objetivo: 12000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0110, monto_objetivo: 13500000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0100, monto_objetivo: 15000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0090, monto_objetivo: 17000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_1650', alicuota: 0.0080, monto_objetivo: 20000000.00 },

  // 3. Porcentual Hasta 2200 créditos
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0175, monto_objetivo: 8000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0150, monto_objetivo: 9500000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0130, monto_objetivo: 11000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0120, monto_objetivo: 12000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0110, monto_objetivo: 13500000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0100, monto_objetivo: 15000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0090, monto_objetivo: 17000000.00 },
  { tipo_cargo: 'PORCENTUAL_HASTA_2200', alicuota: 0.0080, monto_objetivo: 20000000.00 },
];

async function seedAxoEscalas() {
  console.log('--- Limpiando escalas previas de Axo en dim_escalas ---');
  await fetch(SUPABASE_URL + `/rest/v1/dim_escalas?seller_id=eq.${SELLER_ID}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  });

  // Generar meses desde 2025-07-01 hasta 2027-09-01
  const periods = [];
  let cur = new Date('2025-07-01T12:00:00Z');
  const end = new Date('2027-09-01T12:00:00Z');
  while (cur <= end) {
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    periods.push(`${yyyy}-${mm}-01`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  console.log(`Generando escalas para ${periods.length} períodos (${periods[0]} a ${periods[periods.length-1]})...`);

  const allRows = [];
  for (const p of periods) {
    const isReal = p <= '2026-09-01';
    for (const t of TIERS_TEMPLATE) {
      allRows.push({
        seller_id: SELLER_ID,
        periodo: p,
        tipo_cargo: t.tipo_cargo,
        alicuota: t.alicuota,
        monto_objetivo: t.monto_objetivo,
        variacion_mensual: 0,
        pais: 'MX',
        moneda: 'MXN',
        estado: isReal ? 'REAL' : 'PROYECTADO'
      });
    }
  }

  console.log(`Total registros a insertar: ${allRows.length}`);
  
  // Insertar en bloques de 100
  for (let i = 0; i < allRows.length; i += 100) {
    const chunk = allRows.slice(i, i + 100);
    const res = await fetch(SUPABASE_URL + '/rest/v1/dim_escalas', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      console.error(`Error en chunk ${i}:`, res.status, await res.text());
      return;
    }
  }

  console.log('✅ Escalas de Grupo Axo insertadas exitosamente en dim_escalas.');

  // Verificar
  const checkRes = await fetch(SUPABASE_URL + `/rest/v1/dim_escalas?seller_id=eq.${SELLER_ID}&select=count`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'count=exact' }
  });
  console.log('Conteo final en BD:', checkRes.headers.get('content-range'));
}

seedAxoEscalas();
