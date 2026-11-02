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

const REGIONAL_OCTUBRE_REAL = [
  // México
  { id: 765606810, name: 'Grupo Axo - CK ML', val: 2036406.74, pais: 'MX', moneda: 'MXN' },
  { id: 550082876, name: 'Grupo Axo - TH ML', val: 1515621.89, pais: 'MX', moneda: 'MXN' },
  { id: 938333830, name: 'Grupo Axo - CK LVP', val: 1914526.67, pais: 'MX', moneda: 'MXN' },
  { id: 998163061, name: 'Grupo Axo - TH LVP', val: 1909754.15, pais: 'MX', moneda: 'MXN' },
  { id: 807100133, name: 'Evacol México ML', val: 28283.00, pais: 'MX', moneda: 'MXN' },
  { id: 2539005925, name: 'Natura México', val: 2577032.00, pais: 'MX', moneda: 'MXN' },
  // Colombia
  { id: 964690754, name: 'Disuiza Colombia', val: 120938611, pais: 'CO', moneda: 'COP' },
  { id: 2451996780, name: 'Natura Colombia', val: 336003772, pais: 'CO', moneda: 'COP' },
  { id: 2219963574, name: 'Evacol Colombia ML', val: 80918358, pais: 'CO', moneda: 'COP' }
];

async function main() {
  console.log('=== ACTUALIZACIÓN DE FACTURACIÓN REAL OCTUBRE 2026 (MÉXICO Y COLOMBIA) ===\n');

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

  // 2. Traer estacionalidad mensual para los sellers regionales
  const idsStr = REGIONAL_OCTUBRE_REAL.map(s => s.id).join(',');
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

  // 4. Meses futuros a proyectar
  const mesesFuturos = [
    '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01',
    '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01'
  ];

  // 5. Procesar cada seller
  for (const seller of REGIONAL_OCTUBRE_REAL) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Procesando: ${seller.name} (${seller.id}) [${seller.pais} - ${seller.moneda}]`);
    const sepVal = histMap[seller.id]?.['2026-09-01'] || 0;
    const agoVal = histMap[seller.id]?.['2026-08-01'] || 0;
    const varMoMOct = sepVal > 0 ? (seller.val - sepVal) / sepVal : 0;

    console.log(`  Septiembre 2026 Real: ${sepVal.toLocaleString('es-AR')} ${seller.moneda}`);
    console.log(`  Octubre 2026 Real:    ${seller.val.toLocaleString('es-AR')} ${seller.moneda} (Var MoM: ${(varMoMOct * 100).toFixed(2)}%)`);

    // A. Upsert de Octubre 2026 como REAL en public.facturacion
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
    console.log(`  -> Octubre 2026 insertado en 'facturacion' (status: ${insOct.status})`);

    // B. Calcular Volumen Base Real Mensual (a precios de maxPeriodo)
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
    console.log(`  -> Volumen base constante (precios ${maxPeriodo}): ${Math.round(volumenBaseReal).toLocaleString('es-AR')} ${seller.moneda}`);

    // C. Limpiar proyecciones futuras existentes de este seller (2026-11-01 a 2027-09-01) en public.facturacion
    const delProy = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${seller.id}&periodo=gte.2026-11-01`, {
      method: 'DELETE',
      headers: HEADERS
    });
    console.log(`  -> Limpieza proyecciones futuras previas en 'facturacion' (status: ${delProy.status})`);

    // D. Proyectar cada mes futuro (2026-11-01 a 2027-09-01)
    const proyeccionesFacturacion = [];
    const proyeccionesFRH = [];
    let prevValorNominal = seller.val;

    for (const mesStr of mesesFuturos) {
      const mesNum = parseInt(mesStr.split('-')[1], 10);
      const pesoEstacional = estMap[seller.id]?.[mesNum] ?? 1.0;
      const factorInfl = getFactorInflacion(mesStr);

      let valorNominalProy = 0;
      let valorRealEsperado = 0;
      if (volumenBaseReal > 0) {
        valorRealEsperado = volumenBaseReal * pesoEstacional;
        valorNominalProy = Math.round(valorRealEsperado / factorInfl);
      }

      const varMoM = prevValorNominal > 0 ? (valorNominalProy - prevValorNominal) / prevValorNominal : 0;
      prevValorNominal = valorNominalProy;

      proyeccionesFacturacion.push({
        seller_id: seller.id,
        periodo: mesStr,
        valor_facturado: valorNominalProy,
        variacion_mensual: Math.round(varMoM * 10000) / 10000,
        estado: 'PROYECTADO'
      });

      proyeccionesFRH.push({
        seller_id: seller.id,
        periodo_origen: mesStr,
        llevado_a_precios_de: maxPeriodo,
        valor_nominal: valorNominalProy,
        factor_inflacion: factorInfl,
        valor_real: valorRealEsperado,
        estado: 'PROYECTADO'
      });
    }

    if (proyeccionesFacturacion.length > 0) {
      const insProy = await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(proyeccionesFacturacion)
      });
      console.log(`  -> Insertados ${proyeccionesFacturacion.length} meses proyectados en 'facturacion' (status: ${insProy.status})`);
    }

    // E. Sincronizar 'facturacion_real_historica'
    // 1. Limpiar Octubre 2026 y futuros en FRH para eliminar duplicados
    await fetch(`${SUPABASE_URL}/rest/v1/facturacion_real_historica?seller_id=eq.${seller.id}&periodo_origen=gte.2026-10-01`, {
      method: 'DELETE',
      headers: HEADERS
    });

    // 2. Insertar Octubre 2026 REAL en FRH
    const factorOct = getFactorInflacion('2026-10-01');
    const octFRH = {
      seller_id: seller.id,
      periodo_origen: '2026-10-01',
      llevado_a_precios_de: maxPeriodo,
      valor_nominal: Math.round(seller.val * 100) / 100,
      factor_inflacion: factorOct,
      valor_real: seller.val * factorOct,
      estado: 'REAL'
    };
    await fetch(`${SUPABASE_URL}/rest/v1/facturacion_real_historica`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(octFRH)
    });

    // 3. Insertar proyecciones limpias en FRH
    if (proyeccionesFRH.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/facturacion_real_historica`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(proyeccionesFRH)
      });
      console.log(`  -> Sincronizado 'facturacion_real_historica' (Oct-26 REAL + 11 meses PROYECTADO)`);
    }
  }

  console.log('\n==================================================================');
  console.log('✅ ACTUALIZACIÓN REGIONAL COMPLETADA EXITOSAMENTE');
  console.log('==================================================================');
}

main().catch(console.error);
