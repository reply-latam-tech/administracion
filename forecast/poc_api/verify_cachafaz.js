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
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY
};

async function main() {
  console.log('=== VERIFICACIÓN COMPLETA CACHAFAZ (685551699) ===\n');

  // 1. Cliente
  const cli = await fetch(`${SUPABASE_URL}/rest/v1/dim_clientes?nombre_cliente=ilike.Cachafaz`, { headers: HEADERS }).then(r => r.json());
  console.log('1. dim_clientes:', cli);

  // 2. Seller
  const seller = await fetch(`${SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.685551699`, { headers: HEADERS }).then(r => r.json());
  console.log('2. dim_sellers:', seller);

  // 3. Facturación
  const fact = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.685551699&order=periodo.asc`, { headers: HEADERS }).then(r => r.json());
  console.log(`3. facturacion (${fact.length} filas):`);
  fact.forEach(f => {
    console.log(`  ${f.periodo}: $${Number(f.valor_facturado).toLocaleString('es-AR')} | Var: ${(f.variacion_mensual * 100).toFixed(2)}% | ${f.estado}`);
  });

  // 4. Órdenes sincronizadas
  const ordCount = await fetch(`${SUPABASE_URL}/rest/v1/ordenes?seller_id=eq.685551699&select=order_id,date_created,total_amount,status&order=date_created.desc&limit=10`, { headers: HEADERS }).then(r => r.json());
  console.log(`\n4. Muestra de órdenes sincronizadas (Top 10 más recientes):`);
  console.log(ordCount);

  // Total ordenes
  const totalOrdRes = await fetch(`${SUPABASE_URL}/rest/v1/ordenes?seller_id=eq.685551699&select=count`, {
    headers: { ...HEADERS, 'Range-Unit': 'items', 'Prefer': 'count=exact' }
  });
  console.log('Total órdenes en BD:', totalOrdRes.headers.get('content-range'));

  // 5. Liquidaciones
  const liq = await fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?seller_id=eq.685551699&periodo=eq.2026-10-01`, { headers: HEADERS }).then(r => r.json());
  console.log('\n5. liquidaciones (2026-10-01):', liq);
}

main();
