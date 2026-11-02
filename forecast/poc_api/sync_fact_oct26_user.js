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

const updates = [
  { seller_id: 484050606, name: 'Pinturas Online', valor: 45330296, prev: 43652564 },
  { seller_id: 127711636, name: 'Formex Colombia', valor: 35809003, prev: 32246499 },
  { seller_id: 928424062, name: 'Evacol Colombia ADDI', valor: 9180880, prev: 3850000 },
  { seller_id: 984167591, name: 'Alma Nativa México', valor: 90845, prev: 0 },
  { seller_id: 430009374, name: 'Soda Stream ML', valor: 1309172575, prev: 733561551 }
];

async function run() {
  console.log('=== ACTUALIZANDO FACTURACIÓN OCTUBRE 2026 ===\n');

  for (const item of updates) {
    // Check if row exists
    const check = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${item.seller_id}&periodo=eq.2026-10-01`, {
      headers: HEADERS
    }).then(r => r.json());

    const variacion = item.prev > 0 ? (item.valor - item.prev) / item.prev : 0;

    const payload = {
      seller_id: item.seller_id,
      periodo: '2026-10-01',
      valor_facturado: item.valor,
      variacion_mensual: Math.round(variacion * 10000) / 10000,
      estado: 'REAL'
    };

    if (check && check.length > 0) {
      const id = check[0].id;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload)
      });
      console.log(`  Actualizado ${item.name} (${item.seller_id}): $${item.valor.toLocaleString('es-AR')} [status ${res.status}]`);
    } else {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify([payload])
      });
      console.log(`  Insertado ${item.name} (${item.seller_id}): $${item.valor.toLocaleString('es-AR')} [status ${res.status}]`);
    }
  }

  console.log('\nActualización de facturación completada.');
}

run();
