require('dotenv').config({path: '../frontend/.env.local'});
const { createClient } = require('@supabase/supabase-js');

async function test() {
    console.log("Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('seguimiento_diario_proyecciones').select('*').limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
}
test();
