import os
import sys
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

def seed_seller(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    seller_id = None
    seller_name = None
    pais = None
    moneda = None
    
    # --- DIM SELLERS ---
    for line in lines:
        if line.startswith("id_seller:"):
            seller_id = line.split(":", 1)[1].strip()
        elif line.startswith("nombre_seller:"):
            seller_name = line.split(":", 1)[1].strip()
        elif line.startswith("pais:"):
            pais = line.split(":", 1)[1].strip()
        elif line.startswith("moneda:"):
            moneda = line.split(":", 1)[1].strip()
            
    if not seller_id:
        print("No se encontró id_seller")
        return
        
    # Check if seller exists in dim_sellers, insert if not
    existing = supabase.table("dim_sellers").select("id_seller").eq("id_seller", seller_id).execute()
    if not existing.data:
        print(f"Insertando {seller_name} en dim_sellers...")
        supabase.table("dim_sellers").insert({
            "id_seller": seller_id,
            "nombre_seller": seller_name,
            "pais": pais or "AR",
            "moneda": moneda or "ARS",
            "estado": True,
            "cobrar_botmaker": True,
            "frecuencia_actualizacion": "MENSUAL"
        }).execute()
        
    # --- FACTURACION ---
    idx = 0
    while idx < len(lines):
        if 'facturacion' in lines[idx].lower():
            idx += 1
            while idx < len(lines) and not lines[idx].strip():
                idx += 1
            break
        idx += 1
        
    if idx < len(lines) and lines[idx].strip():
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
    idx = 0
    while idx < len(lines):
        if 'escalas' in lines[idx].lower():
            idx += 1
            while idx < len(lines) and not lines[idx].strip().startswith('202'):
                idx += 1
            break
        idx += 1
        
    if idx < len(lines) and lines[idx].strip():
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
            row = lines[idx].rstrip('\r\n').split('\t')
            if not any(x.strip() for x in row):
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
                            "pais": pais or "AR",
                            "moneda": moneda or "ARS",
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
                
    print(f"¡Listo! Datos de {seller_name} insertados con éxito.")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python seed_seller.py <archivo.txt>")
        sys.exit(1)
    seed_seller(sys.argv[1])
