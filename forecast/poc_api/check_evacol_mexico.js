const crypto = require('crypto');

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

async function main() {
  const token = await getFirestoreToken();
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_CONFIG.projectId}/databases/(default)/documents/accounts?pageSize=1000`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();

  console.log(`Checking accounts for 807100133 or Evacol Mexico...`);
  for (const doc of data.documents || []) {
    const fields = doc.fields || {};
    const id = fields.seller_id_meli ? (fields.seller_id_meli.integerValue || fields.seller_id_meli.stringValue) : '';
    const nick = fields.nickname ? fields.nickname.stringValue : '';
    if (String(id) === '807100133' || nick.toLowerCase().includes('evacol')) {
      console.log(`- Found doc: ${doc.name}`);
      console.log(`  ID: ${id}, Nickname: ${nick}`);
      
      const rf = fields.refresh_token ? fields.refresh_token.stringValue : null;
      if (rf) {
        try {
          const rMeli = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: MELI_CONFIG.CLIENT_ID,
              client_secret: MELI_CONFIG.CLIENT_SECRET,
              refresh_token: rf
            })
          });
          const mTokens = await rMeli.json();
          if (mTokens.access_token) {
            const meRes = await fetch("https://api.mercadolibre.com/users/me", {
              headers: { Authorization: `Bearer ${mTokens.access_token}` }
            });
            const me = await meRes.json();
            console.log(`  ML User Me: id=${me.id}, nick=${me.nickname}, site=${me.site_id}, country=${me.country_id}`);

            if (String(me.id) === '3356567209') {
              console.log(`\n  Fetching all orders for EVACOL MEXICO (${me.id})...`);
              const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnowniqxrtxrrujgnhqj.supabase.co';
              const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
              const FORECAST_SELLER_ID = 807100133;

              let offset = 0;
              const limit = 50;
              let totalOrders = 0;
              let paidOrders = 0;
              const monthlyStats = {};
              const allOrdersToInsert = [];

              while (true) {
                const oUrl = `https://api.mercadolibre.com/orders/search?seller=${me.id}&offset=${offset}&limit=${limit}`;
                const oRes = await fetch(oUrl, {
                  headers: { Authorization: `Bearer ${mTokens.access_token}` }
                });
                const oData = await oRes.json();
                if (!oRes.ok || !oData.results || oData.results.length === 0) break;

                for (const order of oData.results) {
                  totalOrders++;
                  const ym = (order.date_closed || order.date_created || '').substring(0, 7);
                  if (!monthlyStats[ym]) monthlyStats[ym] = { total: 0, paidCount: 0, paidGmv: 0, currency: order.currency_id };
                  monthlyStats[ym].total++;

                  if (order.status === 'paid') {
                    paidOrders++;
                    monthlyStats[ym].paidCount++;
                    monthlyStats[ym].paidGmv += (order.total_amount || 0);

                    const itemsCount = (order.order_items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
                    allOrdersToInsert.push({
                      order_id: order.id,
                      seller_id: FORECAST_SELLER_ID,
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

                if (oData.results.length < limit) break;
                offset += limit;
              }

              console.log(`  Total órdenes en ML: ${totalOrders} | Pagadas: ${paidOrders}`);
              console.log(`  Resumen mensual:`);
              for (const [ym, stat] of Object.entries(monthlyStats)) {
                console.log(`    - ${ym}: ${stat.paidCount} pagadas (de ${stat.total} tot) | GMV Pagado: $ ${stat.paidGmv.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${stat.currency}`);
              }

              if (allOrdersToInsert.length > 0) {
                console.log(`  Insertando ${allOrdersToInsert.length} órdenes en Supabase ordenes (seller_id: ${FORECAST_SELLER_ID})...`);
                const insRes = await fetch(SUPABASE_URL + '/rest/v1/ordenes', {
                  method: 'POST',
                  headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                  },
                  body: JSON.stringify(allOrdersToInsert)
                });
                console.log(`  Supabase insert status: ${insRes.status}`);
              }
            }
          } else {
            console.log(`  ML token error:`, mTokens);
          }
        } catch (e) {
          console.log(`  Error querying ML: ${e.message}`);
        }
      }
    }
  }
}

main().catch(console.error);
