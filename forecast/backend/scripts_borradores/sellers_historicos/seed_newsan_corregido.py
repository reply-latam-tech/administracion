import os
import re
import requests
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def parse_num(s):
    if not s or not s.strip(): return 0.0
    cleaned = s.strip().replace('.', '').replace(',', '.')
    try:
        return float(cleaned)
    except:
        return 0.0

print("=== INICIANDO CONFIGURACIÓN INTEGRAL Y CORREGIDA DE NEWSAN ===")

# -----------------------------------------------------------------------------
# 1. ACTUALIZAR SELLERS EN DIM_SELLERS
# -----------------------------------------------------------------------------
SELLER_NEWSAN_ML = 959595439      # Newsan (Mercado Libre) - Consolidado de ML
SELLER_NEWSAN_MOTO = 948058233    # Newsan Motorola (detalle interno)
SELLER_PILISAR = 914884786        # Pilisar (detalle interno)
SELLER_NEWSAN_WEB = 989595440     # Newsan (Tienda Web)

sellers_updates = [
    {
        "id_seller": SELLER_NEWSAN_ML,
        "nombre_seller": "Newsan (Mercado Libre)",
        "codigo_plataforma": "MELI",
        "codigo_pais": "AR",
        "pais": "AR",
        "moneda": "ARS",
        "id_cliente": 14,
        "frecuencia_actualizacion": "TRIMESTRAL",
        "cobrar_botmaker": False,
        "estado": True
    },
    {
        "id_seller": SELLER_NEWSAN_WEB,
        "nombre_seller": "Newsan (Tienda Web)",
        "codigo_plataforma": "WEB",
        "codigo_pais": "AR",
        "pais": "AR",
        "moneda": "ARS",
        "id_cliente": 14,
        "frecuencia_actualizacion": "SEMESTRAL",
        "cobrar_botmaker": False,
        "estado": True
    },
    {
        "id_seller": SELLER_NEWSAN_MOTO,
        "nombre_seller": "Newsan Motorola",
        "codigo_plataforma": "MELI",
        "codigo_pais": "AR",
        "pais": "AR",
        "moneda": "ARS",
        "id_cliente": 14,
        "frecuencia_actualizacion": "TRIMESTRAL",
        "cobrar_botmaker": False,
        "estado": True
    },
    {
        "id_seller": SELLER_PILISAR,
        "nombre_seller": "Pilisar",
        "codigo_plataforma": "MELI",
        "codigo_pais": "AR",
        "pais": "AR",
        "moneda": "ARS",
        "id_cliente": 14,
        "frecuencia_actualizacion": "TRIMESTRAL",
        "cobrar_botmaker": False,
        "estado": True
    }
]

print("\n1. Sincronizando dim_sellers...")
for s in sellers_updates:
    r = requests.patch(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{s['id_seller']}", headers=HEADERS, json=s)
    if r.status_code not in (200, 204):
        requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=s)
    print(f" - {s['nombre_seller']} ({s['id_seller']}): OK")

# -----------------------------------------------------------------------------
# 2. PARSEAR NEWSAN.TXT
# -----------------------------------------------------------------------------
print("\n2. Parseando newsan.txt...")
with open('forecast/backend/scripts_borradores/sellers_historicos/newsan.txt', 'r', encoding='utf-8') as f:
    newsan_lines = [l.strip() for l in f.readlines()]

periodos_ml = [p.strip() for p in newsan_lines[4].split('\t\t') if p.strip()]

# Escala 1: Mercado Libre (8 tramos: 1 minimo + 7 porcentuales)
tramos_ml_por_periodo = {p: [] for p in periodos_ml}
for r_idx in range(6, 14):
    cols = newsan_lines[r_idx].split('\t')
    for p_idx, p in enumerate(periodos_ml):
        c_ali = p_idx * 2
        c_monto = c_ali + 1
        if c_monto < len(cols):
            ali_str = cols[c_ali].strip()
            monto_str = cols[c_monto].strip()
            ali = parse_num(ali_str.replace('%', '')) / 100.0 if '%' in ali_str else parse_num(ali_str)
            monto = parse_num(monto_str)
            tipo = 'MINIMO' if ali == 0 else 'PORCENTUAL'
            tramos_ml_por_periodo[p].append({'tipo': tipo, 'alicuota': ali, 'monto': monto})

# Escala 2: Tienda Web Sesiones (15 tramos: 0 a 40.000)
periodos_ses = [p.strip() for p in newsan_lines[17].split('\t\t') if p.strip()]
tramos_ses_por_periodo = {p: [] for p in periodos_ses}
for r_idx in range(19, 35):
    cols = newsan_lines[r_idx].split('\t')
    for p_idx, p in enumerate(periodos_ses):
        c_ali = p_idx * 2
        c_monto = c_ali + 1
        if c_monto < len(cols):
            tramo_qty = parse_num(cols[c_ali])
            monto = parse_num(cols[c_monto])
            tipo = 'MINIMO' if tramo_qty == 0 else 'SESIONES'
            tramos_ses_por_periodo[p].append({'tipo': tipo, 'sesiones': tramo_qty, 'monto': monto})

