const { supabase } = require('./config/supabase');
const { getOrdersFromML } = require('./services/meliService');
const { getSellerTokensFromFirestore, refreshMeliToken, updateFirestoreTokens } = require('./services/authService');

async function syncOrdersJob() {
  console.log("=========================================");
  console.log("INICIANDO CRON JOB: Sincronización de Órdenes");
  console.log("=========================================");

  try {
    const SELLER_ID = process.argv[2] || "425901767";
    
    console.log(`[ML API] Obteniendo credenciales para seller ${SELLER_ID}...`);
    const sellerInfo = await getSellerTokensFromFirestore(SELLER_ID);
    
    console.log(`[ML API] Refrescando Access Token...`);
    const newTokens = await refreshMeliToken(sellerInfo.refresh_token);
    
    console.log(`[ML API] Actualizando token en base de datos central...`);
    await updateFirestoreTokens(sellerInfo.firestoreToken, sellerInfo.docName, newTokens);
    
    const accessToken = newTokens.access_token;

    let rawOrders = [];
    let currentStartDate = new Date("2026-01-01T00:00:00.000Z");
    const endDate = new Date();

    // Mercado Libre tira error si el offset > 10000. Así que pedimos de a 1 día para Nestlé.
    while (currentStartDate <= endDate) {
        let currentEndDate = new Date(currentStartDate);
        currentEndDate.setDate(currentStartDate.getDate() + 1);
        if (currentEndDate > endDate) {
            currentEndDate = endDate;
        }
        
        const fromIso = currentStartDate.toISOString();
        const toIso = currentEndDate.toISOString();
        
        try {
            const chunkOrders = await getOrdersFromML(SELLER_ID, fromIso, toIso, accessToken);
            
            if (chunkOrders.length > 0) {
                const uniqueOrdersMap = new Map();
                chunkOrders.forEach(order => {
                    const itemsCount = order.order_items.reduce((acc, item) => acc + (item.quantity || 0), 0);
                    uniqueOrdersMap.set(order.id, {
                        order_id: order.id,
                        seller_id: order.seller.id,
                        date_created: order.date_created,
                        date_closed: order.date_closed,
                        status: order.status,
                        total_amount: order.total_amount,
                        paid_amount: order.paid_amount,
                        currency_id: order.currency_id,
                        items_count: itemsCount
                    });
                });

                const ordersToInsert = Array.from(uniqueOrdersMap.values());
                const BATCH_SIZE = 3000;
                for (let i = 0; i < ordersToInsert.length; i += BATCH_SIZE) {
                    const batch = ordersToInsert.slice(i, i + BATCH_SIZE);
                    const { error } = await supabase
                        .from('ordenes')
                        .upsert(batch, { onConflict: 'order_id' });
                    if (error) throw error;
                }
                console.log(`[Sync] Insertadas ${ordersToInsert.length} órdenes del ${fromIso}`);
            }
        } catch (e) {
            console.log(`Error en fecha ${fromIso}, saltando... `, e.message);
        }
        
        currentStartDate = new Date(currentEndDate);
        currentStartDate.setMilliseconds(currentStartDate.getMilliseconds() + 1); // 1 ms después
        
        // Prevent rate limit (429)
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`✅ ¡Éxito! Sincronización finalizada.`);

  } catch (err) {
    console.error("❌ CRÍTICO: Error en el job de sincronización:");
    console.error(err);
  } finally {
    console.log("=========================================");
  }
}

syncOrdersJob();
