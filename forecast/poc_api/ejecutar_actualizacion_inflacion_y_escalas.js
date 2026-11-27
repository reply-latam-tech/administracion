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
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

async function fetchAll(url) {
  let all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const res = await fetch(`${url}&limit=${limit}&offset=${offset}`, { headers: HEADERS });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

// 1. Inflación
const inflationData = [
  { periodo: '2026-10-01', valor_inflacion: 0.022, estado: 'REAL' },
  { periodo: '2026-11-01', valor_inflacion: 0.017, estado: 'PROYECTADO' },
  { periodo: '2026-12-01', valor_inflacion: 0.018, estado: 'PROYECTADO' },
  { periodo: '2027-01-01', valor_inflacion: 0.017, estado: 'PROYECTADO' },
  { periodo: '2027-02-01', valor_inflacion: 0.016, estado: 'PROYECTADO' },
  { periodo: '2027-03-01', valor_inflacion: 0.017, estado: 'PROYECTADO' },
  { periodo: '2027-04-01', valor_inflacion: 0.017, estado: 'PROYECTADO' },
  { periodo: '2027-05-01', valor_inflacion: 0.018594, estado: 'PROYECTADO' },
  { periodo: '2027-06-01', valor_inflacion: 0.018594, estado: 'PROYECTADO' },
  { periodo: '2027-07-01', valor_inflacion: 0.018594, estado: 'PROYECTADO' },
  { periodo: '2027-08-01', valor_inflacion: 0.018594, estado: 'PROYECTADO' },
  { periodo: '2027-09-01', valor_inflacion: 0.018594, estado: 'PROYECTADO' },
  { periodo: '2027-10-01', valor_inflacion: 0.018594, estado: 'PROYECTADO' }
];

// Meses proyectados para escalas
const projectedMonths = [
  '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01',
  '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01',
  '2027-07-01', '2027-08-01', '2027-09-01', '2027-10-01'
];

// Sellers mensuales ARS
const MONTHLY_SELLERS = [
  936476007,   // Salvita
  414078026,   // Alma Nativa
  26458937,    // GEAT
  2364040418,  // Juan Valdez
  425901767,   // La espumeria
  1684118419,  // Lifecycle
  415143126,   // Morixe
  195352434,   // Nestle
  742384574,   // Taurus
  1397861779,  // Violetta Cosméticos
  1088146491,  // Cafe Martinez
  484050606,   // Pinturas Online
  3693335392,  // Forbasse
  901000002,   // Granix
  1980619742   // Zaz
];

// Sellers trimestrales ARS
const QUARTERLY_SELLERS = [
  447463711,   // Dapsa
  256189964,   // Newsan ML
  989595440    // Newsan Tienda Web
];

// Soda Stream
const SODA_SELLERS = [
  430009374,   // Soda Stream ML
  978681369    // Soda Stream Web
];

async function updateInflation() {
  console.log('--- 1. ACTUALIZANDO TABLA INFLACIÓN ---');
  for (const row of inflationData) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/inflacion?periodo=eq.${row.periodo}`, {
      method: 'GET',
      headers: HEADERS
    });
    const existing = await res.json();
    if (existing && existing.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/inflacion?periodo=eq.${row.periodo}`, {
        method: 'PATCH',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({ valor_inflacion: row.valor_inflacion, estado: row.estado })
      });
      console.log(`  Actualizado ${row.periodo}: ${(row.valor_inflacion * 100).toFixed(2)}% (${row.estado})`);
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/inflacion`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify(row)
      });
      console.log(`  Insertado ${row.periodo}: ${(row.valor_inflacion * 100).toFixed(2)}% (${row.estado})`);
    }
  }
}

async function updateScales() {
  console.log('\n--- 2. RECALCULANDO Y ACTUALIZANDO ESCALAS ---');

  // Traer todas las escalas base de Octubre 2026 para los sellers mensuales, trimestrales y Soda
  const allTargetSellers = [...MONTHLY_SELLERS, ...QUARTERLY_SELLERS, ...SODA_SELLERS];
  const octRows = await fetchAll(`${SUPABASE_URL}/rest/v1/dim_escalas?periodo=eq.2026-10-01&seller_id=in.(${allTargetSellers.join(',')})`);
  console.log(`  Cargadas ${octRows.length} filas base de Octubre 2026 para ${allTargetSellers.length} sellers.`);

  // Mapa base por seller
  const octMap = {};
  octRows.forEach(r => {
    if (!octMap[r.seller_id]) octMap[r.seller_id] = [];
    octMap[r.seller_id].push(r);
  });

  const newScalesRows = [];

  // A. PROCESAR SELLERS MENSUALES
  console.log('\n  A. Procesando 15 sellers mensuales...');
  // Factores mensuales:
  // nov/26: inf oct/26 = 0.022
  // dic/26: inf nov/26 = 0.017
  // ene/27: inf dic/26 = 0.018
  // feb/27: inf ene/27 = 0.017
  // mar/27: inf feb/27 = 0.016
  // abr/27: inf mar/27 = 0.017
  // may/27: inf abr/27 = 0.017
  // jun/27: inf may/27 = 0.018594
  // jul/27: inf jun/27 = 0.018594
  // ago/27: inf jul/27 = 0.018594
  // sep/27: inf ago/27 = 0.018594
  // oct/27: inf sep/27 = 0.018594
  const monthlyRates = [
    { periodo: '2026-11-01', rate: 0.022 },
    { periodo: '2026-12-01', rate: 0.017 },
    { periodo: '2027-01-01', rate: 0.018 },
    { periodo: '2027-02-01', rate: 0.017 },
    { periodo: '2027-03-01', rate: 0.016 },
    { periodo: '2027-04-01', rate: 0.017 },
    { periodo: '2027-05-01', rate: 0.017 },
    { periodo: '2027-06-01', rate: 0.018594 },
    { periodo: '2027-07-01', rate: 0.018594 },
    { periodo: '2027-08-01', rate: 0.018594 },
    { periodo: '2027-09-01', rate: 0.018594 },
    { periodo: '2027-10-01', rate: 0.018594 }
  ];

  for (const sId of MONTHLY_SELLERS) {
    const baseList = octMap[sId] || [];
    if (baseList.length === 0) {
      console.warn(`    [WARN] No hay escalas oct/26 para seller ${sId}`);
      continue;
    }

    let prevScales = baseList.map(r => ({ ...r }));

    for (const step of monthlyRates) {
      const nextScales = prevScales.map(r => {
        const nuevoMonto = Math.round(Number(r.monto_objetivo) * (1 + step.rate) * 100) / 100;
        return {
          seller_id: r.seller_id,
          periodo: step.periodo,
          tipo_cargo: r.tipo_cargo,
          alicuota: r.alicuota,
          monto_objetivo: nuevoMonto,
          moneda: r.moneda,
          pais: r.pais,
          estado: 'PROYECTADO',
          variacion_mensual: step.rate
        };
      });
      newScalesRows.push(...nextScales);
      prevScales = nextScales;
    }
  }

  // B. PROCESAR SELLERS TRIMESTRALES (Dapsa, Newsan ML, Newsan Tienda Web)
  console.log('\n  B. Procesando 3 sellers trimestrales...');
  const q1Factor = (1 + 0.022) * (1 + 0.017) * (1 + 0.018) - 1; // 0.058089 (5.81%)
  const q2Factor = (1 + 0.017) * (1 + 0.016) * (1 + 0.017) - 1; // 0.050854 (5.09%)
  const q3Factor = (1 + 0.017) * (1 + 0.018594) * (1 + 0.018594) - 1; // 0.05517 (5.52%)
  const q4Factor = Math.pow(1 + 0.018594, 3) - 1; // 0.0568 (5.68%)

  for (const sId of QUARTERLY_SELLERS) {
    const baseList = octMap[sId] || [];
    if (baseList.length === 0) continue;

    // Nov 26 y Dic 26 (mismo monto que Oct 26, var 0)
    for (const p of ['2026-11-01', '2026-12-01']) {
      newScalesRows.push(...baseList.map(r => ({
        seller_id: r.seller_id,
        periodo: p,
        tipo_cargo: r.tipo_cargo,
        alicuota: r.alicuota,
        monto_objetivo: Number(r.monto_objetivo),
        moneda: r.moneda,
        pais: r.pais,
        estado: 'PROYECTADO',
        variacion_mensual: 0
      })));
    }

    // Q1 2027 (Ene, Feb, Mar 27): +5.81%
    const eneScales = baseList.map(r => ({
      seller_id: r.seller_id,
      periodo: '2027-01-01',
      tipo_cargo: r.tipo_cargo,
      alicuota: r.alicuota,
      monto_objetivo: Math.round(Number(r.monto_objetivo) * (1 + q1Factor) * 100) / 100,
      moneda: r.moneda,
      pais: r.pais,
      estado: 'PROYECTADO',
      variacion_mensual: Math.round(q1Factor * 10000) / 10000
    }));
    newScalesRows.push(...eneScales);

    for (const p of ['2027-02-01', '2027-03-01']) {
      newScalesRows.push(...eneScales.map(r => ({
        ...r,
        periodo: p,
        variacion_mensual: 0
      })));
    }

    // Q2 2027 (Abr, May, Jun 27): +5.09% sobre Ene
    const abrScales = eneScales.map(r => ({
      seller_id: r.seller_id,
      periodo: '2027-04-01',
      tipo_cargo: r.tipo_cargo,
      alicuota: r.alicuota,
      monto_objetivo: Math.round(Number(r.monto_objetivo) * (1 + q2Factor) * 100) / 100,
      moneda: r.moneda,
      pais: r.pais,
      estado: 'PROYECTADO',
      variacion_mensual: Math.round(q2Factor * 10000) / 10000
    }));
    newScalesRows.push(...abrScales);

    for (const p of ['2027-05-01', '2027-06-01']) {
      newScalesRows.push(...abrScales.map(r => ({
        ...r,
        periodo: p,
        variacion_mensual: 0
      })));
    }

    // Q3 2027 (Jul, Ago, Sep 27): +5.52% sobre Abr
    const julScales = abrScales.map(r => ({
      seller_id: r.seller_id,
      periodo: '2027-07-01',
      tipo_cargo: r.tipo_cargo,
      alicuota: r.alicuota,
      monto_objetivo: Math.round(Number(r.monto_objetivo) * (1 + q3Factor) * 100) / 100,
      moneda: r.moneda,
      pais: r.pais,
      estado: 'PROYECTADO',
      variacion_mensual: Math.round(q3Factor * 10000) / 10000
    }));
    newScalesRows.push(...julScales);

    for (const p of ['2027-08-01', '2027-09-01']) {
      newScalesRows.push(...julScales.map(r => ({
        ...r,
        periodo: p,
        variacion_mensual: 0
      })));
    }

    // Octubre 2027
    const oct27Scales = julScales.map(r => ({
      seller_id: r.seller_id,
      periodo: '2027-10-01',
      tipo_cargo: r.tipo_cargo,
      alicuota: r.alicuota,
      monto_objetivo: Math.round(Number(r.monto_objetivo) * (1 + q4Factor) * 100) / 100,
      moneda: r.moneda,
      pais: r.pais,
      estado: 'PROYECTADO',
      variacion_mensual: Math.round(q4Factor * 10000) / 10000
    }));
    newScalesRows.push(...oct27Scales);
  }

  // C. PROCESAR SODA STREAM (ML y Web)
  console.log('\n  C. Procesando Soda Stream (ML y Web)...');
  // Traer las escalas existentes de Soda Stream para Nov y Dic 2026 (que están fijas en el contrato)
  const sodaNovDic = await fetchAll(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=in.(430009374,978681369)&periodo=in.(2026-11-01,2026-12-01)`);
  // Mantener Nov y Dic tal cual
  for (const r of sodaNovDic) {
    newScalesRows.push({
      seller_id: r.seller_id,
      periodo: r.periodo,
      tipo_cargo: r.tipo_cargo,
      alicuota: r.alicuota,
      monto_objetivo: Number(r.monto_objetivo),
      moneda: r.moneda,
      pais: r.pais,
      estado: 'PROYECTADO',
      variacion_mensual: 0
    });
  }

  // A partir de 2027-01 indexar Soda Stream mensualmente sobre base Dic 2026
  const sodaDicMap = {};
  sodaNovDic.filter(r => r.periodo === '2026-12-01').forEach(r => {
    if (!sodaDicMap[r.seller_id]) sodaDicMap[r.seller_id] = [];
    sodaDicMap[r.seller_id].push(r);
  });

  const soda2027Rates = monthlyRates.slice(2); // desde 2027-01 en adelante
  for (const sId of SODA_SELLERS) {
    let prevList = sodaDicMap[sId] || [];
    for (const step of soda2027Rates) {
      const nextList = prevList.map(r => ({
        seller_id: r.seller_id,
        periodo: step.periodo,
        tipo_cargo: r.tipo_cargo,
        alicuota: r.alicuota,
        monto_objetivo: Math.round(Number(r.monto_objetivo) * (1 + step.rate) * 100) / 100,
        moneda: r.moneda,
        pais: r.pais,
        estado: 'PROYECTADO',
        variacion_mensual: step.rate
      }));
      newScalesRows.push(...nextList);
      prevList = nextList;
    }
  }

  console.log(`\n  Total de nuevas filas a insertar en dim_escalas: ${newScalesRows.length}`);

  // D. ELIMINAR ESCALAS PROYECTADAS PREVIAS PARA ESTOS SELLERS (periodo gte 2026-11-01)
  console.log('\n  D. Eliminando escalas proyectadas previas (gte 2026-11-01)...');
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=in.(${allTargetSellers.join(',')})&periodo=gte.2026-11-01`, {
    method: 'DELETE',
    headers: HEADERS
  });
  console.log(`    Status eliminación: ${delRes.status}`);

  // E. INSERTAR EN LOTES DE 100 FILAS
  console.log('\n  E. Insertando nuevas escalas en lotes...');
  const batchSize = 100;
  for (let i = 0; i < newScalesRows.length; i += batchSize) {
    const chunk = newScalesRows.slice(i, i + batchSize);
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/dim_escalas`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify(chunk)
    });
    if (!insRes.ok) {
      console.error(`    [ERROR] Lote ${i / batchSize + 1}:`, await insRes.text());
    }
  }
  console.log(`    Inserción completada exitosamente (${newScalesRows.length} filas creadas).`);
}

async function main() {
  await updateInflation();
  await updateScales();
  console.log('\n=== PROCESO COMPLETADO EXITOSAMENTE ===');
}

main().catch(console.error);