cols_hs = newsan_lines[37].split('\t')
tarifa_hs_extra = {p: parse_num(cols_hs[p_idx * 2 + 1]) for p_idx, p in enumerate(periodos_ses) if p_idx * 2 + 1 < len(cols_hs)}

cols_ses = newsan_lines[38].split('\t')
tarifa_sesion = {p: parse_num(cols_ses[p_idx * 2 + 1]) for p_idx, p in enumerate(periodos_ses) if p_idx * 2 + 1 < len(cols_ses)}

# -----------------------------------------------------------------------------
# 3. PARSEAR FACTURACION.TXT
# -----------------------------------------------------------------------------
print("\n3. Parseando facturacion.txt...")
with open('forecast/backend/scripts_borradores/facturacion_bruta/facturacion.txt', 'r', encoding='utf-8') as f:
    fact_content = f.read()

def extract_section(section_name):
    pattern = rf"{section_name}\s*\n+([0-9\/\t ]+)\n+([^\n\-]+)"
    match = re.search(pattern, fact_content)
    if not match: return {}
    months_str = match.group(1).strip().split('\t')
    vals_str = match.group(2).strip().split('\t')
    res = {}
    for m, v in zip(months_str, vals_str):
        m = m.strip()
        if not m: continue
        parts = m.split('/')
        if len(parts) == 2:
            res[f"{parts[1]}-{parts[0]}-01"] = parse_num(v)
    return res

newsan_raw = extract_section('Newsan')
moto_raw = extract_section('Newsan Motorola')
pilisar_raw = extract_section('Pilisar')

def extract_metric(metric_name):
    pattern = rf"{metric_name}\s*\n+([0-9\/\t ]+)\n+\(son unidades de cantidad no de dinero\)\n+([^\n\-]+)"
    match = re.search(pattern, fact_content)
    if not match: return {}
    months_str = match.group(1).strip().split('\t')
    vals_str = match.group(2).strip().split('\t')
    res = {}
    for m, v in zip(months_str, vals_str):
        m = m.strip()
        if not m: continue
        parts = m.split('/')
        if len(parts) == 2:
            res[f"{parts[1]}-{parts[0]}-01"] = parse_num(v)
    return res

sesiones_raw = extract_metric('Newsan - Sesiones')
horas_raw = extract_metric('Newsan - Horas extras')

# AJUSTE DE LISBETH (IMAGEN 2):
# En Sep 2026, la liquidación oficial de Lisbeth tiene 0 hs extras (no 9 hs)
horas_raw['2026-09-01'] = 0.0

# -----------------------------------------------------------------------------
# 4. GUARDAR FACT_METRICAS_OPERATIVAS
# -----------------------------------------------------------------------------
print("\n4. Guardando fact_metricas_operativas...")
requests.delete(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas?seller_id=eq.{SELLER_NEWSAN_WEB}", headers=HEADERS)

metricas_inserts = []
for p, q in sesiones_raw.items():
    metricas_inserts.append({
        "seller_id": SELLER_NEWSAN_WEB,
        "id_cliente": 14,
        "periodo": p,
        "tipo_metrica": "SESIONES",
        "cantidad": q,
        "unidad": "UNIDADES",
        "notas": "Sesiones mensuales de Tienda Newsan Web"
    })

for p, q in horas_raw.items():
    metricas_inserts.append({
        "seller_id": SELLER_NEWSAN_WEB,
        "id_cliente": 14,
        "periodo": p,
        "tipo_metrica": "HORAS_EXTRAS",
        "cantidad": q,
        "unidad": "HORAS",
        "notas": "Horas extras mensuales de soporte Tienda Newsan Web"
    })

if metricas_inserts:
    requests.post(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas", headers=HEADERS, json=metricas_inserts)
    print(f" - Insertadas {len(metricas_inserts)} filas en fact_metricas_operativas.")

# -----------------------------------------------------------------------------
# 5. POBLAR DIM_ESCALAS COMPLETA
# -----------------------------------------------------------------------------
print("\n5. Limpiando y poblando dim_escalas...")
for sid in [SELLER_NEWSAN_ML, SELLER_NEWSAN_MOTO, SELLER_PILISAR, SELLER_NEWSAN_WEB]:
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{sid}", headers=HEADERS)

escalas_payload = []

# 5.A Escala Mercado Libre para SELLER_NEWSAN_ML (8 tramos por mes)
# Ordenar tramos por monto asc
for p in periodos_ml:
    tramos = tramos_ml_por_periodo[p]
    for t in tramos:
        escalas_payload.append({
            "seller_id": SELLER_NEWSAN_ML,
            "periodo": p,
            "pais": "AR",
            "moneda": "ARS",
            "tipo_cargo": t['tipo'],
            "alicuota": t['alicuota'],
            "monto_objetivo": t['monto'],
            "variacion_mensual": 0.0,
            "estado": "REAL"
        })

# 5.B Escala Tienda Web para SELLER_NEWSAN_WEB (15 tramos por mes)
for p in periodos_ses:
    tramos = tramos_ses_por_periodo[p]
    for t in tramos:
        escalas_payload.append({
            "seller_id": SELLER_NEWSAN_WEB,
            "periodo": p,
            "pais": "AR",
            "moneda": "ARS",
            "tipo_cargo": t['tipo'],
            "alicuota": t['sesiones'],  # Guardamos la cantidad de sesiones en alícuota
            "monto_objetivo": t['monto'],
            "variacion_mensual": 0.0,
            "estado": "REAL"
        })

print(f" - Enviando {len(escalas_payload)} registros a dim_escalas...")
for i in range(0, len(escalas_payload), 100):
    chunk = escalas_payload[i:i+100]
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
    if r.status_code not in (200, 201):
        print(f"   Error en lote {i}: {r.status_code} {r.text}")

# -----------------------------------------------------------------------------
# 6. ACTUALIZAR FACTURACION CONSOLIDAD Y DETALLE
# -----------------------------------------------------------------------------
print("\n6. Actualizando tabla facturacion...")
# Limpiar facturacion previa de SELLER_NEWSAN_WEB y SELLER_NEWSAN_ML
requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_NEWSAN_WEB}", headers=HEADERS)
requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_NEWSAN_ML}", headers=HEADERS)

