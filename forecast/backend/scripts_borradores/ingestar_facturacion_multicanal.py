"""
Script completo de ingesta para facturacion.txt en Supabase.
Arquitectura Dimensional Multicanal & Regional de Reply:
- Asocia cada cuenta a su Holding en dim_clientes
- Asocia cada cuenta a su Plataforma en dim_plataformas
- Asocia país y moneda
- Inserta / actualiza dim_sellers
- Inserta facturación monetaria en tabla 'facturacion'
- Inserta métricas cuantitativas en 'fact_metricas_operativas'
- Omite totales consolidados calculados para no duplicar datos
"""

import os
import sys
import re
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
    "Prefer": "resolution=merge-duplicates"
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
    """Genera un id_seller determinístico en el rango 900.000.000+ para no colisionar con IDs de Meli"""
    crc = zlib.crc32(unique_str.encode("utf-8")) & 0xffffffff
    return 900000000 + (crc % 99000000)

def main():
    print("=== INICIANDO INGESTA MULTICANAL & REGIONAL ===")
    
    # 1. Obtener mapas maestros de dim_clientes y dim_sellers existentes
    r_cli = requests.get(f"{SUPABASE_URL}/rest/v1/dim_clientes?select=id_cliente,nombre_cliente", headers=HEADERS)
    clientes_map = {c["nombre_cliente"].lower(): c["id_cliente"] for c in r_cli.json()}
    
    r_sel = requests.get(f"{SUPABASE_URL}/rest/v1/dim_sellers?select=id_seller,nombre_seller", headers=HEADERS)
    sellers_existing = {s["nombre_seller"].lower(): s["id_seller"] for s in r_sel.json()}
    
    # Aliases conocidos para matchear con sellers que ya estaban en BD
    name_alias = {
        "la espumeria": "la espumería",
        "cafe martinez": "café martínez",
        "violetta cosmeticos": "violetta cosméticos"
    }

    # Leer facturacion.txt
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

    print(f"Total bloques a procesar: {len(blocks)}\n")

    sellers_to_upsert = []
    facturacion_inserts = []
    metricas_inserts = []

    for b in blocks:
        raw_name = b["account"].strip()
        name_lower = raw_name.lower()
        country_cfg = country_config[b["country_key"]]
        pais = country_cfg["pais"]
        moneda = country_cfg["moneda"]

        # Omitir filas de totales calculados para no duplicar datos
        if "total" in name_lower:
            print(f"⏩ Omitiendo fila consolidada: '{raw_name}' (se calcula dinámicamente)")
            continue

        # Detectar si es métrica operativa (unidades, horas, créditos)
        is_operational = "unidades de cantidad" in b["note"].lower() or "creditos" in name_lower or "horas extras" in name_lower or "sesiones" in name_lower

        if is_operational:
            # Determinar tipo de métrica
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
                    metricas_inserts.append({
                        "id_cliente": id_cliente,
                        "periodo": periodo,
                        "tipo_metrica": tipo,
                        "cantidad": num,
                        "unidad": unidad,
                        "notas": f"{raw_name} ({b['note']})"
                    })
            print(f"📊 Procesada métrica operativa: {raw_name} ({len(b['months'])} meses)")
            continue

        # Facturación monetaria normal
        # Mapear Holding, Plataforma y Marca
        holding = "Otro"
        plataforma = "MELI"
        marca = None

        if "newsan" in name_lower:
            holding = "Newsan"
            if "falabella" in name_lower:
                plataforma = "FALABELLA"
            elif "ripley" in name_lower:
                plataforma = "RIPLEY"
            elif "walmart" in name_lower:
                plataforma = "WALMART"
            elif "paris" in name_lower:
                plataforma = "PARIS"
            elif "kitchen" in name_lower:
                plataforma = "KITCHENCENTER"
            elif "motorola" in name_lower:
                plataforma = "MELI"
                marca = "Motorola"
            else:
                plataforma = "MELI"
        elif "pilisar" in name_lower:
            holding = "Newsan"
            marca = "Pilisar"
            plataforma = "MELI"
        elif "axo" in name_lower:
            holding = "Grupo Axo"
            if "lvp" in name_lower:
                plataforma = "LVP"
            else:
                plataforma = "MELI"
            if "ck" in name_lower:
                marca = "Calvin Klein"
            elif "th" in name_lower:
                marca = "Tommy Hilfiger"
        elif "evacol" in name_lower:
            holding = "Evacol"
            if "amazon" in name_lower:
                plataforma = "AMAZON"
            elif "addi" in name_lower:
                plataforma = "ADDI"
            else:
                plataforma = "MELI"
        elif "soda" in name_lower:
            holding = "Soda Stream"
            if "web" in name_lower:
                plataforma = "WEB"
            else:
                plataforma = "MELI"
        elif "natura" in name_lower:
            holding = "Natura"
            plataforma = "MELI"
        elif "trademedical" in name_lower:
            holding = "Trademedical"
            plataforma = "MELI"
        elif "disuiza" in name_lower:
            holding = "Disuiza"
            plataforma = "MELI"
        elif "formex" in name_lower:
            holding = "Formex"
            plataforma = "MELI"
        elif "jansport" in name_lower:
            holding = "Jansport"
            plataforma = "MELI"
        elif "herschel" in name_lower:
            holding = "Herschel"
            plataforma = "MELI"
        else:
            # Buscar en mapa de clientes existentes
            for cli_name, cli_id in clientes_map.items():
                if cli_name in name_lower or name_lower in cli_name:
                    holding = cli_name.title()
                    break

        id_cliente = clientes_map.get(holding.lower())

        # Buscar si ya tiene id_seller en dim_sellers
        matched_seller_id = None
        check_name = name_alias.get(name_lower, name_lower)
        for s_name, s_id in sellers_existing.items():
            if s_name == check_name or check_name in s_name or s_name in check_name:
                matched_seller_id = s_id
                break

        if not matched_seller_id:
            # Es una cuenta nueva: generamos ID sintético determinístico
            unique_key = f"{pais}_{plataforma}_{raw_name}"
            matched_seller_id = generate_synthetic_id(unique_key)
            print(f"[NUEVO] Cuenta: '{raw_name}' ({pais} - {plataforma}) -> ID: {matched_seller_id}")
            
            sellers_to_upsert.append({
                "id_seller": matched_seller_id,
                "nombre_seller": raw_name,
                "id_cliente": id_cliente,
                "codigo_plataforma": plataforma,
                "codigo_pais": pais,
                "marca": marca,
                "moneda": moneda,
                "estado": True,
                "cobrar_botmaker": False,
                "frecuencia_actualizacion": "MENSUAL"
            })
            sellers_existing[name_lower] = matched_seller_id

        # Parsear meses y valores de facturación
        for m, val in zip(b["months"], b["values"]):
            m = m.strip()
            if not m or "/" not in m:
                continue
            parts = m.split("/")
            periodo = f"{parts[1]}-{parts[0]}-01"
            monto = parse_number(val)
            
            # Solo agregar si el período tiene fecha válida
            if len(periodo) == 10:
                facturacion_inserts.append({
                    "seller_id": matched_seller_id,
                    "periodo": periodo,
                    "valor_facturado": monto,
                    "estado": "REAL",
                    "variacion_mensual": 0.0
                })

    # Inserción de Sellers nuevos en dim_sellers
    if sellers_to_upsert:
        print(f"\nGuardando {len(sellers_to_upsert)} cuentas nuevas en dim_sellers...")
        r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", json=sellers_to_upsert, headers=HEADERS)
        if r.status_code in [200, 201]:
            print(f"[OK] dim_sellers actualizado exitosamente.")
        else:
            print(f"[ERROR] dim_sellers: {r.status_code} -> {r.text}")

    # Inserción de Facturación en bloques de 500
    print(f"\nGuardando {len(facturacion_inserts)} registros en 'facturacion'...")
    chunk_size = 500
    success_fact = 0
    post_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    # Para los sellers procesados, limpiamos facturación REAL previa para evitar duplicados
    distinct_sellers = list(set([f["seller_id"] for f in facturacion_inserts]))
    print(f"Sincronizando {len(distinct_sellers)} cuentas en 'facturacion'...")
    for s_id in distinct_sellers:
        requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{s_id}&estado=eq.REAL", headers=post_headers)

    for idx in range(0, len(facturacion_inserts), chunk_size):
        chunk = facturacion_inserts[idx:idx + chunk_size]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", json=chunk, headers=post_headers)
        if r.status_code in [200, 201]:
            success_fact += len(chunk)
        else:
            print(f"[WARN] Error en chunk {idx}: {r.status_code} -> {r.text}")
    print(f"[OK] Facturacion guardada: {success_fact} registros.")

    # Inserción de Métricas Operativas
    if metricas_inserts:
        print(f"\nGuardando {len(metricas_inserts)} registros en 'fact_metricas_operativas'...")
        # Limpiar métricas previas para no duplicar
        requests.delete(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas?id=gt.0", headers=post_headers)
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas",
            json=metricas_inserts,
            headers=post_headers
        )
        if r.status_code in [200, 201]:
            print(f"[OK] fact_metricas_operativas guardada exitosamente ({len(metricas_inserts)} registros).")
        else:
            print(f"[WARN] Error en metricas operativas: {r.status_code} -> {r.text}")

    print("\n=== INGESTA MULTICANAL COMPLETADA CON EXITO ===")

if __name__ == "__main__":
    main()
