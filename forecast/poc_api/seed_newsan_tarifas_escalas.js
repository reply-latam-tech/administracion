const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const headers = { 
  apikey: env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 
  Authorization: 'Bearer ' + (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const periods = [
  '2024-01-01', '2024-02-01', '2024-03-01',
  '2024-04-01', '2024-05-01', '2024-06-01',
  '2024-07-01', '2024-08-01', '2024-09-01',
  '2024-10-01', '2024-11-01', '2024-12-01',
  '2025-01-01', '2025-02-01', '2025-03-01',
  '2025-04-01', '2025-05-01', '2025-06-01',
  '2025-07-01', '2025-08-01', '2025-09-01',
  '2025-10-01', '2025-11-01', '2025-12-01',
  '2026-01-01', '2026-02-01', '2026-03-01',
  '2026-04-01', '2026-05-01', '2026-06-01',
  '2026-07-01', '2026-08-01', '2026-09-01',
  '2026-10-01', '2026-11-01', '2026-12-01',
  '2027-01-01', '2027-02-01', '2027-03-01',
  '2027-04-01', '2027-05-01', '2027-06-01',
  '2027-07-01', '2027-08-01', '2027-09-01'
];

const horasTarifasMap = {
  '2024-01-01': 4266.53, '2024-02-01': 4266.53, '2024-03-01': 4266.53,
  '2024-04-01': 6465.34, '2024-05-01': 6465.34, '2024-06-01': 6465.34,
  '2024-07-01': 7666.90, '2024-08-01': 7666.90, '2024-09-01': 7666.90,
  '2024-10-01': 8599.26, '2024-11-01': 8599.27, '2024-12-01': 8599.27,
  '2025-01-01': 9287.57, '2025-02-01': 9287.57, '2025-03-01': 9287.57,
  '2025-04-01': 10079.33, '2025-05-01': 10079.33, '2025-06-01': 10079.33,
  '2025-07-01': 10685.25, '2025-08-01': 10685.25, '2025-09-01': 10685.25,
  '2025-10-01': 11328.15, '2025-11-01': 11328.15, '2025-12-01': 11328.15,
  '2026-01-01': 12211.01, '2026-02-01': 12211.01, '2026-03-01': 12211.01,
  '2026-04-01': 13369.12, '2026-05-01': 13369.12, '2026-06-01': 13369.12,
  '2026-07-01': 14270.86, '2026-08-01': 14270.86, '2026-09-01': 14270.86,
  '2026-10-01': 15099.79, '2026-11-01': 15099.79, '2026-12-01': 15099.79,
  '2027-01-01': 15099.79, '2027-02-01': 15099.79, '2027-03-01': 15099.79,
  '2027-04-01': 15099.79, '2027-05-01': 15099.79, '2027-06-01': 15099.79,
  '2027-07-01': 15099.79, '2027-08-01': 15099.79, '2027-09-01': 15099.79
};

const sesionTarifasMap = {
  '2026-04-01': 793.00, '2026-05-01': 793.00, '2026-06-01': 793.00,
  '2026-07-01': 846.49, '2026-08-01': 846.49, '2026-09-01': 846.49,
  '2026-10-01': 896.00, '2026-11-01': 896.00, '2026-12-01': 896.00,
  '2027-01-01': 896.00, '2027-02-01': 896.00, '2027-03-01': 896.00,
  '2027-04-01': 896.00, '2027-05-01': 896.00, '2027-06-01': 896.00,
  '2027-07-01': 896.00, '2027-08-01': 896.00, '2027-09-01': 896.00
};

async function seed() {
  console.log('1. Eliminando registros existentes de TARIFA_SESION y TARIFA_HORA_EXTRA para seller 989595440...');
  const delRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.989595440&tipo_cargo=in.(TARIFA_SESION,TARIFA_HORA_EXTRA)`, {
    method: 'DELETE',
    headers
  });
  console.log('Delete status:', delRes.status);

  const payload = [];

  // 1. TARIFA_HORA_EXTRA
  let prevHora = 0;
  for (const p of periods) {
    const monto = horasTarifasMap[p] || 15099.79;
    let variacion = 0;
    if (prevHora > 0 && monto !== prevHora) {
      variacion = Math.round(((monto - prevHora) / prevHora) * 10000) / 10000;
    }
    prevHora = monto;
    payload.push({
      seller_id: 989595440,
      periodo: p,
      pais: 'AR',
      moneda: 'ARS',
      tipo_cargo: 'TARIFA_HORA_EXTRA',
      alicuota: 0,
      monto_objetivo: monto,
      variacion_mensual: variacion,
      estado: p <= '2026-10-01' ? 'REAL' : 'PROYECTADO'
    });
  }

  // 2. TARIFA_SESION
  let prevSes = 0;
  for (const p of periods) {
    const monto = sesionTarifasMap[p] || 0;
    let variacion = 0;
    if (prevSes > 0 && monto !== prevSes) {
      variacion = Math.round(((monto - prevSes) / prevSes) * 10000) / 10000;
    }
    if (monto > 0) prevSes = monto;
    payload.push({
      seller_id: 989595440,
      periodo: p,
      pais: 'AR',
      moneda: 'ARS',
      tipo_cargo: 'TARIFA_SESION',
      alicuota: 0,
      monto_objetivo: monto,
      variacion_mensual: variacion,
      estado: p <= '2026-10-01' ? 'REAL' : 'PROYECTADO'
    });
  }

  console.log(`2. Insertando ${payload.length} filas en dim_escalas...`);
  const insRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dim_escalas`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  console.log('Insert status:', insRes.status);
  const data = await insRes.json();
  console.log(`Filas insertadas exitosamente: ${data.length}`);
}

seed();