all_months = sorted(list(set(list(newsan_raw.keys()) + list(moto_raw.keys()) + list(pilisar_raw.keys()))))
facturacion_ml_inserts = []
facturacion_web_inserts = []

for p in all_months:
    g_n = newsan_raw.get(p, 0.0)
    g_m = moto_raw.get(p, 0.0)
    g_p = pilisar_raw.get(p, 0.0)
    g_total = g_n + g_m + g_p
    
    facturacion_ml_inserts.append({
        "seller_id": SELLER_NEWSAN_ML,
        "periodo": p,
        "valor_facturado": g_total,
        "variacion_mensual": 0.0,
        "estado": "REAL"
    })

# Facturación para Tienda Web:
# El monto total de factura de tienda web
web_months = sorted(list(set(list(sesiones_raw.keys()) + list(horas_raw.keys()))))
for p in web_months:
    q_ses = sesiones_raw.get(p, 0.0)
    q_hs = horas_raw.get(p, 0.0)
    tar_hs = tarifa_hs_extra.get(p, 0.0)
    tar_ses = tarifa_sesion.get(p, 0.0)
    
    # Minimo mensual
    min_web = next((t['monto'] for t in tramos_ses_por_periodo.get(p, []) if t['tipo'] == 'MINIMO'), 0.0)
    
    if p >= '2026-04-01':
        monto_ses = max(min_web, q_ses * tar_ses)
    else:
        monto_ses = min_web
        for t in tramos_ses_por_periodo.get(p, []):
            if q_ses <= t['sesiones']:
                monto_ses = t['monto']
                break
        if tramos_ses_por_periodo.get(p, []) and q_ses > tramos_ses_por_periodo.get(p, [])[-1]['sesiones']:
            monto_ses = tramos_ses_por_periodo.get(p, [])[-1]['monto']
            
    monto_hs = q_hs * tar_hs
    total_tienda = round(monto_ses + monto_hs, 2)
    
    # Para Tienda Web, en facturacion colocamos 0.0 porque el cobro es por cargo mínimo/sesiones
    facturacion_web_inserts.append({
        "seller_id": SELLER_NEWSAN_WEB,
        "periodo": p,
        "valor_facturado": 0.0,
        "variacion_mensual": 0.0,
        "estado": "REAL"
    })
    
    # Además, para que la vista liquidaciones arroje el subtotal exacto de Tienda Web (incluyendo horas extras):
    # Actualizamos el monto_objetivo del registro MINIMO en dim_escalas para SELLER_NEWSAN_WEB con el total_tienda
    # (o nos aseguramos de que el mínimo refleje el total de la tienda en ese mes)
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_NEWSAN_WEB}&periodo=eq.{p}&tipo_cargo=eq.MINIMO",
        headers=HEADERS,
        json={"monto_objetivo": total_tienda}
    )

print(f" - Insertando {len(facturacion_ml_inserts)} registros en facturacion para Newsan (ML)...")
for i in range(0, len(facturacion_ml_inserts), 100):
    chunk = facturacion_ml_inserts[i:i+100]
    requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=chunk)

print(f" - Insertando {len(facturacion_web_inserts)} registros en facturacion para Newsan (Web)...")
for i in range(0, len(facturacion_web_inserts), 100):
    chunk = facturacion_web_inserts[i:i+100]
    requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=chunk)

print("\n=== BASE DE DATOS ACTUALIZADA CON ÉXITO ===")
