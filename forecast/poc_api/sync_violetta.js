const crypto = require('crypto');
const fs = require('fs/promises');

const FIRESTORE_CONFIG = {
  email: "terraform@reply-tech-stage.iam.gserviceaccount.com",
  key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDELNBFDjI2KeS3\ntW3rOfrOgIk7oOA06Aa5RmCqEVXqGCNhiCuPdjxZPOiKy5ZfyKr9g8x32ClhUKQ2\n9X9dNMxJID+G3CZNkPiTEunI1ciZFGTydDutIQhzGR/BsEEVkuTwGKci/uAMnnzV\nBowKFtCf090adpq+aiV5h8J6P8zTEweu9nCZjNrJ+CrI4lAzpF9J1NV+CyUjYyly\nlpLu6u7JiwtBqpbjnwmqFNZPlUec0C/u9uRnwyObd9gcf52RWhKTY+5jPui6o/Xf\nmZq4VKWSKsYFae7MHj20IsdWUhxt4FzKh/gjrwLTuRHP742+7fhTjRhej4iI7z6Z\nVN0tK+WNAgMBAAECgf8j8703lU0edWRf8UrJEUHQa+i6mivSMQkKa3DLujbvRVKL\n9/4Dt2eCnecAM3obk8BtNaUDUa+ZEMOyTsueCU8RwmyMtUv6ayx4cmmQpPKzxfO6\nJhMfEi66PqB99A9Oz4eleN8ooA1E7XFzQ6qRLsfigrFtaCRz69VyWwRejdK729lz\nmert2IuQJPxffmXlu0xuyx3xfVTXbdlOq9UDfsMxC+ASGN6c6w38brxSZvcCX95L\nsJ2ZK+cpzeK5D4qyRBW8UVHwXf2sJokQ5ezdLc6l7wE+il86dkEyRWi2T2baUu73\nuTuOtKUcpTGx/6680ggZ6rWPzz8V6/CSS2NCN2kCgYEA5zrHoH90uHTLtqPGwc5f\nAU6ZeHruyH/HzDmp7Nq4K5/zZIeTb7KYEc/25fnB6jsaMJUWVDPilFK/IU/3cpUv\nGKmI39+cixJzl0wZE6rB2iRf798TBOmkH+UNlw1KGnwhG+MATg3ztzYt06cVp57F\nZ3vn5B7M1nKwBUrVQvDc7wUCgYEA2TCzZCvA+Iq0JO4zFgmfPUE1oqeWiwgKLuqa\n80edBXCpBR8vlBWJ6zAgXeU3Mx9KcesQyqa3LJrNXRLZevmUTDT1lJ3lIsicXWUH\nn4qBCU2O47rH9LHR96i/IOqezaxPMpTTarYgC5aA7wA9PJgvSA/a+/tztsBMuga9\nqlCoEukCgYEAhEp94dZp+gpgbnrfAQzIECBe764tpSpuLeqjzG4KRnM5tj9W2+Xq\n2O4JjOPKzO7Jehgh8UTKEiARV8a/hJ/TlSGRvLvbfTmuRlZ0Vmswg1SiSsNuxzXA\n/7p1fwFMb0CrVKAYEZAr6pslttz2J7NPr3gVYM86VErDaBO7VZQmYt0CgYAi/vXo\n7iPp6G+eg8M3idVeyWMbEmXvgRwi8yqEiMWEWuLhMGU6Nz5B5z9P4d9DHYehU38h\nKDvbtBXjKWZhqlV68g2gJNEHCcwoQF86Fdc06Ipdp3sQspZikY46f5OXEGyyeciX\nKUGAnH+qAx/a46q6sdNXRu0eRV4Xm350MwriAQKBgQDHTDNOhHsQUIQO9rn6WOaJ\nj/DQCNVQGh9i0L/RSWsCJs4yGSlDhawuYn47XB3jamEsmbFam6eI6N0VH4TvkU7d\nVsJRWcZvuOF014PhAFwdwzMFPx1PHZyt8inKBq9YDtTJsGo/+fR3fPvoOXkoXGhe\n35gSujZYxUMhNxpLRutbDQ==\n-----END PRIVATE KEY-----\n",
  projectId: "reply-tech-stage"
};

const MELI_CONFIG = {
  CLIENT_ID: "8733209397166757", 
  CLIENT_SECRET: "lXepK3wntoXfaoBUiTYi9ASqpF2lgeBB",
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnowniqxrtxrrujgnhqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  if (!res.ok) throw new Error("Failed to get Google Token");
  return data.access_token;
}

async function getSellerTokensFromFirestore(firestoreToken, sellerId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_CONFIG.projectId}/databases/(default)/documents/accounts?pageSize=1000`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${firestoreToken}` } });
  const data = await res.json();
  if (!data.documents) throw new Error("No documents found in Firestore");

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
  throw new Error(`Seller ${sellerId} not found in Firestore`);
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
    if (!res.ok) throw new Error("Failed to refresh ML token: " + JSON.stringify(data));
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
    const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${firestoreToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error("Failed to update Firestore: " + txt);
    }
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
        console.error('Supabase insert error:', await res.text());
        throw new Error("Failed to insert to Supabase");
    }
}

async function main() {
  try {
    const SELLER_ID = "1397861779"; // Violetta Cosmeticos
    console.log("1. Authenticating with Firestore...");
    const firestoreToken = await getFirestoreToken();
    
    console.log(`2. Getting ML tokens from Firestore for seller ${SELLER_ID}...`);
    let sellerInfo = await getSellerTokensFromFirestore(firestoreToken, SELLER_ID);
    
    console.log("3. Refreshing Mercado Libre access token...");
    const newTokens = await refreshMeliToken(sellerInfo.refresh_token);
    
    console.log("4. Updating new tokens in Firestore...");
    await updateFirestoreTokens(firestoreToken, sellerInfo.docName, newTokens);
    
    console.log("5. Calling Mercado Libre Orders API by month and saving to Supabase...");
    
    let totalInserted = 0;
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    for (const m of months) {
        const fromIso = `2026-${String(m).padStart(2, '0')}-01T00:00:00.000Z`;
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? 2027 : 2026;
        const toIso = `${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000Z`;
        
        let offset = 0;
        const limit = 50;
        
        while (true) {
            const mlUrl = `https://api.mercadolibre.com/orders/search?seller=${SELLER_ID}&order.date_created.from=${fromIso}&order.date_created.to=${toIso}&offset=${offset}&limit=${limit}`;
            const mlRes = await fetch(mlUrl, {
                headers: { "Authorization": `Bearer ${newTokens.access_token}` }
            });
            const mlJson = await mlRes.json();
            
            if (!mlRes.ok) { 
                console.error("ML API Error:", mlJson); 
                break; 
            }
            if (!mlJson.results || mlJson.results.length === 0) break;
            
            const ordersToInsert = [];
            for (const order of mlJson.results) {
                // Solo insertamos si está pagada o si queremos todas
                if (order.status === 'paid') {
                    const itemsCount = (order.order_items || []).reduce((acc, item) => acc + (item.quantity || 0), 0);
                    ordersToInsert.push({
                        order_id: order.id,
                        seller_id: order.seller.id,
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
                totalInserted += ordersToInsert.length;
            }
            
            if (mlJson.results.length < limit) break;
            offset += limit;
        }
        
        console.log(`Finished Month ${m}`);
    }
    
    console.log(`\n✅ Total orders inserted for Violetta Cosmeticos: ${totalInserted}`);
    
  } catch (err) {
    console.error("Error in execution:", err);
  }
}

main();
