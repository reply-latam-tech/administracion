const fs = require('fs');
const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };

const formatMonthKey = (periodo) => {
  const date = new Date(periodo + "T12:00:00");
  let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  mStr = mStr.replace(/\./g, '').trim();
  return mStr.charAt(0).toUpperCase() + mStr.slice(1);
};

async function testFixedLogic() {
  const [newsanEscalas, newsanLiqs, factNewsanData, dapsaEscalas, dapsaLiqs, newsanWebEscalas] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.256189964&periodo=in.(2026-09-01,2026-10-01)&order=periodo.asc,monto_objetivo.asc`, { headers: HEADERS }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?seller_id=eq.256189964&periodo=in.(2026-09-01,2026-10-01)&order=periodo.asc`, { headers: HEADERS }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/facturacion?seller_id=in.(256189964,308973138,256324891)&periodo=gte.2026-08-01`, { headers: HEADERS }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.447463711&periodo=eq.2026-10-01&order=monto_objetivo.asc`, { headers: HEADERS }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/liquidaciones?seller_id=eq.447463711&periodo=eq.2026-10-01`, { headers: HEADERS }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.989595440&periodo=in.(2026-09-01,2026-10-01)&order=periodo.asc,alicuota.asc`, { headers: HEADERS }).then(r => r.json())
  ]);

  const newsanTotalMap = {};
  factNewsanData.forEach((f) => {
    const p = f.periodo;
    const sId = String(f.seller_id);
    if (['256189964', '308973138', '256324891'].includes(sId)) {
      newsanTotalMap[p] = (newsanTotalMap[p] || 0) + (Number(f.valor_facturado) || 0);
    }
  });

  // Newsan liq map
  const liqMap = {};
  newsanLiqs.forEach((row) => {
    const mStr = formatMonthKey(row.periodo);
    const sId = String(row.seller_id);
    if (!liqMap[sId]) liqMap[sId] = {};

    const totML = newsanTotalMap[row.periodo] || Number(row.valor_facturado) || 0;
    const periodEscalas = newsanEscalas
      .filter((e) => String(e.seller_id) === '256189964' && e.periodo === row.periodo)
      .sort((a, b) => Number(b.monto_objetivo) - Number(a.monto_objetivo));

    let bestAlic = 0;
    let appliedCargo = 'MINIMO';
    for (const esc of periodEscalas) {
      if (esc.tipo_cargo === 'PORCENTUAL' && totML >= Number(esc.monto_objetivo)) {
        bestAlic = Number(esc.alicuota);
        appliedCargo = 'PORCENTUAL';
        break;
      }
    }

    liqMap[sId][mStr] = {
      tipo_cargo: appliedCargo,
      alicuota: bestAlic,
      valor_facturado: totML,
      subtotal_mercado_libre: Math.round(totML * (bestAlic || 0.0031)),
      estado: row.estado
    };
  });

  console.log('=== VERIFICACIÓN NEWSAN CON NUEVA TOLERANCIA (0.00005) ===');
  ['Sept 2026', 'Oct 2026'].forEach(mStr => {
    const period = mStr === 'Sept 2026' ? '2026-09-01' : '2026-10-01';
    const liq = liqMap['256189964'][mStr];
    const tiers = newsanEscalas.filter(e => e.periodo === period);

    console.log(`\nMes: ${mStr} (Liquidación calculada: tipo=${liq.tipo_cargo}, alic=${liq.alicuota}, estado=${liq.estado})`);
    let appliedCount = 0;
    tiers.forEach(cellData => {
      let isApplied = false;
      const liqCargo = (liq.tipo_cargo || '').trim().toUpperCase();
      const cellCargo = (cellData.tipo_cargo || '').trim().toUpperCase();

      if (liqCargo === cellCargo) {
        if (cellCargo.startsWith('MINIMO') || cellCargo === 'FIJO') {
          isApplied = true;
        } else if (Math.abs(Number(liq.alicuota) - Number(cellData.alicuota)) < 0.00005) {
          isApplied = true;
        }
      } else if ((liqCargo.startsWith('MINIMO') || liqCargo === 'FIJO') && (cellCargo.startsWith('MINIMO') || cellCargo === 'FIJO')) {
        isApplied = true;
      } else if (liqCargo.startsWith('PORCENTUAL') && cellCargo.startsWith('PORCENTUAL')) {
        if (Math.abs(Number(liq.alicuota) - Number(cellData.alicuota)) < 0.00005) {
          isApplied = true;
        }
      }

      if (isApplied) appliedCount++;
      const isScaleProjected = cellData.estado === 'PROYECTADO';
      const color = isApplied ? (liq.estado === 'PROYECTADO' ? 'NARANJA FUERTE' : 'AZUL FUERTE') : (isScaleProjected ? 'NARANJA SUAVE' : 'AZUL SUAVE/NEUTRO');
      console.log(`  Tier: tipo=${cellData.tipo_cargo}, alic=${cellData.alicuota}, monto=${cellData.monto_objetivo} -> isApplied=${isApplied} | Color=${color}`);
    });
    console.log(`  --> TOTAL CELDAS APLICADAS EN ${mStr}: ${appliedCount} (debe ser exactamente 1)`);
  });

  console.log('\n=== VERIFICACIÓN DAPSA EN OCTUBRE 2026 ===');
  const dapsaLiq = dapsaLiqs[0];
  console.log(`Liquidacion Dapsa: tipo=${dapsaLiq.tipo_cargo_aplicado}, alic=${dapsaLiq.alicuota_aplicada}, estado=${dapsaLiq.estado}`);
  dapsaEscalas.forEach(cellData => {
    let isApplied = false;
    const liqCargo = (dapsaLiq.tipo_cargo_aplicado || '').trim().toUpperCase();
    const cellCargo = (cellData.tipo_cargo || '').trim().toUpperCase();

    if (liqCargo === cellCargo) {
      if (cellCargo.startsWith('MINIMO') || cellCargo === 'FIJO') {
        isApplied = true;
      } else if (Math.abs(Number(dapsaLiq.alicuota_aplicada) - Number(cellData.alicuota)) < 0.00005) {
        isApplied = true;
      }
    } else if ((liqCargo.startsWith('MINIMO') || liqCargo === 'FIJO') && (cellCargo.startsWith('MINIMO') || cellCargo === 'FIJO')) {
      isApplied = true;
    }

    const isScaleProjected = cellData.estado === 'PROYECTADO';
    const color = isApplied ? (dapsaLiq.estado === 'PROYECTADO' ? 'NARANJA FUERTE' : 'AZUL FUERTE') : (isScaleProjected ? 'NARANJA SUAVE' : 'AZUL SUAVE/NEUTRO');
    console.log(`  Tier Dapsa: tipo=${cellData.tipo_cargo}, alic=${cellData.alicuota}, monto=${cellData.monto_objetivo} -> isApplied=${isApplied} | Color=${color}`);
  });

  console.log('\n=== VERIFICACIÓN NEWSAN WEB ===');
  console.log('Newsan Web Septiembre y Octubre 2026:');
  newsanWebEscalas.forEach(r => {
    console.log(`  ${r.periodo} | tipo=${r.tipo_cargo} | alic=${r.alicuota} | monto=$${r.monto_objetivo} | var=${(r.variacion_mensual * 100).toFixed(2)}% | estado=${r.estado}`);
  });
}

testFixedLogic();
