const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Cargar entorno de Supabase
const envPath = path.resolve(__dirname, '../frontend/.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || 'https://hnowniqxrtxrrujgnhqj.supabase.co';
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const FIRESTORE_CONFIG = {
  email: "terraform@reply-tech-stage.iam.gserviceaccount.com",
  key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDELNBFDjI2KeS3\ntW3rOfrOgIk7oOA06Aa5RmCqEVXqGCNhiCuPdjxZPOiKy5ZfyKr9g8x32ClhUKQ2\n9X9dNMxJID+G3CZNkPiTEunI1ciZFGTydDutIQhzGR/BsEEVkuTwGKci/uAMnnzV\nBowKFtCf090adpq+aiV5h8J6P8zTEweu9nCZjNrJ+CrI4lAzpF9J1NV+CyUjYyly\nlpLu6u7JiwtBqpbjnwmqFNZPlUec0C/u9uRnwyObd9gcf52RWhKTY+5jPui6o/Xf\nmZq4VKWSKsYFae7MHj20IsdWUhxt4FzKh/gjrwLTuRHP742+7fhTjRhej4iI7z6Z\nVN0tK+WNAgMBAAECgf8j8703lU0edWRf8UrJEUHQa+i6mivSMQkKa3DLujbvRVKL\n9/4Dt2eCnecAM3obk8BtNaUDUa+ZEMOyTsueCU8RwmyMtUv6ayx4cmmQpPKzxfO6\nJhMfEi66PqB99A9Oz4eleN8ooA1E7XFzQ6qRLsfigrFtaCRz69VyWwRejdK729lz\nmert2IuQJPxffmXlu0xuyx3xfVTXbdlOq9UDfsMxC+ASGN6c6w38brxSZvcCX95L\nsJ2ZK+cpzeK5D4qyRBW8UVHwXf2sJokQ5ezdLc6l7wE+il86dkEyRWi2T2baUu73\nuTuOtKUcpTGx/6680ggZ6rWPzz8V6/CSS2NCN2kCgYEA5zrHoH90uHTLtqPGwc5f\nAU6ZeHruyH/HzDmp7Nq4K5/zZIeTb7KYEc/25fnB6jsaMJUWVDPilFK/IU/3cpUv\nGKmI39+cixJzl0wZE6rB2iRf798TBOmkH+UNlw1KGnwhG+MATg3ztzYt06cVp57F\nZ3vn5B7M1nKwBUrVQvDc7wUCgYEA2TCzZCvA+Iq0JO4zFgmfPUE1oqeWiwgKLuqa\n80edBXCpBR8vlBWJ6zAgXeU3Mx9KcesQyqa3LJrNXRLZevmUTDT1lJ3lIsicXWUH\nn4qBCU2O47rH9LHR96i/IOqezaxPMpTTarYgC5aA7wA9PJgvSA/a+/tztsBMuga9\nqlCoEukCgYEAhEp94dZp+gpgbnrfAQzIECBe764tpSpuLeqjzG4KRnM5tj9W2+Xq\n2O4JjOPKzO7Jehgh8UTKEiARV8a/hJ/TlSGRvLvbfTmuRlZ0Vmswg1SiSsNuxzXA\n/7p1fwFMb0CrVKAYEZAr6pslttz2J7NPr3gVYM86VErDaBO7VZQmYt0CgYAi/vXo\n7iPp6G+eg8M3idVeyWMbEmXvgRwi8yqEiMWEWuLhMGU6Nz5B5z9P4d9DHYehU38h\nKDvbtBXjKWZhqlV68g2gJNEHCcwoQF86Fdc06Ipdp3sQspZikY46f5OXEGyyeciX\nKUGAnH+qAx/a46q6sdNXRu0eRV4Xm350MwriAQKBgQDHTDNOhHsQUIQO9rn6WOaJ\nj/DQCNVQGh9i0L/RSWsCJs4yGSlDhawuYn47XB3jamEsmbFam6eI6N0VH4TvkU7d\nVsJRWcZvuOF014PhAFwdwzMFPx1PHZyt8inKBq9YDtTJsGo/+fR3fPvoOXkoXGhe\n35gSujZYxUMhNxpLRutbDQ==\n-----END PRIVATE KEY-----\n",
  projectId: "reply-tech-stage"
};

const MELI_CONFIG = {
  CLIENT_ID: "8733209397166757", 
  CLIENT_SECRET: "lXepK3wntoXfaoBUiTYi9ASqpF2lgeBB",
};

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getFirestoreToken() {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: FIRESTORE_CONFIG.email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const payload = base64url(JSON.stringify(claimSet));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + "." + payload);
  const signature = base64url(sign.sign(FIRESTORE_CONFIG.key));
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt })
  });
  const data = await res.json();
  return data.access_token;
}

async function getSellerTokensFromFirestore(firestoreToken, sellerId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_CONFIG.projectId}/databases/(default)/documents/accounts?pageSize=1000`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${firestoreToken}` } });
  const data = await res.json();
  for (const doc of data.documents) {
    const fields = doc.fields || {};
    const id = fields.seller_id_meli ? (fields.seller_id_meli.integerValue || fields.seller_id_meli.stringValue) : null;
    if (String(id) === String(sellerId)) {
      return {
        access_token: fields.access_token ? fields.access_token.stringValue : null,
        refresh_token: fields.refresh_token ? fields.refresh_token.stringValue : null,
        docName: doc.name
      };
    }
  }
  return null;
}

