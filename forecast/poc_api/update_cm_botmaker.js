const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

async function run() {
  const patchRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/dim_sellers?id_seller=eq.1088146491', {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ cobrar_botmaker: false })
  });
  console.log('Update cobrar_botmaker=false status:', patchRes.status);
  
  // Verify
  const check = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/dim_sellers?id_seller=eq.1088146491', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY }
  }).then(r => r.json());
  console.log('Cafe Martinez updated in DB:', check[0]);
}

run();
