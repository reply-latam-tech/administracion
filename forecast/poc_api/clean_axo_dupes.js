const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function cleanAxoDupes() {
  const axoIds = [765606810, 938333830, 550082876, 998163061];
  for (const sid of axoIds) {
    const res = await fetch(SUPABASE_URL + `/rest/v1/facturacion?seller_id=eq.${sid}&select=id,periodo,valor_facturado,estado&order=periodo.asc,id.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const rows = await res.json();
    const seen = new Set();
    const toDelete = [];
    rows.forEach(r => {
      if (seen.has(r.periodo)) {
        toDelete.push(r.id);
      } else {
        seen.add(r.periodo);
      }
    });
    if (toDelete.length > 0) {
      console.log(`Seller ${sid}: deleting ${toDelete.length} duplicate IDs:`, toDelete);
      for (const id of toDelete) {
        await fetch(SUPABASE_URL + `/rest/v1/facturacion?id=eq.${id}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
      }
    } else {
      console.log(`Seller ${sid}: No duplicates found.`);
    }
  }
}
cleanAxoDupes();