async function refreshMeliToken(refreshToken) {
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: MELI_CONFIG.CLIENT_ID,
      client_secret: MELI_CONFIG.CLIENT_SECRET,
      refresh_token: refreshToken
    })
  });
  return await res.json();
}

async function supabasePost(table, records) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(records)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error insertando en ${table}: ${text}`);
  }
  return res;
}

async function runProvisioning() {
  console.log("=============================================================");
  console.log("🚀 PROVISIONING CUENTA NUEVA: ZAZ (ID: 1980619742)");
  console.log("=============================================================\n");

  const SELLER_ID = 1980619742;
  const CLIENT_ID = 27;

  // 1. dim_clientes
  console.log("1. Insertando en public.dim_clientes...");
  await supabasePost('dim_clientes', [{
    id_cliente: CLIENT_ID,
    nombre_cliente: "Zaz",
    rubro: "Retail & Importaciones",
    pais_origen: "AR",
    activo: true
  }]);
  console.log("   ✅ Cliente Zaz registrado con id_cliente:", CLIENT_ID);

  // 2. dim_sellers
  console.log("2. Insertando en public.dim_sellers...");
  await supabasePost('dim_sellers', [{
    id_seller: SELLER_ID,
    nombre_seller: "Zaz",
    pais: "AR",
    moneda: "ARS",
    estado: true,
    cobrar_botmaker: true,
    frecuencia_actualizacion: "MENSUAL",
    id_cliente: CLIENT_ID,
    codigo_plataforma: "MELI",
    codigo_pais: "AR",
    marca: "Zaz",
    canal_subtipo: null
  }]);
  console.log("   ✅ Seller Zaz registrado en dim_sellers.");

  // 3. dim_escalas (Octubre 2026 hasta Septiembre 2027)
  console.log("3. Generando dim_escalas ajustadas por inflación (Octubre 2026 a Septiembre 2027)...");
  
  // Traer curva de inflación de la base de datos
  const infRes = await fetch(`${SUPABASE_URL}/rest/v1/inflacion?order=periodo.asc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const inflacionData = await infRes.json();
  const infMap = {};
  inflacionData.forEach(r => infMap[r.periodo] = Number(r.valor_inflacion));

  // Tiers base de Octubre 2026
  const baseTiersOctubre = [
    { tipo_cargo: 'MINIMO', alicuota: 0, monto_objetivo: 2475000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.055, monto_objetivo: 45000000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.045, monto_objetivo: 80000000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.0425, monto_objetivo: 120000000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.0375, monto_objetivo: 165000000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.035, monto_objetivo: 250000000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.030, monto_objetivo: 350000000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.025, monto_objetivo: 500000000 },
    { tipo_cargo: 'PORCENTUAL', alicuota: 0.020, monto_objetivo: 700000000 },
  ];

  const meses = [
    { periodo: '2026-10-01', estado: 'REAL', infMes: 0 },
    { periodo: '2026-11-01', estado: 'PROYECTADO', infMes: infMap['2026-11-01'] || 0.016 },
    { periodo: '2026-12-01', estado: 'PROYECTADO', infMes: infMap['2026-12-01'] || 0.018 },
    { periodo: '2027-01-01', estado: 'PROYECTADO', infMes: infMap['2027-01-01'] || 0.016 },
    { periodo: '2027-02-01', estado: 'PROYECTADO', infMes: infMap['2027-02-01'] || 0.016 },
    { periodo: '2027-03-01', estado: 'PROYECTADO', infMes: infMap['2027-03-01'] || 0.017 },
    { periodo: '2027-04-01', estado: 'PROYECTADO', infMes: infMap['2027-04-01'] || 0.014 },
    { periodo: '2027-05-01', estado: 'PROYECTADO', infMes: infMap['2027-05-01'] || 0.014 },
    { periodo: '2027-06-01', estado: 'PROYECTADO', infMes: infMap['2027-06-01'] || 0.014 },
    { periodo: '2027-07-01', estado: 'PROYECTADO', infMes: infMap['2027-07-01'] || 0.014 },
    { periodo: '2027-08-01', estado: 'PROYECTADO', infMes: infMap['2027-08-01'] || 0.014 },
    { periodo: '2027-09-01', estado: 'PROYECTADO', infMes: 0.014 },
  ];

  let currentTiers = baseTiersOctubre.map(t => ({ ...t }));
  const todasLasEscalas = [];

  for (let i = 0; i < meses.length; i++) {
    const m = meses[i];
    if (i > 0) {
      // Aplicar inflación acumulada mes a mes
      currentTiers = currentTiers.map(t => ({
        ...t,
        monto_objetivo: Math.round(t.monto_objetivo * (1 + m.infMes) * 100) / 100
      }));
    }

    for (const t of currentTiers) {
      todasLasEscalas.push({
        seller_id: SELLER_ID,
        periodo: m.periodo,
        tipo_cargo: t.tipo_cargo,
        alicuota: t.alicuota,
        monto_objetivo: t.monto_objetivo,
        pais: "AR",
        moneda: "ARS",
        variacion_mensual: m.infMes,
        estado: m.estado
      });
    }
  }

  await supabasePost('dim_escalas', todasLasEscalas);
  console.log(`   ✅ ${todasLasEscalas.length} registros de escalas insertados en dim_escalas.`);

  // 4. Sincronización de Órdenes Reales de Octubre 2026 de ML
  console.log("4. Descargando órdenes de Octubre 2026 de la API de Mercado Libre...");
  const fsToken = await getFirestoreToken();
  const sellerInfo = await getSellerTokensFromFirestore(fsToken, String(SELLER_ID));
  const meliTokens = await refreshMeliToken(sellerInfo.refresh_token);

  let offset = 0;
  const limit = 50;
  let octOrders = [];
  let octSumPaid = 0;

  while (offset <= 10000) {
    const url = `https://api.mercadolibre.com/orders/search?seller=${SELLER_ID}&order.date_created.from=2026-10-01T00:00:00.000Z&order.date_created.to=2026-11-01T00:00:00.000Z&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${meliTokens.access_token}` } });
    const json = await res.json();
    if (!json.results || json.results.length === 0) break;

    for (const o of json.results) {
      if (o.status === 'paid') {
        octSumPaid += Number(o.paid_amount || 0);
        octOrders.push({
          order_id: o.id,
          seller_id: SELLER_ID,
          date_created: o.date_created,
          date_closed: o.date_closed,
          status: o.status,
          total_amount: o.total_amount,
          paid_amount: o.paid_amount,
          currency_id: o.currency_id,
          items_count: (o.order_items || []).reduce((acc, it) => acc + (it.quantity || 0), 0),
          inserted_at: new Date().toISOString()
        });
      }
    }
    if (json.results.length < limit) break;
    offset += limit;
  }

  // Deduplicar órdenes por order_id para evitar error 21000 en ON CONFLICT
  const uniqueOrdersMap = new Map();
  for (const o of octOrders) {
    uniqueOrdersMap.set(o.order_id, o);
  }
  const uniqueOrders = Array.from(uniqueOrdersMap.values());

  if (uniqueOrders.length > 0) {
    // Insertar en lotes de 200
    for (let b = 0; b < uniqueOrders.length; b += 200) {
      const batch = uniqueOrders.slice(b, b + 200);
      await supabasePost('ordenes', batch);
    }
    console.log(`   ✅ ${uniqueOrders.length} órdenes pagadas únicas insertadas en public.ordenes ($${octSumPaid.toLocaleString('es-AR')} ARS).`);
  }

  // 5. Cargar public.facturacion (Octubre Real + 11 Meses Proyectados)
  console.log("5. Insertando facturación de Octubre 2026 y proyecciones...");
  const facturacionRows = [
    {
      seller_id: SELLER_ID,
      periodo: '2026-10-01',
      valor_facturado: Math.round(octSumPaid * 100) / 100,
      variacion_mensual: 0,
      estado: 'REAL'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2026-11-01', // CyberWeek peak
      valor_facturado: 53500000,
      variacion_mensual: 0.3987,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2026-12-01', // Navidad peak
      valor_facturado: 49700000,
      variacion_mensual: -0.0710,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-01-01', // Bajón estival
      valor_facturado: 36000000,
      variacion_mensual: -0.2757,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-02-01',
      valor_facturado: 35000000,
      variacion_mensual: -0.0278,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-03-01',
      valor_facturado: 40000000,
      variacion_mensual: 0.1429,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-04-01',
      valor_facturado: 41000000,
      variacion_mensual: 0.0250,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-05-01', // Hot Sale peak
      valor_facturado: 52000000,
      variacion_mensual: 0.2683,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-06-01',
      valor_facturado: 43000000,
      variacion_mensual: -0.1731,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-07-01',
      valor_facturado: 44000000,
      variacion_mensual: 0.0233,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-08-01',
      valor_facturado: 45000000,
      variacion_mensual: 0.0227,
      estado: 'PROYECTADO'
    },
    {
      seller_id: SELLER_ID,
      periodo: '2027-09-01',
      valor_facturado: 46000000,
      variacion_mensual: 0.0222,
      estado: 'PROYECTADO'
    }
  ];

  await supabasePost('facturacion', facturacionRows);
  console.log(`   ✅ 12 meses de facturación cargados en public.facturacion (Octubre Real: $${octSumPaid.toLocaleString('es-AR')} ARS).`);

  console.log("6. Liquidación de Octubre 2026:");
  console.log("   ℹ️ public.liquidaciones es una VISTA SQL calculada automáticamente a partir de facturación, dim_escalas y dim_sellers.");

  console.log("\n=============================================================");
  console.log("🎉 PROVISIÓN DE ZAZ FINALIZADA CON ÉXITO");
  console.log("=============================================================");
}

runProvisioning().catch(e => {
  console.error("Error en provisión de Zaz:", e);
  process.exit(1);
});
