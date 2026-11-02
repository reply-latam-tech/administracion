const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function insertOct26() {
  const rows = [
    { seller_id: 765606810, periodo: '2026-10-01', valor_facturado: 883455.00, estado: 'PROYECTADO' },
    { seller_id: 550082876, periodo: '2026-10-01', valor_facturado: 578510.00, estado: 'PROYECTADO' },
    { seller_id: 938333830, periodo: '2026-10-01', valor_facturado: 2452628.00, estado: 'PROYECTADO' },
    { seller_id: 998163061, periodo: '2026-10-01', valor_facturado: 887772.00, estado: 'PROYECTADO' },
  ];
  for (const r of rows) {
    const res = await fetch(SUPABASE_URL + `/rest/v1/facturacion?seller_id=eq.${r.seller_id}&periodo=eq.2026-10-01`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const existing = await res.json();
    if (existing.length === 0) {
      console.log(`Inserting 2026-10-01 for seller ${r.seller_id}...`);
      await fetch(SUPABASE_URL + '/rest/v1/facturacion', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([r])
      });
    }
  }
  console.log('Done checking/inserting Oct 2026.');
}
insertOct26();
