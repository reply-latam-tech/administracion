import os
from datetime import datetime
from supabase import create_client, Client
import csv
import io
from collections import defaultdict

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_morixe():
    seller_name = "Morixe"
    seller_id = 415143126

    # 1. Escalas
    with open('morixe_escalas.csv', 'r', encoding='utf-8') as f:
        csv_escalas = f.read()

    reader = csv.reader(io.StringIO(csv_escalas))
    rows = list(reader)

    header_meses = rows[0]

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

    # Group by both tipo_cargo and alicuota for correct inflation %
    grouped = defaultdict(list)
    for row in upsert_escalas:
        key = f"{row['tipo_cargo']}_{row['alicuota']}"
        grouped[key].append(row)

    final_upsert = []
    for key, items in grouped.items():
        items = sorted(items, key=lambda x: x["periodo"])
        for i in range(len(items)):
            if i > 0:
                prev_monto = items[i-1]["monto_objetivo"]
                curr_monto = items[i]["monto_objetivo"]
                if prev_monto and curr_monto and prev_monto > 0:
                    items[i]["variacion_mensual"] = round((curr_monto - prev_monto) / prev_monto, 6)
            final_upsert.append(items[i])

    print(f"Limpiando escalas actuales de Morixe...")
    supabase.table("dim_escalas").delete().eq("seller_id", seller_id).execute()

    print(f"Subiendo {len(final_upsert)} registros de escalas...")
    for chunk_start in range(0, len(final_upsert), 100):
        chunk = final_upsert[chunk_start:chunk_start+100]
        supabase.table("dim_escalas").insert(chunk).execute()

    # 2. Facturación Histórica Real
    meses_facturacion = [
        "2025-08-01", "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01",
        "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01",
        "2026-06-01", "2026-07-01", "2026-08-01"
    ]
    valores_facturacion = [
        "1.439.597", "35.750.103", "63.598.093", "107.503.572", "98.203.352", 
        "148.042.980", "118.355.261", "109.294.163", "91.710.665", "100.761.248,00", 
        "75.971.930", "86.071.949", "91.855.355"
    ]

    print(f"Limpiando facturación histórica de Morixe...")
    supabase.table("facturacion").delete().eq("seller_id", seller_id).execute()
    
    upsert_facturacion = []
    for m, vStr in zip(meses_facturacion, valores_facturacion):
        val = float(vStr.replace('.', '').replace(',', '.'))
        upsert_facturacion.append({
            "seller_id": seller_id,
            "periodo": m,
            "valor_facturado": val,
            "variacion_mensual": 0.0 # Se calculará despues
        })

    # Calcular variación mensual de facturación
    upsert_facturacion = sorted(upsert_facturacion, key=lambda x: x["periodo"])
    for i in range(1, len(upsert_facturacion)):
        prev = upsert_facturacion[i-1]["valor_facturado"]
        curr = upsert_facturacion[i]["valor_facturado"]
        if prev > 0:
            upsert_facturacion[i]["variacion_mensual"] = round((curr - prev) / prev, 6)

    print(f"Subiendo {len(upsert_facturacion)} registros de facturación...")
    supabase.table("facturacion").insert(upsert_facturacion).execute()

    print("¡Listo! Morixe insertado con éxito.")

if __name__ == '__main__':
    seed_morixe()
