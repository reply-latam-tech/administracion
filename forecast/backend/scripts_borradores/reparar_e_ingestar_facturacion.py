"""
Script para sincronizar con máxima precisión facturacion.txt en Supabase:
- Mapea exactamente cada una de las 39 cuentas operativas de Reply LATAM
- Calcula la variación mensual (variacion_mensual) en cada registro
- Carga las métricas operativas en fact_metricas_operativas
- Asocia cada cuenta con su Holding en dim_clientes, su Plataforma y País
"""

import os
import sys
import zlib
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hnowniqxrtxrrujgnhqj.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def parse_number(val_str):
    if not val_str or not val_str.strip():
        return 0.0
    s = val_str.strip().replace(" ", "")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s and "." not in s:
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            s = parts[0] + "." + parts[1]
        else:
            s = s.replace(",", "")
    elif "." in s:
        parts = s.split(".")
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            s = s.replace(".", "")
    try:
        return float(s)
    except Exception:
        return 0.0

def generate_synthetic_id(unique_str):
    crc = zlib.crc32(unique_str.encode("utf-8")) & 0xffffffff
    return 900000000 + (crc % 99000000)

def main():
    print("=== SINCRONIZANDO FACTURACION MULTICANAL CON VARIACIONES MENSUALES ===")

    # 1. Obtener Holdings de dim_clientes
    r_cli = requests.get(f"{SUPABASE_URL}/rest/v1/dim_clientes?select=id_cliente,nombre_cliente", headers=HEADERS).json()
    clientes_map = {c["nombre_cliente"].lower(): c["id_cliente"] for c in r_cli}

    # 2. Los 13 sellers originales de Argentina con sus IDs reales
    original_sellers_map = {
        "nestle": 195352434,
        "morixe": 415143126,
        "la espumeria": 425901767,
        "la espumería": 425901767,
        "cafe martinez": 1088146491,
        "café martínez": 1088146491,
        "dapsa": 447463711,
        "juan valdez": 2364040418,
        "lifecycle": 1684118419,
        "pinturas online": 484050606,
        "taurus": 742384574,
        "alma nativa": 414078026,
        "violetta cosmeticos": 1397861779,
        "violetta cosméticos": 1397861779,
        "abarka": 173637868,
        "geat": 26458937
    }

    # 3. Leer y parsear bloques de facturacion.txt
    file_path = os.path.join(os.path.dirname(__file__), "facturacion_bruta", "facturacion.txt")
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    lines = [l.strip() for l in text.splitlines()]

    current_country = "Argentina"
    country_config = {
        "argentina": {"pais": "AR", "moneda": "ARS"},
        "mexico": {"pais": "MX", "moneda": "MXN"},
        "chile": {"pais": "CL", "moneda": "CLP"},
        "colombia": {"pais": "CO", "moneda": "COP"},
        "estados unidos": {"pais": "US", "moneda": "USD"}
    }

    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("---") and i + 1 < len(lines):
            cand = lines[i+1].strip().lower()
            if cand in country_config:
                current_country = cand
                i += 3
                continue

        if line and not line.startswith("--") and not line.startswith("---"):
            account_name = line
            i += 1
            while i < len(lines) and not lines[i]:
                i += 1
            if i < len(lines):
                months_line = lines[i]
                i += 1
                note = ""
                while i < len(lines) and (not lines[i] or lines[i].startswith("(")):
                    if lines[i].startswith("("):
                        note = lines[i]
                    i += 1
                if i < len(lines):
                    values_line = lines[i]
                    blocks.append({
                        "country_key": current_country,
                        "account": account_name,
                        "months": months_line.split("\t"),
                        "values": values_line.split("\t"),
                        "note": note
                    })
        i += 1

    print(f"Total bloques en archivo: {len(blocks)}")

    # Estructura de almacenamiento
    accounts_to_upsert = []
    facturacion_records = []
    metricas_records = []

    for b in blocks:
        raw_name = b["account"].strip()
        name_lower = raw_name.lower()
        country_cfg = country_config[b["country_key"]]
        pais = country_cfg["pais"]
        moneda = country_cfg["moneda"]

        # Omitir totales calculados
        if "total" in name_lower:
            print(f"[OMITIDO] '{raw_name}' (total consolidado)")
            continue

        # Métricas no monetarias
        is_operational = "unidades de cantidad" in b["note"].lower() or "creditos" in name_lower or "horas extras" in name_lower or "sesiones" in name_lower
        if is_operational:
            tipo = "SESIONES"
            unidad = "UNIDADES"
            holding_name = "Newsan"
            if "hora" in name_lower:
                tipo = "HORAS_EXTRAS"
                unidad = "HORAS"
                holding_name = "Newsan"
            elif "credito" in name_lower:
                tipo = "CREDITOS"
                unidad = "CREDITOS"
                holding_name = "Grupo Axo"
            elif "soda" in name_lower:
                holding_name = "Soda Stream"

            id_cliente = clientes_map.get(holding_name.lower())
            for m, val in zip(b["months"], b["values"]):
                m = m.strip()
                if not m or "/" not in m:
                    continue
                parts = m.split("/")
                periodo = f"{parts[1]}-{parts[0]}-01"
                num = parse_number(val)
                if num > 0:
                    metricas_records.append({
                        "id_cliente": id_cliente,
                        "periodo": periodo,
                        "tipo_metrica": tipo,
                        "cantidad": num,
                        "unidad": unidad,
                        "notas": f"{raw_name} ({b['note']})"
                    })
            continue

        # Facturación monetaria normal: Identificación exacta
        holding = "Otro"
        plataforma = "MELI"
        marca = None
        display_name = raw_name

        # Clasificación por país y marca
        if pais == "AR":
            if name_lower == "newsan":
                holding = "Newsan"
                display_name = "Newsan Argentina"
                plataforma = "MELI"
            elif "motorola" in name_lower:
                holding = "Newsan"
                display_name = "Newsan Motorola"
                marca = "Motorola"
                plataforma = "MELI"
            elif "pilisar" in name_lower:
                holding = "Newsan"
                display_name = "Pilisar"
                marca = "Pilisar"
                plataforma = "MELI"
            elif "soda stream ml" in name_lower:
                holding = "Soda Stream"
                display_name = "Soda Stream ML"
                plataforma = "MELI"
            elif "soda stream - web" in name_lower:
                holding = "Soda Stream"
                display_name = "Soda Stream Web"
                plataforma = "WEB"
            elif "jansport" in name_lower:
                holding = "Jansport"
                display_name = "Jansport Argentina"
                plataforma = "MELI"
            elif "herschel" in name_lower:
                holding = "Herschel"
                display_name = "Herschel Argentina"
                plataforma = "MELI"
            else:
                for orig_name, orig_id in original_sellers_map.items():
                    if orig_name == name_lower:
                        holding = orig_name.title()
                        display_name = raw_name
                        break
        elif pais == "MX":
            if "axo" in name_lower:
                holding = "Grupo Axo"
                if "ck ml" in name_lower:
                    display_name = "Grupo Axo - CK ML"
                    marca = "Calvin Klein"
                    plataforma = "MELI"
                elif "th ml" in name_lower:
                    display_name = "Grupo Axo - TH ML"
                    marca = "Tommy Hilfiger"
                    plataforma = "MELI"
                elif "ck lvp" in name_lower:
                    display_name = "Grupo Axo - CK LVP"
                    marca = "Calvin Klein"
                    plataforma = "LVP"
                elif "th lvp" in name_lower:
                    display_name = "Grupo Axo - TH LVP"
                    marca = "Tommy Hilfiger"
                    plataforma = "LVP"
            elif "evacol" in name_lower:
                holding = "Evacol"
                display_name = "Evacol México"
                plataforma = "MELI"
            elif "natura" in name_lower:
                holding = "Natura"
                display_name = "Natura México"
                plataforma = "MELI"
        elif pais == "CL":
            if "newsan ml" in name_lower:
                holding = "Newsan"
                display_name = "Newsan Chile ML"
                plataforma = "MELI"
            elif "falabella" in name_lower:
                holding = "Newsan"
                display_name = "Newsan Chile Falabella"
                plataforma = "FALABELLA"
            elif "ripley" in name_lower:
                holding = "Newsan"
                display_name = "Newsan Chile Ripley"
                plataforma = "RIPLEY"
            elif "walmart" in name_lower:
                holding = "Newsan"
                display_name = "Newsan Chile Walmart"
                plataforma = "WALMART"
            elif "paris" in name_lower:
                holding = "Newsan"
                display_name = "Newsan Chile Paris"
                plataforma = "PARIS"
            elif "kitchen" in name_lower:
                holding = "Newsan"
                display_name = "Newsan Chile Kitchen Center"
                plataforma = "KITCHENCENTER"
            elif "trademedical" in name_lower:
                holding = "Trademedical"
                display_name = "Trademedical Chile"
                plataforma = "MELI"
        elif pais == "CO":
            if "disuiza" in name_lower:
                holding = "Disuiza"
                display_name = "Disuiza Colombia"
                plataforma = "MELI"
            elif "natura" in name_lower:
                holding = "Natura"
                display_name = "Natura Colombia"
                plataforma = "MELI"
            elif "colombia ml" in name_lower or ("evacol" in name_lower and "ml" in name_lower):
                holding = "Evacol"
                display_name = "Evacol Colombia ML"
                plataforma = "MELI"
            elif "colombia addi" in name_lower or ("evacol" in name_lower and "addi" in name_lower):
                holding = "Evacol"
                display_name = "Evacol Colombia ADDI"
                plataforma = "ADDI"
            elif "formex" in name_lower:
                holding = "Formex"
                display_name = "Formex Colombia"
                plataforma = "MELI"
        elif pais == "US":
            holding = "Evacol"
            display_name = "Evacol Amazon USA"
            plataforma = "AMAZON"

        id_cliente = clientes_map.get(holding.lower())

        # Asignar ID seller: Si es de los 13 originales, usa el suyo; si no, ID sintético
        if name_lower in original_sellers_map:
            seller_id = original_sellers_map[name_lower]
        else:
            unique_seed = f"{pais}_{plataforma}_{display_name}"
            seller_id = generate_synthetic_id(unique_seed)

        accounts_to_upsert.append({
            "id_seller": seller_id,
            "nombre_seller": display_name,
            "id_cliente": id_cliente,
            "codigo_plataforma": plataforma,
            "codigo_pais": pais,
            "marca": marca,
            "moneda": moneda,
            "estado": True,
            "cobrar_botmaker": False,
            "frecuencia_actualizacion": "MENSUAL"
        })

        # Parsear meses y calcular variacion_mensual
        monthly_series = []
        for m, val in zip(b["months"], b["values"]):
            m = m.strip()
            if not m or "/" not in m:
                continue
            parts = m.split("/")
            periodo = f"{parts[1]}-{parts[0]}-01"
            monto = parse_number(val)
            if len(periodo) == 10:
                monthly_series.append({"periodo": periodo, "valor": monto})

        monthly_series.sort(key=lambda x: x["periodo"])
        for idx, item in enumerate(monthly_series):
            var_pct = 0.0
            if idx > 0 and monthly_series[idx-1]["valor"] > 0:
                prev = monthly_series[idx-1]["valor"]
                curr = item["valor"]
                var_pct = round((curr - prev) / prev, 4)

            facturacion_records.append({
                "seller_id": seller_id,
                "periodo": item["periodo"],
                "valor_facturado": item["valor"],
                "estado": "REAL",
                "variacion_mensual": var_pct
            })

    print(f"\nTotal cuentas operativas preparadas: {len(accounts_to_upsert)}")
    print(f"Total registros de facturación con variación: {len(facturacion_records)}")
    print(f"Total registros de métricas operativas: {len(metricas_records)}")

    # 4. Upsert de dim_sellers
    print("\nActualizando dim_sellers...")
    headers_upsert = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers?on_conflict=id_seller", json=accounts_to_upsert, headers=headers_upsert)
    if r.status_code in [200, 201]:
        print(f"[OK] dim_sellers actualizado exitosamente con las {len(accounts_to_upsert)} cuentas.")
    else:
        print(f"[ERROR] dim_sellers: {r.status_code} -> {r.text}")

    # 5. Sincronizar facturacion
    print("\nSincronizando 'facturacion'...")
    distinct_sellers = list(set([f["seller_id"] for f in facturacion_records]))
    for s_id in distinct_sellers:
        requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{s_id}&estado=eq.REAL", headers=HEADERS)

    chunk_size = 500
    success_count = 0
    for idx in range(0, len(facturacion_records), chunk_size):
        chunk = facturacion_records[idx:idx + chunk_size]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", json=chunk, headers=HEADERS)
        if r.status_code in [200, 201]:
            success_count += len(chunk)
        else:
            print(f"[WARN] Error en chunk {idx}: {r.status_code} -> {r.text}")
    print(f"[OK] {success_count} registros guardados en 'facturacion' con variacion_mensual.")

    # 6. Sincronizar metricas operativas
    print("\nSincronizando 'fact_metricas_operativas'...")
    requests.delete(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas?id=gt.0", headers=HEADERS)
    r = requests.post(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas", json=metricas_records, headers=HEADERS)
    if r.status_code in [200, 201]:
        print(f"[OK] {len(metricas_records)} registros guardados en 'fact_metricas_operativas'.")
    else:
        print(f"[WARN] Error en metricas: {r.status_code} -> {r.text}")

    print("\n=== PROCESO COMPLETADO EXITOSAMENTE ===")

if __name__ == "__main__":
    main()
