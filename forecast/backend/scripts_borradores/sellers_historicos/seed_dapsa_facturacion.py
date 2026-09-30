import os
from supabase import create_client, Client

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def parse_and_insert_facturacion(lines, seller_id):
    start_idx = -1
    for i, line in enumerate(lines):
        if line.strip() == "facturacion":
            start_idx = i
            break
            
    if start_idx == -1: return
    
    # next lines should be the headers and then the values
    headers_line = ""
    values_line = ""
    for i in range(start_idx + 1, len(lines)):
        if "01/2026" in lines[i]:
            headers_line = lines[i]
            values_line = lines[i+1]
            break
            
    if not headers_line or not values_line: return
    
    headers = headers_line.strip().split('\t')
    values = values_line.strip().split('\t')
    
    upserts = []
    for h, v in zip(headers, values):
        # h format: "01/2026"
        parts = h.split('/')
        if len(parts) == 2:
            periodo = f"{parts[1]}-{parts[0]}-01"
            
            # parse v
            val_str = v.replace('.', '').replace(',', '.')
            try:
                monto = float(val_str)
            except:
                monto = 0.0
                
            upserts.append({
                "seller_id": seller_id,
                "periodo": periodo,
                "valor_facturado": monto,
                "estado": "REAL"
            })
            
    if upserts:
        print(f"Insertando {len(upserts)} meses de facturación...")
        supabase.table("facturacion").upsert(upserts, on_conflict="seller_id,periodo").execute()

def seed_dapsa():
    seller_id = 447463711
    seller_name = "Dapsa"
    
    with open('dapsa.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    parse_and_insert_facturacion(lines, seller_id)
    
if __name__ == "__main__":
    seed_dapsa()
