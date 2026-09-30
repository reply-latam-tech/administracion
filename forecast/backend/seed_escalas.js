require('dotenv').config({path: '../frontend/.env.local'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const parseCurrency = (str) => {
  if (!str) return 0;
  // Remove quotes
  let s = str.replace(/"/g, '');
  // Remove dots
  s = s.replace(/\./g, '');
  // Replace comma with dot
  s = s.replace(/,/g, '.');
  return parseFloat(s) || 0;
};

const parsePercent = (str) => {
  if (!str) return 0;
  let s = str.replace(/"/g, '').replace(/%/g, '').replace(/,/g, '.');
  let val = parseFloat(s) || 0;
  // If it was e.g. 5.50, divide by 100
  if (str.includes('%')) {
    val = val / 100;
  }
  return val;
};

async function main() {
  const content = fs.readFileSync('escalas2.csv', 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  const header1 = lines[0].split(',');
  // Some columns in header1 are empty because of the 2 columns per month.
  // Col 4 is 2024-01-01, Col 6 is 2024-02-01, etc.
  
  let months = [];
  for (let i = 4; i < header1.length; i += 2) {
    if (header1[i]) {
      months.push({ index: i, date: header1[i] });
    }
  }

  // Map of sellers
  const sellerIds = {
    'Cafe Martinez': 1088146491,
    'La espumeria': 425901767
  };

  const toInsert = [];

  // Rows start at index 2 (0=dates, 1=Alicuota/Monto)
  for (let r = 2; r < lines.length; r++) {
    // We must parse the CSV line carefully because of quotes (e.g. "952.481,81")
    // Simple regex to split by comma outside quotes
    const rowRaw = lines[r].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    // Actually, splitting by comma outside quotes:
    let row = [];
    let inQuotes = false;
    let current = "";
    for (let c = 0; c < lines[r].length; c++) {
      let char = lines[r][c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current); // push the last one

    const pais = row[0];
    const vendedor = row[1];
    const seller_id = sellerIds[vendedor];
    const tipo_cargo = row[2];
    const moneda = row[3];

    let prevMonto = null;

    for (let m of months) {
      const idx = m.index;
      const alicuotaStr = row[idx];
      const montoStr = row[idx + 1];

      const alicuota = parsePercent(alicuotaStr);
      const monto = parseCurrency(montoStr);

      let variacion_mensual = null;
      if (prevMonto !== null && prevMonto > 0) {
        variacion_mensual = (monto / prevMonto) - 1;
      }

      toInsert.push({
        periodo: m.date,
        pais: pais,
        seller_id: seller_id,
        tipo_cargo: tipo_cargo,
        alicuota: alicuota,
        monto_objetivo: monto,
        variacion_mensual: variacion_mensual,
        moneda: moneda
      });

      prevMonto = monto;
    }
  }

  console.log(`Prepared ${toInsert.length} records. Inserting to Supabase...`);

  // Insert in batches of 100
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const { error } = await supabase.from('dim_escalas').insert(batch);
    if (error) {
      console.error('Error inserting batch:', error);
    } else {
      console.log(`Inserted ${i + batch.length} / ${toInsert.length}`);
    }
  }
  console.log('Done!');
}

main();
