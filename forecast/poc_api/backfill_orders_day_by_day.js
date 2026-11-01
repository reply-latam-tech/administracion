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

// 2. Configuración Firestore y Mercado Libre
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  if (!res.ok) throw new Error("Error obteniendo token de Firestore: " + JSON.stringify(data));
  return data.access_token;
}

async function getSellerTokensFromFirestore(firestoreToken, sellerId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_CONFIG.projectId}/databases/(default)/documents/accounts?pageSize=1000`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${firestoreToken}` } });
  const data = await res.json();
  if (!data.documents) return null;

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
  const data = await res.json();
  if (!res.ok) throw new Error("Error refrescando token ML: " + JSON.stringify(data));
  return data;
}

async function updateFirestoreTokens(firestoreToken, docName, newTokens) {
  const patchUrl = `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=access_token&updateMask.fieldPaths=refresh_token&updateMask.fieldPaths=last_update`;
  const payload = {
    fields: {
      access_token: { stringValue: newTokens.access_token },
      refresh_token: { stringValue: newTokens.refresh_token },
      last_update: { stringValue: new Date().toISOString() }
    }
  };
  await fetch(patchUrl, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${firestoreToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function insertOrders(orders) {
  if (!orders || orders.length === 0) return;
  const res = await fetch(SUPABASE_URL + '/rest/v1/ordenes', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(orders)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Error insertando en Supabase ordenes: " + errText);
  }
}

// 3. Gestión de Estado / Checkpointing
const STATE_DIR = path.resolve(__dirname, 'state');
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

function getCheckpointPath(sellerId) {
  return path.join(STATE_DIR, `backfill_state_${sellerId}.json`);
}

function loadCheckpoint(sellerId) {
  const cpPath = getCheckpointPath(sellerId);
  if (fs.existsSync(cpPath)) {
    try {
      return JSON.parse(fs.readFileSync(cpPath, 'utf8'));
    } catch (e) {
      console.warn("No se pudo leer checkpoint previo, iniciando nuevo:", e.message);
    }
  }
  return { completedDays: {}, totalOrders: 0, totalAmount: 0 };
}

function saveCheckpoint(sellerId, state) {
  const cpPath = getCheckpointPath(sellerId);
  fs.writeFileSync(cpPath, JSON.stringify(state, null, 2), 'utf8');
}

// 4. Proceso Principal Día por Día
async function backfillSeller(sellerId, sellerName, startDateStr = '2026-01-01', endDateStr = '2026-11-01') {
  console.log(`\n===============================================================`);
  console.log(`🚀 INICIANDO SINCRONIZACIÓN ESCALABLE DÍA POR DÍA`);
  console.log(`Seller: ${sellerName} (ID: ${sellerId})`);
  console.log(`Período objetivo: ${startDateStr} hasta ${endDateStr}`);
  console.log(`===============================================================\n`);

  const checkpoint = loadCheckpoint(sellerId);
  console.log(`Checkpoint cargado: ${Object.keys(checkpoint.completedDays).length} días previamente completados.`);

  let firestoreToken = await getFirestoreToken();
  let sellerInfo = await getSellerTokensFromFirestore(firestoreToken, sellerId);
  if (!sellerInfo) throw new Error(`No se encontró seller ${sellerId} en Firestore`);

  console.log("Refrescando token de Mercado Libre...");
  let meliTokens = await refreshMeliToken(sellerInfo.refresh_token);
  await updateFirestoreTokens(firestoreToken, sellerInfo.docName, meliTokens);
  let tokenLastRefreshed = Date.now();

  let currentDate = new Date(startDateStr + "T00:00:00.000Z");
  const stopDate = new Date(endDateStr + "T00:00:00.000Z");

  let grandTotalOrders = checkpoint.totalOrders || 0;
  let grandTotalAmount = checkpoint.totalAmount || 0;

  while (currentDate < stopDate) {
    const dayStr = currentDate.toISOString().substring(0, 10);
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDayStr = nextDate.toISOString().substring(0, 10);

    // Si el día ya está completado en el checkpoint, podemos omitirlo para ser ultra-eficientes
    if (checkpoint.completedDays[dayStr]) {
      const prev = checkpoint.completedDays[dayStr];
      console.log(`[${dayStr}] ⏩ Día ya completado en checkpoint (${prev.orders} órdenes, $${((prev.amount||0)/1e6).toFixed(2)}M). Omitiendo.`);
      currentDate = nextDate;
      continue;
    }

    // Refrescar token si pasaron más de 3 horas
    if (Date.now() - tokenLastRefreshed > 3 * 3600 * 1000) {
      console.log("--> Refrescando token ML (renovación preventiva)...");
      meliTokens = await refreshMeliToken(meliTokens.refresh_token);
      await updateFirestoreTokens(firestoreToken, sellerInfo.docName, meliTokens);
      tokenLastRefreshed = Date.now();
    }

    const fromIso = `${dayStr}T00:00:00.000Z`;
    const toIso = `${nextDayStr}T00:00:00.000Z`;

    let offset = 0;
    const limit = 50;
    let dayOrdersCount = 0;
    let dayAmountSum = 0;
    let dayTotalInML = 0;

    let hasMore = true;

    while (hasMore && offset <= 10000) {
      const mlUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.date_created.from=${fromIso}&order.date_created.to=${toIso}&offset=${offset}&limit=${limit}`;
      
      let mlRes;
      let mlJson;
      let retries = 0;

      while (retries < 5) {
        try {
          mlRes = await fetch(mlUrl, {
            headers: { "Authorization": `Bearer ${meliTokens.access_token}` }
          });
          mlJson = await mlRes.json();

          if (mlRes.status === 429) {
            retries++;
            const waitTime = retries * 2000;
            console.log(`    ⚠️ [429 Rate Limit] Esperando ${waitTime}ms en ${dayStr} (intento ${retries}/5)...`);
            await sleep(waitTime);
            continue;
          }

          if (mlRes.status === 401) {
            console.log(`    ⚠️ [401 Token Expirado] Refrescando token de inmediato...`);
            meliTokens = await refreshMeliToken(meliTokens.refresh_token);
            await updateFirestoreTokens(firestoreToken, sellerInfo.docName, meliTokens);
            tokenLastRefreshed = Date.now();
            retries++;
            continue;
          }

          break;
        } catch (fetchErr) {
          retries++;
          console.error(`    ⚠️ Error de red: ${fetchErr.message}. Reintentando (${retries}/5)...`);
          await sleep(2000);
        }
      }

      if (!mlRes || !mlRes.ok) {
        console.error(`    ❌ Error HTTP ${mlRes?.status} en ${dayStr} offset ${offset}:`, mlJson);
        break;
      }

      dayTotalInML = mlJson.paging?.total || 0;
      const results = mlJson.results || [];
      if (results.length === 0) break;

      const ordersToInsert = [];
      for (const order of results) {
        if (order.status === 'paid') {
          const itemsCount = (order.order_items || []).reduce((acc, item) => acc + (item.quantity || 0), 0);
          ordersToInsert.push({
            order_id: order.id,
            seller_id: Number(sellerId),
            date_created: order.date_created,
            date_closed: order.date_closed,
            status: order.status,
            total_amount: order.total_amount,
            paid_amount: order.paid_amount,
            currency_id: order.currency_id,
            items_count: itemsCount,
            inserted_at: new Date().toISOString()
          });
          dayAmountSum += Number(order.paid_amount || 0);
        }
      }

      if (ordersToInsert.length > 0) {
        await insertOrders(ordersToInsert);
        dayOrdersCount += ordersToInsert.length;
      }

      if (results.length < limit || offset + limit >= dayTotalInML) {
        hasMore = false;
      } else {
        offset += limit;
        await sleep(120); // Respetar rate limit de ML
      }
    }

    grandTotalOrders += dayOrdersCount;
    grandTotalAmount += dayAmountSum;

    // Registrar checkpoint del día
    checkpoint.completedDays[dayStr] = {
      orders: dayOrdersCount,
      totalInML: dayTotalInML,
      amount: dayAmountSum,
      completedAt: new Date().toISOString()
    };
    checkpoint.totalOrders = grandTotalOrders;
    checkpoint.totalAmount = grandTotalAmount;
    saveCheckpoint(sellerId, checkpoint);

    console.log(`[${dayStr}] ✅ Día finalizado y subido: ${dayOrdersCount} órdenes pagadas (Total ML: ${dayTotalInML}) | $${(dayAmountSum/1e6).toFixed(2)}M | Acum: ${grandTotalOrders} órdenes ($${(grandTotalAmount/1e6).toFixed(2)}M)`);

    currentDate = nextDate;
  }

  console.log(`\n===============================================================`);
  console.log(`🎉 BACKFILL COMPLETADO PARA ${sellerName}`);
  console.log(`Total acumulado subido: ${grandTotalOrders} órdenes ($${(grandTotalAmount/1e6).toFixed(2)}M ARS)`);
  console.log(`===============================================================\n`);
}

// 5. CLI Execution
async function main() {
  const args = process.argv.slice(2);
  const sellerId = args[0] || '256324891'; // Pilisar por defecto
  const sellerName = args[1] || 'Pilisar';
  const start = args[2] || '2026-01-01';
  const end = args[3] || '2026-11-01';

  try {
    await backfillSeller(sellerId, sellerName, start, end);
  } catch (err) {
    console.error("Error crítico en backfill_orders_day_by_day:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { backfillSeller };
