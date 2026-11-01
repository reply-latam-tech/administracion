const crypto = require('crypto');
const fs = require('fs');

const envText = fs.readFileSync('forecast/frontend/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
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

async function insertOrders(orders) {
  if (orders.length === 0) return;
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
    throw new Error("Failed to insert to Supabase: " + await res.text());
  }
}

async function syncSellerByDailyWindows(sellerId, sellerName, fromDateStr, toDateStr) {
  console.log(`\n=== INICIANDO BACKFILL DE ${sellerName} (${sellerId}) ===`);
  console.log(`Rango: ${fromDateStr} al ${toDateStr}`);

  const fsToken = await getFirestoreToken();
  const sellerInfo = await getSellerTokensFromFirestore(fsToken, sellerId);
  let newTokens = await refreshMeliToken(sellerInfo.refresh_token);

  let current = new Date(fromDateStr);
  const end = new Date(toDateStr);

  let totalInserted = 0;

  while (current < end) {
    const next = new Date(current);
    next.setDate(next.getDate() + 1); // 1-day window
    const fromIso = current.toISOString();
    const toIso = next.toISOString();

    let offset = 0;
    const limit = 50;
    let dayCount = 0;

    while (offset <= 10000) {
      const mlUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.date_created.from=${fromIso}&order.date_created.to=${toIso}&offset=${offset}&limit=${limit}`;
      const res = await fetch(mlUrl, {
        headers: { "Authorization": `Bearer ${newTokens.access_token}` }
      });
      const json = await res.json();

      if (res.status === 429) {
        console.log(`  [429] Rate limited on ${fromIso}, waiting 2s...`);
        await sleep(2000);
        continue;
      }

      if (!res.ok) {
        console.error(`  [Error] ${res.status}:`, json);
        break;
      }

      if (!json.results || json.results.length === 0) break;

      const ordersToInsert = [];
      for (const order of json.results) {
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
        }
      }

      if (ordersToInsert.length > 0) {
        await insertOrders(ordersToInsert);
        dayCount += ordersToInsert.length;
        totalInserted += ordersToInsert.length;
      }

      if (json.results.length < limit) break;
      offset += limit;
      await sleep(150);
    }

    console.log(`  Día ${fromIso.substring(0, 10)}: ${dayCount} órdenes sincronizadas.`);
    current = next;
  }

  console.log(`\n✅ Total órdenes insertadas para ${sellerName}: ${totalInserted}`);
}

module.exports = { syncSellerByDailyWindows };
