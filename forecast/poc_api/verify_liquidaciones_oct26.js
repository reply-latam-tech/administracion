const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const SELLER_IDS = [
  425901767, 256189964, 308973138, 256324891, 414078026, 195352434, 1088146491, 
  742384574, 2364040418, 415143126, 447463711, 1397861779, 1684118419, 514936764,
  936476007, 3693335392, 1980619742
];

async function verify() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?seller_id=in.(${SELLER_IDS.join(',')})&periodo=eq.2026-10-01&order=nombre_seller.asc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  }).then(r => r.json());

  console.log(`=== LIQUIDACIONES RESULTANTES OCTUBRE 2026 (${res.length} registros) ===\n`);
  let totalSubtotal = 0;
  let totalIVA = 0;
  let totalFactura = 0;

  res.forEach(r => {
    totalSubtotal += Number(r.subtotal) || 0;
    totalIVA += Number(r.iva) || 0;
    totalFactura += Number(r.total_factura) || 0;

    console.log(`${r.nombre_seller} (${r.seller_id}):`);
    console.log(`  GMV: $${Number(r.valor_facturado).toLocaleString('es-AR')}`);
    console.log(`  Tipo Cargo: ${r.tipo_cargo_aplicado} | Alícuota: ${r.alicuota_aplicada}`);
    console.log(`  Subtotal: $${Number(r.subtotal).toLocaleString('es-AR')}`);
    console.log(`  IVA (21%): $${Number(r.iva).toLocaleString('es-AR')}`);
    console.log(`  Total Factura: $${Number(r.total_factura).toLocaleString('es-AR')}`);
    console.log(`  Estado: ${r.estado}`);
    console.log('--------------------------------------------------');
  });

  console.log(`\nTOTAL SUBTOTAL INGRESO REPLY (OCT/26): $${totalSubtotal.toLocaleString('es-AR')}`);
  console.log(`TOTAL IVA (DÉBITO FISCAL): $${totalIVA.toLocaleString('es-AR')}`);
  console.log(`TOTAL GENERAL A COBRAR (OCT/26): $${totalFactura.toLocaleString('es-AR')}`);
}

verify();
