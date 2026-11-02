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

const OCTUBRE_REAL = [
  { id: 425901767, name: 'La espumeria', val: 191381775.82 },
  { id: 256189964, name: 'Newsan Propio', val: 3501226547 },
  { id: 308973138, name: 'Newsan Motorola', val: 1473511000 },
  { id: 256324891, name: 'Pilisar', val: 1606824536 },
  { id: 414078026, name: 'Alma Nativa', val: 77701624 },
  { id: 195352434, name: 'Nestle', val: 279405423.56 },
  { id: 1088146491, name: 'Cafe Martinez', val: 405184187 },
  { id: 742384574, name: 'Taurus', val: 90060185 },
  { id: 2364040418, name: 'Juan Valdez', val: 26689000 },
  { id: 415143126, name: 'Morixe', val: 84321287 },
  { id: 447463711, name: 'Dapsa', val: 12614719 },
  { id: 1397861779, name: 'Violetta Cosméticos', val: 0 },
  { id: 1684118419, name: 'Lifecycle', val: 11034074 },
  { id: 514936764, name: 'Jansport Argentina', val: 47401567 },
  { id: 936476007, name: 'Salvita', val: 0 },
  { id: 3693335392, name: 'Forbasse', val: 3055607 },
  { id: 1980619742, name: 'Zaz', val: 40714427 }
];

async function main() {
  console.log('=== ACTUALIZACIÓN DE FACTURACIÓN REAL OCTUBRE 2026 Y MOTOR DE PROYECCIONES ===\n');

  // 1. Obtener inflación para factores de deflactación / proyección
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

  // 2. Traer estacionalidad mensual para los sellers
  const idsStr = OCTUBRE_REAL.map(s => s.id).join(',');
  const estRes = await fetch(`${SUPABASE_URL}/rest/v1/estacionalidad_mensual?seller_id=in.(${idsStr})`, { headers: HEADERS }).then(r => r.json());
  const estMap = {};
  (estRes || []).forEach(r => {
    if (!estMap[r.seller_id]) estMap[r.seller_id] = {};
    estMap[r.seller_id][r.mes] = Number(r.indice_peso);
  });

  // 3. Traer datos reales históricos de sep y ago para cada seller
  const factHistRes = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=in.(${idsStr})&periodo=in.(2026-08-01,2026-09-01)&order=periodo.asc`, { headers: HEADERS }).then(r => r.json());
  const histMap = {};
  (factHistRes || []).forEach(f => {
    if (!histMap[f.seller_id]) histMap[f.seller_id] = {};
    histMap[f.seller_id][f.periodo] = Number(f.valor_facturado);
  });

  // 4. Procesar cada seller
  for (const seller of OCTUBRE_REAL) {
    console.log(`\nProcesando: ${seller.name} (${seller.id})...`);
    const sepVal = histMap[seller.id]?.['2026-09-01'] || 0;
    const agoVal = histMap[seller.id]?.['2026-08-01'] || 0;
    const varMoMOct = sepVal > 0 ? (seller.val - sepVal) / sepVal : 0;

    // A. Upsert de Octubre 2026 como REAL
    // Primero borrar si existe para asegurar idempotencia limpia
    await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${seller.id}&periodo=eq.2026-10-01`, {
      method: 'DELETE',
      headers: HEADERS
    });

    const octPayload = {
      seller_id: seller.id,
      periodo: '2026-10-01',
      valor_facturado: Math.round(seller.val * 100) / 100,
      variacion_mensual: Math.round(varMoMOct * 10000) / 10000,
      estado: 'REAL'
    };

    const insOct = await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(octPayload)
    });
    console.log(`  -> Octubre 2026 insertado REAL: $${seller.val.toLocaleString('es-AR')} (Var: ${(varMoMOct * 100).toFixed(2)}%) | status: ${insOct.status}`);

    // B. Calcular Volumen Base Real Mensual (a precios de maxPeriodo)
    // Usamos los 3 meses reales más recientes: Ago, Sep, Oct 2026
    const mesesReales = [
      { periodo: '2026-08-01', nominal: agoVal },
      { periodo: '2026-09-01', nominal: sepVal },
      { periodo: '2026-10-01', nominal: seller.val }
    ].filter(m => m.nominal > 0);

    let volumenBaseReal = 0;
    if (mesesReales.length > 0) {
      const valoresReales = mesesReales.map(m => m.nominal * getFactorInflacion(m.periodo));
      volumenBaseReal = valoresReales.reduce((a, b) => a + b, 0) / valoresReales.length;
    } else {
      volumenBaseReal = seller.val * getFactorInflacion('2026-10-01');
    }

    console.log(`  -> Volumen base real puro (precios ${maxPeriodo}): $${Math.round(volumenBaseReal).toLocaleString('es-AR')}`);

    // C. Limpiar proyecciones futuras existentes de este seller (2026-11-01 a 2027-09-01) para evitar duplicados
    await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${seller.id}&periodo=gte.2026-11-01`, {
      method: 'DELETE',
      headers: HEADERS
    });

    // D. Proyectar cada mes futuro (2026-11-01 a 2027-09-01)
    const mesesFuturos = [
      '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01',
      '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01'
    ];

    const proyeccionesInsertar = [];
    let prevValorNominal = seller.val;

    for (const mesStr of mesesFuturos) {
      const mesNum = parseInt(mesStr.split('-')[1], 10);
      const pesoEstacional = estMap[seller.id]?.[mesNum] ?? 1.0;
      const factorInfl = getFactorInflacion(mesStr);
      
      let valorNominalProy = 0;
      if (volumenBaseReal > 0) {
        const volumenRealEsperado = volumenBaseReal * pesoEstacional;
        valorNominalProy = Math.round(volumenRealEsperado / factorInfl);
      }

      // Si el seller es Violetta o Salvita cuyo valor real es 0, la proyección es 0
      if (seller.val === 0 && sepVal === 0) {
        valorNominalProy = 0;
      }

      const varMoM = prevValorNominal > 0 ? (valorNominalProy - prevValorNominal) / prevValorNominal : 0;
      prevValorNominal = valorNominalProy;

      proyeccionesInsertar.push({
        seller_id: seller.id,
        periodo: mesStr,
        valor_facturado: valorNominalProy,
        variacion_mensual: Math.round(varMoM * 10000) / 10000,
        estado: 'PROYECTADO'
      });
    }

    if (proyeccionesInsertar.length > 0) {
      const insProy = await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(proyeccionesInsertar)
      });
      console.log(`  -> Insertados ${proyeccionesInsertar.length} meses proyectados (Nov-26 a Sep-27) | status: ${insProy.status}`);
    }
  }

  console.log('\n=== ACTUALIZACIÓN DE FACTURACIÓN COMPLETADA ===');
}

main();
