const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?seller_id=eq.26458937&periodo=eq.2026-10-01`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  }).then(r => r.json());

  const row = res[0];
  console.log('Fila cruda de liquidaciones para Geat 2026-10:', row);

  // Lógica del frontend en liquidaciones/page.tsx:
  let subtotalVal = Number(row.subtotal) || 0;
  let montoServicio = Number(row.subtotal_mercado_libre) || 0;
  let ivaVal = Number(row.iva) || 0;
  let totalVal = Number(row.total_factura) || 0;
  let botmakerVal = Number(row.botmaker) || 0;
  let factVal = Number(row.valor_facturado) || 0;

  // Frontend adjustment:
  const origBm = Number(row.botmaker_original) || 0;
  if (origBm > 0) {
    botmakerVal = Math.round(origBm * 1.25 * 100) / 100;
  }
  subtotalVal = montoServicio + botmakerVal;
  ivaVal = Math.round(subtotalVal * 0.21 * 100) / 100;
  totalVal = subtotalVal + ivaVal;

  console.log('\nValores calculados en el frontend para Geat 2026-10:');
  console.log(`  GMV: $${factVal.toLocaleString('es-AR')}`);
  console.log(`  Monto Servicio (Mínimo): $${montoServicio.toLocaleString('es-AR')}`);
  console.log(`  Botmaker (+25% markup): $${botmakerVal.toLocaleString('es-AR')}`);
  console.log(`  Subtotal: $${subtotalVal.toLocaleString('es-AR')}`);
  console.log(`  IVA (21%): $${ivaVal.toLocaleString('es-AR')}`);
  console.log(`  Total Factura: $${totalVal.toLocaleString('es-AR')}`);
  console.log(`  Estado: ${row.estado}`);
}

check().catch(console.error);
