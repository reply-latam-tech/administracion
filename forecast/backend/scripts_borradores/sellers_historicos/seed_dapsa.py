import os
from supabase import create_client, Client
import re

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_dapsa():
    seller_id = 447463711
    seller_name = "Dapsa"
    
    print("Insertando/Actualizando Dapsa en dim_sellers...")
    supabase.table("dim_sellers").upsert({
        "id_seller": seller_id,
        "nombre_seller": seller_name,
        "pais": "AR",
        "moneda": "ARS",
        "estado": True,
        "cobrar_botmaker": True,
        "frecuencia_actualizacion": "MENSUAL"
    }).execute()
    
    print("Leyendo dapsa.txt para parsear las escalas...")
    with open('dapsa.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # Encontrar la línea de periodos
    start_idx = 0
    for i, line in enumerate(lines):
        if line.startswith("2026-02-01"):
            start_idx = i
            break
            
    meses_line = lines[start_idx].strip().split()
    # ["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"]
    # En el archivo, cada mes corresponde a (Alícuota, Monto)
    
    # Ignoramos la línea "Alícuota Monto ..."
    data_lines = lines[start_idx+2:]
    
    upsert_escalas = []
    
    for row in data_lines:
        if not row.strip(): continue
        cols = row.strip().split('\t')
        if len(cols) < 2: continue
        
        # El primero podría ser '0' y el segundo el monto mínimo
        for m_idx, mes in enumerate(meses_line):
            col_ali = m_idx * 2
            col_monto = col_ali + 1
            
            if col_ali >= len(cols) or col_monto >= len(cols):
                continue
                
            val_ali = cols[col_ali].strip()
            val_monto = cols[col_monto].strip()
            
            if not val_ali and not val_monto:
                continue
                
            alicuota = 0.0
            tipo_cargo = 'PORCENTUAL'
            if val_ali:
                if val_ali == '0':
                    tipo_cargo = 'MINIMO'
                elif '%' in val_ali:
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
                    
            upsert_escalas.append({
                "seller_id": seller_id,
                "periodo": mes,
                "tipo_cargo": tipo_cargo,
                "alicuota": round(alicuota, 6),
                "monto_objetivo": round(monto, 2),
                "pais": "AR",
                "moneda": "ARS",
                "variacion_mensual": 0.0,
                "estado": "REAL"
            })
            
    print(f"Limpiando escalas actuales de {seller_name}...")
    supabase.table("dim_escalas").delete().eq("seller_id", seller_id).execute()

    print(f"Subiendo {len(upsert_escalas)} registros de escalas...")
    for chunk_start in range(0, len(upsert_escalas), 100):
        chunk = upsert_escalas[chunk_start:chunk_start+100]
        supabase.table("dim_escalas").insert(chunk).execute()

    print(f"¡Listo! {seller_name} y sus escalas fueron insertados con éxito.")

if __name__ == "__main__":
    seed_dapsa()
