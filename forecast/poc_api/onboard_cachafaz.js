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

async function main() {
  console.log('=== ALTA Y ONBOARDING DE CACHAFAZ (685551699) ===\n');

  // 1. Alta o verificación en dim_clientes
  let idCliente = 28;
  const cliCheck = await fetch(`${SUPABASE_URL}/rest/v1/dim_clientes?nombre_cliente=ilike.Cachafaz`, { headers: HEADERS }).then(r => r.json());
  if (cliCheck && cliCheck.length > 0) {
    idCliente = cliCheck[0].id_cliente;
    console.log(`Cliente Cachafaz ya existe con id_cliente: ${idCliente}`);
  } else {
    const newCliRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_clientes`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        nombre_cliente: 'Cachafaz',
        rubro: 'Alimentos & Golosinas',
        pais_origen: 'AR',
        activo: true
      })
    }).then(r => r.json());
    idCliente = newCliRes[0]?.id_cliente || 28;
    console.log(`Cliente Cachafaz creado con id_cliente: ${idCliente}`);
  }

  // 2. Alta o actualización en dim_sellers
  const sellerPayload = {
    id_seller: 685551699,
    nombre_seller: 'Cachafaz',
    pais: 'AR',
    codigo_pais: 'AR',
    moneda: 'ARS',
    estado: true,
    cobrar_botmaker: true,
    frecuencia_actualizacion: 'MENSUAL',
    id_cliente: idCliente,
    codigo_plataforma: 'MELI',
    marca: 'Cachafaz'
  };

  const sellerCheck = await fetch(`${SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.685551699`, { headers: HEADERS }).then(r => r.json());
  if (sellerCheck && sellerCheck.length > 0) {
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.685551699`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify(sellerPayload)
    });
    console.log(`Seller Cachafaz actualizado en dim_sellers | status: ${patchRes.status}`);
  } else {
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_sellers`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(sellerPayload)
    });
    console.log(`Seller Cachafaz insertado en dim_sellers | status: ${postRes.status}`);
    if (!postRes.ok) {
      console.log('Error insert dim_sellers:', await postRes.text());
    }
  }

  // 3. Carga de Facturación Real Octubre 2026 (3.686.440 ARS)
  // Limpiar si existía
  await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.685551699`, {
    method: 'DELETE',
    headers: HEADERS
  });

  const octReal = {
    seller_id: 685551699,
    periodo: '2026-10-01',
    valor_facturado: 3686440,
    variacion_mensual: 0,
    estado: 'REAL'
  };

  await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(octReal)
  });
  console.log(`Facturación Real 10/2026 insertada: $3.686.440 ARS`);

  // 4. Proyección de 11 meses futuros (2026-11 a 2027-09)
  const inflacionRes = await fetch(`${SUPABASE_URL}/rest/v1/inflacion?order=periodo.asc`, { headers: HEADERS }).then(r => r.json());
  const inflacionData = inflacionRes || [];
  const maxPeriodo = inflacionData.length > 0 ? inflacionData[inflacionData.length - 1].periodo : '2027-09-01';

  function getFactorInflacion(periodoOrigen) {
    let factor = 1.0;
    for (const r of inflacionData) {
      if (r.periodo > periodoOrigen && r.periodo <= maxPeriodo) {
        factor *= (1.0 + Number(r.valor_inflacion));
      }
    }
    return factor;
  }

  const factorOct = getFactorInflacion('2026-10-01');
  const volumenBaseReal = 3686440 * factorOct;

  const mesesFuturos = [
    '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01',
    '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01'
  ];

  const proyecciones = [];
  let prevNominal = 3686440;

  for (const mStr of mesesFuturos) {
    const factorM = getFactorInflacion(mStr);
    const nominalProy = Math.round(volumenBaseReal / factorM);
    const varMoM = (nominalProy - prevNominal) / prevNominal;
    prevNominal = nominalProy;

    proyecciones.push({
      seller_id: 685551699,
      periodo: mStr,
      valor_facturado: nominalProy,
      variacion_mensual: Math.round(varMoM * 10000) / 10000,
      estado: 'PROYECTADO'
    });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(proyecciones)
  });
  console.log(`Insertados 11 meses proyectados en facturación para Cachafaz.`);
}

main();
