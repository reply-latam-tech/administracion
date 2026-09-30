const { getSellerTokensFromFirestore, refreshMeliToken, updateFirestoreTokens } = require('./authService');

/**
 * Obtiene las órdenes en el rango de fechas, usando un token ya válido.
 */
async function getOrdersFromML(sellerId, fromIso, toIso, accessToken) {
    let allOrders = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    console.log(`[ML API] Descargando órdenes desde ${fromIso} hasta ${toIso}...`);

    while (hasMore) {
        const mlUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.date_created.from=${fromIso}&order.date_created.to=${toIso}&offset=${offset}&limit=${limit}`;
        
        const res = await fetch(mlUrl, { 
            headers: { "Authorization": `Bearer ${accessToken}` } 
        });
        
        const json = await res.json();
        
        if (!res.ok) {
            throw new Error(`Error API ML: ${JSON.stringify(json)}`);
        }
        
        const results = json.results || [];
        allOrders = allOrders.concat(results);
        
        // Paginación
        const totalPaging = json.paging ? json.paging.total : 0;
        offset += limit;
        
        if (offset >= totalPaging || results.length === 0) {
            hasMore = false;
        } else {
            // Prevent 429 inside the pagination loop
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return allOrders;
}

module.exports = {
    getOrdersFromML
};
