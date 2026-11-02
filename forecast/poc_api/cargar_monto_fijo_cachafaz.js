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

const SELLER_ID = 685551699;
const FIXED_AMOUNT = 2200000;

async function main() {
  console.log('=== CONFIGURANDO MONTO FIJO PARA CACHAFAZ ===\n');

  // 1. Limpiar dim_escalas existentes para Cachafaz
  await fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.${SELLER_ID}`, {
    method: 'DELETE',
    headers: HEADERS
  });
  console.log('1. Escalas previas de Cachafaz limpiadas.');

  // 2. Insertar escalas (MINIMO $2.200.000)
  // Reales: Ago-26, Sep-26, Oct-26
  // Proyectadas: Nov-26 a Sep-27
  const periodosReales = ['2026-08-01', '2026-09-01', '2026-10-01'];
  const periodosProy = [
    '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01',
    '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01'
  ];

  const escalasInsertar = [];
  for (const p of periodosReales) {
    escalasInsertar.push({
      seller_id: SELLER_ID,
      periodo: p,
      tipo_cargo: 'MINIMO',
      alicuota: 0,
      monto_objetivo: FIXED_AMOUNT,
      moneda: 'ARS',
      pais: 'AR',
      estado: 'REAL'
    });
  }
  for (const p of periodosProy) {
    escalasInsertar.push({
      seller_id: SELLER_ID,
      periodo: p,
      tipo_cargo: 'MINIMO',
      alicuota: 0,
      monto_objetivo: FIXED_AMOUNT,
      moneda: 'ARS',
      pais: 'AR',
      estado: 'PROYECTADO'
    });
  }

  const insEsc = await fetch(`${SUPABASE_URL}/rest/v1/dim_escalas`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(escalasInsertar)
  });
  console.log(`2. Insertadas ${escalasInsertar.length} escalas en 'dim_escalas' (status: ${insEsc.status}).`);

  // 3. Asegurar que facturacion tenga registros en 2026-08-01 y 2026-09-01 para que la vista liquidaciones genere los meses
  const factExistente = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${SELLER_ID}&periodo=in.(2026-08-01,2026-09-01)`, {
    headers: HEADERS
  }).then(r => r.json());

  const periodosFactExistentes = (factExistente || []).map(f => f.periodo);
  const factInsertar = [];
  if (!periodosFactExistentes.includes('2026-08-01')) {
    factInsertar.push({
      seller_id: SELLER_ID,
      periodo: '2026-08-01',
      valor_facturado: 0,
      variacion_mensual: 0,
      estado: 'REAL'
    });
  }
  if (!periodosFactExistentes.includes('2026-09-01')) {
    factInsertar.push({
      seller_id: SELLER_ID,
      periodo: '2026-09-01',
      valor_facturado: 0,
      variacion_mensual: 0,
      estado: 'REAL'
    });
  }

  if (factInsertar.length > 0) {
    const insFact = await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(factInsertar)
    });
    console.log(`3. Insertados ${factInsertar.length} periodos base en 'facturacion' (status: ${insFact.status}).`);
  } else {
    console.log('3. Facturacion ya cuenta con periodos Ago y Sep.');
  }

  // 4. Consultar y verificar liquidaciones generadas para Cachafaz
  console.log('\n4. Verificando vista `public.liquidaciones` para Cachafaz:');
  const liqs = await fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?seller_id=eq.${SELLER_ID}&order=periodo.asc`, {
    headers: HEADERS
  }).then(r => r.json());

  console.table(liqs.map(l => ({
    Periodo: l.periodo,
    Seller: l.nombre_seller,
    GMV: l.valor_facturado,
    Cargo: l.tipo_cargo_aplicado,
    Subtotal_MELI: l.subtotal_mercado_libre,
    Botmaker: l.botmaker,
    Subtotal: l.subtotal,
    IVA: l.iva,
    Total: l.total_factura,
    Estado: l.estado
  })));
}

main().catch(console.error);
