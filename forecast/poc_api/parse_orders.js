const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('ml_response.json', 'utf8'));

const parsedOrders = rawData.results.map(order => {
  // Sumamos la cantidad de ítems
  const itemsCount = order.order_items.reduce((acc, item) => acc + (item.quantity || 0), 0);

  return {
    order_id: order.id,
    seller_id: order.seller.id,
    date_created: order.date_created,
    date_closed: order.date_closed, // Útil para saber cuándo realmente se cerró la venta
    status: order.status, // Fundamental para filtrar solo las "paid"
    total_amount: order.total_amount, // La facturación bruta
    paid_amount: order.paid_amount,
    currency_id: order.currency_id, // Para cruzar con las escalas de BQ
    items_count: itemsCount
  };
});

fs.writeFileSync('parsed_billing_data.json', JSON.stringify(parsedOrders, null, 2));
console.log('Parsed data saved to parsed_billing_data.json');
