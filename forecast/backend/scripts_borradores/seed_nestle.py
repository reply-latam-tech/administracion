import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
from supabase import create_client, Client
import csv
import io

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_nestle():
    seller_name = "Nestle"
    
    # 1. Asegurar seller en dim_sellers
    res = supabase.table("dim_sellers").select("*").eq("nombre_seller", seller_name).execute()
    seller_id = res.data[0]['id_seller']

    # 3. Escalas
    with open('nestle_escalas.csv', 'r', encoding='utf-8') as f:
        csv_escalas = f.read()

    reader = csv.reader(io.StringIO(csv_escalas))
    rows = list(reader)

    header_meses = rows[0]
    header_tipos = rows[1]

    fechas = []
    for i in range(4, len(header_meses), 2):
        if header_meses[i].strip():
            fechas.append({
                "periodo": header_meses[i].strip(),
                "col_alicuota": i,
                "col_monto": i + 1
            })

    data_escalas = rows[2:]
    upsert_escalas = []

    for row in data_escalas:
        if len(row) < 4: continue
        tipo_cargo = row[2].strip()

        for f in fechas:
            if f["col_alicuota"] >= len(row) or f["col_monto"] >= len(row): continue
            
            val_ali = row[f["col_alicuota"]].strip()
            val_monto = row[f["col_monto"]].strip()
            
            if not val_ali and not val_monto:
                continue
                
            alicuota = 0.0
            if val_ali:
                if '%' in val_ali:
                    alicuota = float(val_ali.replace('%','').replace(',','.')) / 100
                else:
                    try:
                        alicuota = float(val_ali.replace('.','').replace(',','.'))
                    except:
                        pass
                        
            monto = 0.0
            if val_monto:
                try:
                    monto = float(val_monto.replace('.', '').replace(',', '.'))
                except:
                    pass
                    
            if monto == 0 and alicuota == 0:
                continue

            upsert_escalas.append({
                "seller_id": seller_id,
                "periodo": f["periodo"],
                "tipo_cargo": tipo_cargo,
                "alicuota": round(alicuota, 6),
                "monto_objetivo": round(monto, 2),
                "pais": "ARG",
                "moneda": "ARS",
                "variacion_mensual": 0.0
            })

    # Group and sort to compute variacion_mensual
    from collections import defaultdict
    grouped = defaultdict(list)
    for row in upsert_escalas:
        grouped[row["tipo_cargo"]].append(row)

    final_upsert = []
    for cargo, items in grouped.items():
        items = sorted(items, key=lambda x: x["periodo"])
        for i in range(len(items)):
            if i > 0:
                prev_monto = items[i-1]["monto_objetivo"]
                curr_monto = items[i]["monto_objetivo"]
                if prev_monto and curr_monto and prev_monto > 0:
                    items[i]["variacion_mensual"] = (curr_monto - prev_monto) / prev_monto
            final_upsert.append(items[i])

    print(f"Limpiando escalas actuales de Nestle...")
    supabase.table("dim_escalas").delete().eq("seller_id", seller_id).execute()

    print(f"Subiendo {len(final_upsert)} registros de escalas...")
    for chunk_start in range(0, len(final_upsert), 100):
        chunk = final_upsert[chunk_start:chunk_start+100]
        supabase.table("dim_escalas").insert(chunk).execute()

    print("¡Listo! Nestle insertado con éxito.")

if __name__ == '__main__':
    seed_nestle()
