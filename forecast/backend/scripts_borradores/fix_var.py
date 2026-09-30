from supabase import create_client, Client
from collections import defaultdict

supabase = create_client('https://hnowniqxrtxrrujgnhqj.supabase.co', 'sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU')
seller_id = 195352434

res = supabase.table('dim_escalas').select('*').eq('seller_id', seller_id).execute()
escalas = res.data

grouped = defaultdict(list)
for row in escalas:
    key = f"{row['tipo_cargo']}_{row['alicuota']}"
    grouped[key].append(row)

updates = []
for key, items in grouped.items():
    items = sorted(items, key=lambda x: x['periodo'])
    for i in range(len(items)):
        var = 0.0
        if i > 0:
            prev_monto = items[i-1]['monto_objetivo']
            curr_monto = items[i]['monto_objetivo']
            if prev_monto and curr_monto and prev_monto > 0:
                var = (curr_monto - prev_monto) / prev_monto
        
        updates.append({
            'id': items[i]['id'], 
            'seller_id': seller_id,
            'periodo': items[i]['periodo'],
            'tipo_cargo': items[i]['tipo_cargo'],
            'alicuota': items[i]['alicuota'],
            'monto_objetivo': items[i]['monto_objetivo'],
            'pais': items[i]['pais'],
            'moneda': items[i]['moneda'],
            'variacion_mensual': round(var, 6)
        })

print(f"Subiendo {len(updates)} actualizaciones...")
for i in range(0, len(updates), 100):
    chunk = updates[i:i+100]
    supabase.table('dim_escalas').upsert(chunk).execute()

print('Variacion corregida!')
