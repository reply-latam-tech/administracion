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
  const signature = sign.sign(FIRESTORE_CONFIG.key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = header + "." + payload + "." + signature;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to get Firestore token: " + JSON.stringify(data));
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
    return data; // { access_token, refresh_token }
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
        headers: { 
            "Authorization": `Bearer ${firestoreToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
        const txt = await res.text();
        throw new Error("Failed to update Firestore: " + txt);
    }
}

async function main() {
  try {
    const SELLER_ID = "1088146491";
    console.log("1. Authenticating with Firestore...");
    const firestoreToken = await getFirestoreToken();
    
    console.log(`2. Getting ML tokens from Firestore for seller ${SELLER_ID}...`);
    let sellerInfo = await getSellerTokensFromFirestore(firestoreToken, SELLER_ID);
    
    if (!sellerInfo.refresh_token) {
        console.error("No refresh token found for seller");
        return;
    }
    
    console.log("3. Refreshing Mercado Libre access token...");
    const newTokens = await refreshMeliToken(sellerInfo.refresh_token);
    console.log("   Token refreshed successfully.");
    
    console.log("4. Updating new tokens in Firestore...");
    await updateFirestoreTokens(firestoreToken, sellerInfo.docName, newTokens);
    
    console.log("5. Calling Mercado Libre Orders API...");
    // 10/09/26 al 20/09/26
    const fromIso = "2026-09-10T00:00:00.000Z";
    const toIso = "2026-09-20T23:59:59.999Z";
    const limit = 50;
    const offset = 0;
    
    const mlUrl = `https://api.mercadolibre.com/orders/search?seller=${SELLER_ID}&order.date_created.from=${fromIso}&order.date_created.to=${toIso}&offset=${offset}&limit=${limit}`;
    
    const mlRes = await fetch(mlUrl, {
        headers: { "Authorization": `Bearer ${newTokens.access_token}` }
    });
    
    const mlJson = await mlRes.json();
    
    if (!mlRes.ok) {
        console.error("ML API Error:", mlJson);
        return;
    }
    
    const filename = "ml_response.json";
    await fs.writeFile(filename, JSON.stringify(mlJson, null, 2));
    console.log(`✅ Success! Response saved to ${filename}`);
    
  } catch (err) {
    console.error("Error in execution:", err);
  }
}

main();
