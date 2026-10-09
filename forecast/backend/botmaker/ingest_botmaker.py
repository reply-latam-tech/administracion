import os
import shutil
import glob
import csv
import re
from datetime import datetime
from supabase import create_client, Client
import unicodedata

# Configuración Supabase
SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Obtener la ruta absoluta del directorio donde está este script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(BASE_DIR, "input")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

def normalize_name(name):
    if not name: return ""
    name = name.lower()
    return ''.join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')

def get_sellers_map():
    # Obtener sellers de la BD para mapeo
    response = supabase.table("dim_sellers").select("id_seller, nombre_seller").execute()
    sellers_map = {}
    for s in response.data:
        norm_name = normalize_name(s['nombre_seller'])
        sellers_map[norm_name] = s['id_seller']
        
    # Alias manuales para cuentas de botmaker que no coinciden exactamente
    alias_map = {
        "dapsa_1": "dapsa",
        "juanvaldez_1": "juan valdez",
        "juanvaldez": "juan valdez",
        "cafemartinez_1": "cafe martinez",
        "laespumeria_1": "la espumeria",
        "laespumeria_2": "la espumeria",
        "morixe_1": "morixe",
        "sodastream_1": "sodastream",
        "stylestore_1": "stylestore",
        "bellapaloma_1": "bellapaloma",
        "dapopmakeup_1": "dapopmakeup",
        "dapopmakeup_2": "dapopmakeup",
        "belcorp_1": "belcorp",
        "almanativa": "alma nativa",
        "violetta": "violetta cosmeticos",
        "abarka": "abarka",
        "geat": "geat"
    }
    
    # Expandir el mapa con los alias
    for alias, real_name in alias_map.items():
        if normalize_name(real_name) in sellers_map:
            sellers_map[normalize_name(alias)] = sellers_map[normalize_name(real_name)]
            
    return sellers_map

def extract_period(headers):
    # Buscar una columna que diga "Botmaker platform fee Jul 2026 billed"
    for h in headers:
        if not h: continue
        match = re.search(r'Botmaker platform fee (.*) billed', h, re.IGNORECASE)
        if match and "count" not in h.lower():
            date_str = match.group(1).strip()
            # Botmaker usa formato en inglés ej: "Jul 2026", "Aug 2026"
            try:
                dt = datetime.strptime(date_str, "%b %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None

def process_file(filepath, sellers_map):
    print(f"Procesando {filepath}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        headers = reader.fieldnames
        
        periodo = extract_period(headers)
        if not periodo:
            print("ERROR: No se pudo detectar el periodo (mes y año) en las columnas de Botmaker.")
            return False
            
        print(f"Período detectado: {periodo}")
        
        rows_to_upsert = []
        
        for row in reader:
            child_name = row.get("Child Account Name", "")
            child_project_id = row.get("Child Project Id", "")
            
            if not child_name or not child_project_id:
                continue # Fila principal o vacía
                
            norm_name = normalize_name(child_name)
            seller_id = sellers_map.get(norm_name)
            
            # Sumar SOLO el Botmaker platform fee + 20%
            total_billed = 0.0
            raw_data = {}
            
            for key, val in row.items():
                if not key: continue
                raw_data[key] = val
                
                # Buscar específicamente la columna de la licencia (ej: Botmaker platform fee Aug 2026 billed)
                if 'botmaker platform fee' in key.lower() and key.strip().lower().endswith('billed') and not key.strip().lower().endswith('count'):
                    try:
                        v = float(val) if val else 0.0
                        total_billed += v  # Sin markup, valor original de la factura
                    except:
                        pass
                        
            rows_to_upsert.append({
                "periodo": periodo,
                "seller_id": seller_id,
                "child_project_id": child_project_id,
                "child_project_name": row.get("Child Project Name", ""),
                "total_billed": round(total_billed, 2),
                "raw_data": raw_data
            })
            
        if rows_to_upsert:
            response = supabase.table("botmaker_consumos").upsert(
                rows_to_upsert, 
                on_conflict="periodo,child_project_id"
            ).execute()
            print(f"OK: Se guardaron/actualizaron {len(rows_to_upsert)} registros en Supabase.")
            return True
        else:
            print("WARN: No se encontraron filas de Child Accounts para procesar.")
            return False

def main():
    if not os.path.exists(INPUT_DIR):
        os.makedirs(INPUT_DIR)
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    files = glob.glob(os.path.join(INPUT_DIR, "*.*"))
    if not files:
        print("No hay archivos en la carpeta input.")
        return

    print("Conectando a Supabase para obtener mapeo de Sellers...")
    sellers_map = get_sellers_map()

    for filepath in files:
        try:
            success = process_file(filepath, sellers_map)
            
            if success:
                filename = os.path.basename(filepath)
                dest = os.path.join(OUTPUT_DIR, filename)
                shutil.move(filepath, dest)
                print(f"OK: Archivo movido a {dest}\n")
            else:
                print(f"FAIL: Se omitió mover {filepath} por errores.\n")
        except Exception as e:
            print(f"ERROR: Error crítico procesando {filepath}: {e}\n")

if __name__ == "__main__":
    main()
