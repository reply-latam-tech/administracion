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
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

const SELLERS_WITH_BOTMAKER = [
  414078026,  // Alma Nativa
  1088146491, // Cafe Martinez
  447463711,  // Dapsa
  964690754,  // Disuiza Colombia
  3693335392, // Forbasse
  26458937,   // GEAT
  1181954123, // Go Advance
  514936764,  // Jansport Argentina
  2364040418, // Juan Valdez
  425901767,  // La espumeria
  1684118419, // Lifecycle
  415143126,  // Morixe
  2539005925, // Natura México
  195352434,  // Nestle
  942368053,  // Newsan Chile ML
  484050606,  // Pinturas Online
  430009374,  // Soda Stream ML
  742384574,  // Taurus
  1397861779, // Violetta Cosméticos
  173637868,  // Abarka
  685551699,  // Cachafaz
  1980619742  // Zaz
];

async function main() {
  console.log('=== ACTUALIZACIÓN DE COBRAR_BOTMAKER Y CARGA DE BOTMAKER OCTUBRE 2026 ===\n');

  // 1. Activar cobrar_botmaker = true en dim_sellers
  console.log('1. Actualizando cobrar_botmaker = true en dim_sellers...');
  for (const sid of SELLERS_WITH_BOTMAKER) {
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.${sid}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ cobrar_botmaker: true })
    });
    if (patchRes.ok) {
      console.log(`  -> Seller ${sid}: cobrar_botmaker = true`);
    } else {
      console.error(`  -> Error seller ${sid}:`, await patchRes.text());
    }
  }

  // 2. Traer registros de botmaker_consumos de 2026-09-01
  console.log('\n2. Trayendo consumos de Botmaker de septiembre (2026-09-01)...');
  const sepConsumos = await fetch(`${SUPABASE_URL}/rest/v1/botmaker_consumos?periodo=eq.2026-09-01`, {
    headers: HEADERS
  }).then(r => r.json());
  console.log(`  -> Obtenidos ${sepConsumos.length} registros de septiembre.`);

  // 3. Crear registros para periodo 2026-10-01
  const octConsumos = sepConsumos.map(c => ({
    periodo: '2026-10-01',
    seller_id: c.seller_id,
    child_project_id: c.child_project_id,
    child_project_name: c.child_project_name,
    total_billed: c.total_billed,
    raw_data: c.raw_data
  }));

  console.log('\n3. Insertando consumos en botmaker_consumos para periodo 2026-10-01...');
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/botmaker_consumos`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(octConsumos)
  });
  console.log(`  -> Status upsert 2026-10-01: ${upsertRes.status}`);
  if (!upsertRes.ok) {
    console.error('Error:', await upsertRes.text());
  }

  // 4. Verificar vista liquidaciones para 2026-10-01
  console.log('\n4. Verificando vista liquidaciones para 2026-10-01...');
  const liqs = await fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?periodo=eq.2026-10-01&order=nombre_seller.asc`, {
    headers: HEADERS
  }).then(r => r.json());

  console.log(`Total liquidaciones en 2026-10-01: ${liqs.length}\n`);
  liqs.filter(l => Number(l.botmaker) > 0 || l.cobrar_botmaker).forEach(l => {
    console.log(`${l.nombre_seller} (${l.seller_id}):`);
    console.log(`  Honorarios ML: $${Number(l.subtotal_mercado_libre).toLocaleString('es-AR')}`);
    console.log(`  Botmaker Original: $${Number(l.botmaker_original).toLocaleString('es-AR')}`);
    console.log(`  Botmaker (+20%): $${Number(l.botmaker).toLocaleString('es-AR')}`);
    console.log(`  Subtotal: $${Number(l.subtotal).toLocaleString('es-AR')}`);
    console.log(`  IVA (21%): $${Number(l.iva).toLocaleString('es-AR')}`);
    console.log(`  Total Factura: $${Number(l.total_factura).toLocaleString('es-AR')}`);
    console.log('--------------------------------------------------');
  });
}

main();
