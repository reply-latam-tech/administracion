import os
from supabase import create_client, Client
from collections import defaultdict

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def parse_number(val_str):
    if not val_str:
        return 0.0
    val_str = val_str.strip()
    if '%' in val_str:
        return float(val_str.replace('%','').replace(',','.')) / 100
    try:
        return float(val_str.replace('.','').replace(',','.'))
    except:
        return 0.0

def seed_juan_valdez():
    seller_id = "2364040418"
    seller_name = "Juan Valdez"
    
    with open('juan_valdez.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # --- FACTURACION ---
    idx = 0
    while idx < len(lines):
        if 'facturacion' in lines[idx].lower():
            idx += 2
            break
        idx += 1
        
    meses_fact = lines[idx].strip().split('\t')
    idx += 1
    montos_fact = lines[idx].strip().split('\t')
    
    facturacion_inserts = []
    for m, val in zip(meses_fact, montos_fact):
        parts = m.split('/')
        if len(parts) == 2:
            periodo = f"{parts[1]}-{parts[0]}-01"
            monto = parse_number(val)
            facturacion_inserts.append({
                "seller_id": seller_id,
                "periodo": periodo,
                "valor_facturado": monto,
                "estado": "REAL",
                "variacion_mensual": 0.0
            })
            
    # Calcular variacion_mensual para facturacion
    facturacion_inserts = sorted(facturacion_inserts, key=lambda x: x["periodo"])
    for i in range(1, len(facturacion_inserts)):
        prev = facturacion_inserts[i-1]["valor_facturado"]
        curr = facturacion_inserts[i]["valor_facturado"]
        if prev and prev > 0:
            facturacion_inserts[i]["variacion_mensual"] = (curr - prev) / prev

    print(f"Limpiando facturacion REAL de {seller_name}...")
    supabase.table("facturacion").delete().eq("seller_id", seller_id).eq("estado", "REAL").execute()
    
    if facturacion_inserts:
        print(f"Insertando {len(facturacion_inserts)} registros en facturacion...")
        supabase.table("facturacion").insert(facturacion_inserts).execute()
        
    # --- ESCALAS ---
    while idx < len(lines):
        if 'escalas' in lines[idx].lower():
            idx += 2
            break
        idx += 1
        
    fechas_escalas = []
    headers = lines[idx].strip().split('\t')
    for i, h in enumerate(headers):
        if h.strip():
            fechas_escalas.append({
                "periodo": h.strip(),
                "col_alicuota": i,
                "col_monto": i + 1
            })
            
    idx += 2 # Skip Alícuota/Monto headers
    
    escalas_inserts = []
    while idx < len(lines):
        row = lines[idx].strip().split('\t')
        if not row or not any(row):
            idx += 1
            continue
            
        for f in fechas_escalas:
            if f["col_alicuota"] < len(row) and f["col_monto"] < len(row):
                alicuota = parse_number(row[f["col_alicuota"]])
                monto = parse_number(row[f["col_monto"]])
                if monto > 0:
                    tipo_cargo = 'MINIMO' if alicuota == 0 else 'PORCENTUAL'
                    escalas_inserts.append({
                        "seller_id": seller_id,
                        "periodo": f["periodo"],
                        "tipo_cargo": tipo_cargo,
                        "alicuota": alicuota,
                        "monto_objetivo": monto,
                        "pais": "AR",
                        "moneda": "ARS",
                        "variacion_mensual": 0.0
                    })
        idx += 1
        
    # Compute variacion_mensual
    grouped = defaultdict(list)
    for row in escalas_inserts:
        grouped[row["tipo_cargo"] + str(row["alicuota"])].append(row)
        
    final_upsert = []
    for k, items in grouped.items():
        items = sorted(items, key=lambda x: x["periodo"])
        for i in range(len(items)):
            if i > 0:
                prev_monto = items[i-1]["monto_objetivo"]
                curr_monto = items[i]["monto_objetivo"]
                if prev_monto and curr_monto and prev_monto > 0:
                    items[i]["variacion_mensual"] = (curr_monto - prev_monto) / prev_monto
            final_upsert.append(items[i])
            
    print(f"Limpiando escalas actuales de {seller_name}...")
    supabase.table("dim_escalas").delete().eq("seller_id", seller_id).execute()
    
    if final_upsert:
        print(f"Subiendo {len(final_upsert)} registros de escalas...")
        for chunk_start in range(0, len(final_upsert), 100):
            chunk = final_upsert[chunk_start:chunk_start+100]
            supabase.table("dim_escalas").insert(chunk).execute()
            
    print("¡Listo! Datos de Juan Valdez insertados con éxito.")

if __name__ == '__main__':
    seed_juan_valdez()
