from supabase import create_client, Client
import json

supabase = create_client('https://hnowniqxrtxrrujgnhqj.supabase.co', 'sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU')
res = supabase.table('botmaker_consumos').select('*').eq('periodo', '2026-08-01').ilike('child_project_name', '%martinez%').execute()

for r in res.data:
    print(f"=== {r['child_project_name']} ({r['child_project_id']}) ===")
    raw = r['raw_data']
    total = 0.0
    for k, v in raw.items():
        if k.lower().endswith('billed') and 'count' not in k.lower():
            try:
                fv = float(v)
                if fv > 0:
                    print(f" - {k}: ${fv}")
                    total += fv
            except: pass
    print(f"-----------------------")
    print(f"Total Suma Parcial calculada: ${round(total, 2)}")
    print(f"Total en DB: ${r['total_billed']}\n")
