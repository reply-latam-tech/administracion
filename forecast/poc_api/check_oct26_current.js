const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNTS = [
  { name: 'La espumeria', id: 425901767, nuevoValor: 191381775.82 },
  { name: 'Newsan', id: 256189964, nuevoValor: 3501226547 },
  { name: 'Newsan Motorola', id: 308973138, nuevoValor: 1473511000 },
  { name: 'Pilisar', id: 256324891, nuevoValor: 1606824536 },
  { name: 'Alma Nativa', id: 414078026, nuevoValor: 77701624 },
  { name: 'Nestle', id: 195352434, nuevoValor: 279405423.56 },
  { name: 'Cafe Martinez', id: 1088146491, nuevoValor: 405184187 },
  { name: 'Taurus', id: 742384574, nuevoValor: 90060185 },
  { name: 'Juan Valdez', id: 2364040418, nuevoValor: 26689000 },
  { name: 'Morixe', id: 415143126, nuevoValor: 84321287 },
  { name: 'Dapsa', id: 447463711, nuevoValor: 12614719 },
  { name: 'Violetta Cosméticos', id: 1397861779, nuevoValor: 0 },
  { name: 'Lifecycle', id: 1684118419, nuevoValor: 11034074 },
  { name: 'Jansport Argentina', id: 514936764, nuevoValor: 47401567 },
  { name: 'Salvita', id: 936476007, nuevoValor: 0 },
  { name: 'Forbasse', id: 3693335392, nuevoValor: 3055607 },
  { name: 'Zaz', id: 1980619742, nuevoValor: 40714427 },
  { name: 'Geat', id: 26458937, nuevoValor: 1122084 }
];

async function check() {
  const ids = ACCOUNTS.map(a => a.id).join(',');
  const [factRes, liqRes, escRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/facturacion?select=seller_id,periodo,valor_facturado,estado&seller_id=in.(${ids})&periodo=gte.2026-10-01&order=seller_id.asc,periodo.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?select=seller_id,periodo,subtotal,tipo_cargo_aplicado,alicuota_aplicada,estado&seller_id=in.(${ids})&periodo=gte.2026-10-01&order=seller_id.asc,periodo.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?select=seller_id,periodo,tipo_cargo,alicuota,monto_objetivo&seller_id=in.(${ids})&periodo=eq.2026-10-01`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }).then(r => r.json())
  ]);

  console.log(`Found ${factRes.length} facturacion rows from 2026-10-01`);
  console.log(`Found ${liqRes.length} liquidaciones rows from 2026-10-01`);
  console.log(`Found ${escRes.length} escalas rows for 2026-10-01`);

  ACCOUNTS.forEach(acc => {
    const fOct = factRes.find(f => f.seller_id === acc.id && f.periodo === '2026-10-01');
    const lOct = liqRes.find(l => l.seller_id === acc.id && l.periodo === '2026-10-01');
    const esc = escRes.filter(e => e.seller_id === acc.id);
    console.log(`\n--- ${acc.name} (${acc.id}) ---`);
    console.log(`  Nuevo Real: $${acc.nuevoValor.toLocaleString('es-AR')}`);
    console.log(`  Facturacion actual 2026-10:`, fOct || 'NO EXISTE');
    console.log(`  Liquidacion actual 2026-10:`, lOct || 'NO EXISTE');
    console.log(`  Escalas para 2026-10: ${esc.length} tramos`);
  });
}

check();
