require('dotenv').config({path: '../frontend/.env.local'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const content = fs.readFileSync('inflacion_data.json', 'utf8');
  const data = JSON.parse(content);
  
  // Transform strings to actual numbers where needed
  const toInsert = data.map(item => ({
    periodo: item.periodo,
    valor_inflacion: parseFloat(item.valor_inflacion)
  }));

  console.log(`Prepared ${toInsert.length} records. Inserting to Supabase...`);

  const { error } = await supabase.from('inflacion').insert(toInsert);
  
  if (error) {
    console.error('Error inserting data:', error);
  } else {
    console.log('Done!');
  }
}

main();
