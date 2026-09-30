require('dotenv').config({path: '../frontend/.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const parseCurrency = (str) => {
  if (!str) return 0;
  let s = str.trim();
  s = s.replace(/\./g, '');
  s = s.replace(/,/g, '.');
  return parseFloat(s) || 0;
};

// Generar array de meses desde Marzo 2024 hasta Agosto 2026 (30 meses)
const periods = [];
let year = 2024;
let month = 3;
for (let i = 0; i < 30; i++) {
  const m = month < 10 ? `0${month}` : `${month}`;
  periods.push(`${year}-${m}-01`);
  month++;
  if (month > 12) {
    month = 1;
    year++;
  }
}

const cafeMartinezVals = [
  "70.208.746", "66.018.149", "78.084.669", "43.130.003", "46.839.951", "59.656.968", "43.047.669", "55.036.597", "91.209.623", "102.037.689,00", "67.628.559", "71.320.798", "99.423.235", "124.807.426", "113.323.782,00", "108.250.218,00", "102.876.101,00", "93.806.989", "72.332.253", "69.237.326", "97.347.297", "98.204.702", "86.514.541", "110.078.482", "152.528.248", "188.431.128", "331.880.318,00", "272.145.179", "289.492.983", "353.370.222"
];

const espumeriaVals = [
  "397.489.000", "423.495.315", "1.145.447.863", "436.444.186", "761.149.664", "716.867.189", "758.579.687", "629.113.168", "1.191.867.667", "640.592.486", "476.281.407", "505.167.981", "1.134.450.579,10", "602.949.467,00", "1.397.243.293,11", "524.733.439,58", "688.816.991,00", "544.069.351,88", "392.882.950,40", "454.552.622,00", "1.295.496.387,61", "697.023.492,94", "697.260.495,59", "424.537.780,15", "840.152.517,74", "569.886.765,61", "891.342.174,90", "495.847.790,89", "619.187.417,16", "337.697.695,17"
];

const toInsert = [];

// Procesar Cafe Martinez
let prev = null;
for (let i = 0; i < 30; i++) {
  const monto = parseCurrency(cafeMartinezVals[i]);
  let variacion = null;
  if (prev !== null && prev > 0) {
    variacion = (monto / prev) - 1;
  }
  toInsert.push({
    seller_id: 1088146491,
    periodo: periods[i],
    valor_facturado: monto,
    variacion_mensual: variacion
  });
  prev = monto;
}

// Procesar La Espumeria
prev = null;
for (let i = 0; i < 30; i++) {
  const monto = parseCurrency(espumeriaVals[i]);
  let variacion = null;
  if (prev !== null && prev > 0) {
    variacion = (monto / prev) - 1;
  }
  toInsert.push({
    seller_id: 425901767,
    periodo: periods[i],
    valor_facturado: monto,
    variacion_mensual: variacion
  });
  prev = monto;
}

async function main() {
  console.log(`Prepared ${toInsert.length} records. Inserting into 'facturacion'...`);

  const { error } = await supabase.from('facturacion').insert(toInsert);
  
  if (error) {
    console.error('Error inserting data:', error);
  } else {
    console.log('Done!');
  }
}

main();
