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

const GEAT_SELLER_ID = 26458937;
const GEAT_VALOR_OCT = 1122084; // 1.122.084 ARS segun facturacion_mensual.txt

async function main() {
  console.log('=== ACTUALIZACIÓN DE FACTURACIÓN REAL OCTUBRE 2026 - GEAT ===\n');

  // 1. Obtener inflación para factores de proyección
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

  // 2. Traer estacionalidad mensual para Geat
  const estRes = await fetch(`${SUPABASE_URL}/rest/v1/estacionalidad_mensual?seller_id=eq.${GEAT_SELLER_ID}&order=id.desc`, { headers: HEADERS }).then(r => r.json());
  const estMap = {};
  (estRes || []).forEach(r => {
    // Tomamos el indice_peso más reciente
    if (!estMap[r.mes]) estMap[r.mes] = Number(r.indice_peso);
  });

  // 3. Traer datos reales históricos de sep y ago para Geat
  const factHistRes = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${GEAT_SELLER_ID}&periodo=in.(2026-08-01,2026-09-01)&order=periodo.asc`, { headers: HEADERS }).then(r => r.json());
  const histMap = {};
  (factHistRes || []).forEach(f => {
    histMap[f.periodo] = Number(f.valor_facturado);
  });

  const sepVal = histMap['2026-09-01'] || 135010;
  const agoVal = histMap['2026-08-01'] || 345069;
  const varMoMOct = sepVal > 0 ? (GEAT_VALOR_OCT - sepVal) / sepVal : 0;

  console.log(`Valores históricos Geat:`);
  console.log(`  - Agosto 2026: $${agoVal.toLocaleString('es-AR')}`);
  console.log(`  - Septiembre 2026: $${sepVal.toLocaleString('es-AR')}`);
  console.log(`  - Octubre 2026 (Nuevo Real): $${GEAT_VALOR_OCT.toLocaleString('es-AR')} (Var MoM: ${(varMoMOct * 100).toFixed(2)}%)\n`);

  // 4. Limpiar cualquier fila existente de Octubre 2026 en facturacion para Geat
  await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${GEAT_SELLER_ID}&periodo=eq.2026-10-01`, {
    method: 'DELETE',
    headers: HEADERS
  });

  // 5. Insertar Octubre 2026 como REAL
  const octPayload = {
    seller_id: GEAT_SELLER_ID,
    periodo: '2026-10-01',
    valor_facturado: GEAT_VALOR_OCT,
    variacion_mensual: Math.round(varMoMOct * 10000) / 10000,
    estado: 'REAL'
  };

  const insOct = await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(octPayload)
  });
  console.log(`-> Octubre 2026 insertado REAL: $${GEAT_VALOR_OCT.toLocaleString('es-AR')} | status: ${insOct.status}`);

  // 6. Calcular Volumen Base Real Mensual puro (a precios de maxPeriodo)
  const mesesReales = [
    { periodo: '2026-08-01', nominal: agoVal },
    { periodo: '2026-09-01', nominal: sepVal },
    { periodo: '2026-10-01', nominal: GEAT_VALOR_OCT }
  ].filter(m => m.nominal > 0);

  let volumenBaseReal = 0;
  if (mesesReales.length > 0) {
    const valoresReales = mesesReales.map(m => m.nominal * getFactorInflacion(m.periodo));
    volumenBaseReal = valoresReales.reduce((a, b) => a + b, 0) / valoresReales.length;
  } else {
    volumenBaseReal = GEAT_VALOR_OCT * getFactorInflacion('2026-10-01');
  }

  console.log(`-> Volumen base real puro (precios ${maxPeriodo}): $${Math.round(volumenBaseReal).toLocaleString('es-AR')}`);

  // 7. Limpiar proyecciones futuras existentes de Geat (2026-11-01 a 2027-09-01) para eliminar duplicados
  const delFuturos = await fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.${GEAT_SELLER_ID}&periodo=gte.2026-11-01`, {
    method: 'DELETE',
    headers: HEADERS
  });
  console.log(`-> Eliminadas proyecciones previas de Geat | status: ${delFuturos.status}`);

  // 8. Proyectar cada mes futuro (2026-11-01 a 2027-09-01)
  const mesesFuturos = [
    '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01',
    '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01'
  ];

  const proyeccionesInsertar = [];
  let prevValorNominal = GEAT_VALOR_OCT;

  for (const mesStr of mesesFuturos) {
    const mesNum = parseInt(mesStr.split('-')[1], 10);
    const pesoEstacional = estMap[mesNum] ?? 1.0;
    const factorInfl = getFactorInflacion(mesStr);

    let valorNominalProy = 0;
    if (volumenBaseReal > 0) {
      const volumenRealEsperado = volumenBaseReal * pesoEstacional;
      valorNominalProy = Math.round(volumenRealEsperado / factorInfl);
    }

    const varMoM = prevValorNominal > 0 ? (valorNominalProy - prevValorNominal) / prevValorNominal : 0;
    prevValorNominal = valorNominalProy;

    proyeccionesInsertar.push({
      seller_id: GEAT_SELLER_ID,
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
    console.log(`-> Insertados ${proyeccionesInsertar.length} meses proyectados (Nov-26 a Sep-27) | status: ${insProy.status}`);
  }

  // 9. Verificar vista liquidaciones para Geat
  console.log('\n=== VERIFICANDO VISTA LIQUIDACIONES PARA GEAT ===');
  const liqs = await fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?seller_id=eq.${GEAT_SELLER_ID}&periodo=gte.2026-08-01&periodo=lte.2027-01-01&order=periodo.asc`, {
    headers: HEADERS
  }).then(r => r.json());

  console.log(`Liquidaciones obtenidas: ${liqs.length}`);
  liqs.forEach(l => {
    console.log(`Periodo: ${l.periodo} [${l.estado}]`);
    console.log(`  GMV: $${Number(l.valor_facturado).toLocaleString('es-AR')}`);
    console.log(`  Tipo cargo: ${l.tipo_cargo_aplicado} | Alícuota: ${l.alicuota_aplicada}`);
    console.log(`  Subtotal ML: $${Number(l.subtotal_mercado_libre).toLocaleString('es-AR')}`);
    console.log(`  Botmaker Orig: $${Number(l.botmaker_original).toLocaleString('es-AR')} | Botmaker (+markup): $${Number(l.botmaker).toLocaleString('es-AR')}`);
    console.log(`  Subtotal: $${Number(l.subtotal).toLocaleString('es-AR')}`);
    console.log(`  IVA: $${Number(l.iva).toLocaleString('es-AR')}`);
    console.log(`  Total: $${Number(l.total_factura).toLocaleString('es-AR')}`);
    console.log('--------------------------------------------------');
  });

  console.log('\n=== PROCESO COMPLETADO EXITOSAMENTE ===');
}

main().catch(console.error);
