const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

async function main() {
  console.log('=== ACTUALIZACIÓN DE ESTADO Y VARIACIONES EN DIM_ESCALAS ===\n');

  // 1. Actualizar todas las filas de dim_escalas para periodo = 2026-10-01 a estado = 'REAL'
  console.log('1. Actualizando periodo 2026-10-01 a estado REAL en dim_escalas...');
  const resOct = await fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?periodo=eq.2026-10-01`, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ estado: 'REAL' })
  });
  console.log(`  -> Status actualización 2026-10-01: ${resOct.status}`);

  // 2. Actualizar variacion_mensual de Newsan Tienda Web (seller_id = 989595440) para 2026-09-01
  console.log('\n2. Actualizando variaciones de Newsan Tienda Web para septiembre 2026...');
  // Traer filas de agosto y septiembre de Newsan Web
  const [agoRows, sepRows] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.989595440&periodo=eq.2026-08-01`, { headers: HEADERS }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.989595440&periodo=eq.2026-09-01`, { headers: HEADERS }).then(r => r.json())
  ]);

  const agoMap = {};
  agoRows.forEach(r => {
    const key = `${r.tipo_cargo}_${r.alicuota}`;
    agoMap[key] = Number(r.monto_objetivo);
  });

  for (const sep of sepRows) {
    const key = `${sep.tipo_cargo}_${sep.alicuota}`;
    const agoMonto = agoMap[key];
    if (agoMonto && agoMonto > 0) {
      const varMoM = (Number(sep.monto_objetivo) - agoMonto) / agoMonto;
      const roundedVar = Math.round(varMoM * 10000) / 10000;
      
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?id=eq.${sep.id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ variacion_mensual: roundedVar })
      });
      console.log(`  -> Sep ${key}: Monto $${sep.monto_objetivo} vs Ago $${agoMonto} -> Var: ${(roundedVar * 100).toFixed(2)}% [status ${patchRes.status}]`);
    }
  }

  // 3. Verificar recuento final por estado en 2026-10-01
  console.log('\n3. Verificando estado de escalas en 2026-10-01...');
  const check = await fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?periodo=eq.2026-10-01&select=estado`, { headers: HEADERS }).then(r => r.json());
  const counts = {};
  check.forEach(r => { counts[r.estado] = (counts[r.estado] || 0) + 1; });
  console.log('  -> Estados en 2026-10-01:', counts);
}

main().catch(console.error);
