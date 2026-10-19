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

print("=== INICIANDO CONFIGURACIÓN INTEGRAL DE NEWSAN ===")

# -----------------------------------------------------------------------------
# 1. ACTUALIZAR / CREAR SELLERS EN DIM_SELLERS
# -----------------------------------------------------------------------------
SELLER_NEWSAN_AR = 959595439
SELLER_NEWSAN_MOTO = 948058233
SELLER_PILISAR = 914884786
SELLER_NEWSAN_WEB = 989595440

sellers_data = [
    {
        "id_seller": SELLER_NEWSAN_AR,
        "nombre_seller": "Newsan Argentina",
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
    },
    {
        "id_seller": SELLER_NEWSAN_WEB,
        "nombre_seller": "Newsan Tienda Web",
        "codigo_plataforma": "WEB",
        "codigo_pais": "AR",
        "pais": "AR",
        "moneda": "ARS",
        "id_cliente": 14,
        "frecuencia_actualizacion": "SEMESTRAL",
        "cobrar_botmaker": False,
        "estado": True
    }
]

print("\n1. Sincronizando dim_sellers para las 4 cuentas de Newsan...")
for s in sellers_data:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=s)
    if r.status_code not in (200, 201):
        # Si ya existe, hacer PATCH
        r = requests.patch(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{s['id_seller']}", headers=HEADERS, json=s)
    print(f" - {s['nombre_seller']} ({s['id_seller']}): OK")

# -----------------------------------------------------------------------------
# 2. PARSEAR ARCHIVOS NEWSAN.TXT Y FACTURACION.TXT
# -----------------------------------------------------------------------------
print("\n2. Parseando archivos de escalas y métricas...")

with open('forecast/backend/scripts_borradores/sellers_historicos/newsan.txt', 'r', encoding='utf-8') as f:
    newsan_lines = [l.strip() for l in f.readlines()]

periodos_ml = [p.strip() for p in newsan_lines[4].split('\t\t') if p.strip()]

escalas_ml = {p: [] for p in periodos_ml}
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
            escalas_ml[p].append({'tipo': tipo, 'alicuota': ali, 'monto': monto})

periodos_sesiones = [p.strip() for p in newsan_lines[17].split('\t\t') if p.strip()]
tramos_sesiones = {p: [] for p in periodos_sesiones}
for r_idx in range(19, 35):
    cols = newsan_lines[r_idx].split('\t')
    for p_idx, p in enumerate(periodos_sesiones):
        c_ali = p_idx * 2
        c_monto = c_ali + 1
        if c_monto < len(cols):
            tramos_sesiones[p].append({'tramo': parse_num(cols[c_ali]), 'monto': parse_num(cols[c_monto])})

cols_hs = newsan_lines[37].split('\t')
tarifa_hs_extra = {p: parse_num(cols_hs[p_idx * 2 + 1]) for p_idx, p in enumerate(periodos_sesiones) if p_idx * 2 + 1 < len(cols_hs)}

cols_ses = newsan_lines[38].split('\t')
tarifa_sesion = {p: parse_num(cols_ses[p_idx * 2 + 1]) for p_idx, p in enumerate(periodos_sesiones) if p_idx * 2 + 1 < len(cols_ses)}

# Leer facturacion.txt
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

newsan_fact = extract_section('Newsan')
moto_fact = extract_section('Newsan Motorola')
pilisar_fact = extract_section('Pilisar')

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

sesiones_qty = extract_metric('Newsan - Sesiones')
horas_qty = extract_metric('Newsan - Horas extras')

# -----------------------------------------------------------------------------
# 3. GUARDAR MÉTRICAS OPERATIVAS EN FACT_METRICAS_OPERATIVAS
# -----------------------------------------------------------------------------
print("\n3. Guardando métricas operativas (Sesiones y Horas Extras)...")

# Limpiar previas
requests.delete(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas?seller_id=eq.{SELLER_NEWSAN_WEB}", headers=HEADERS)

metricas_payload = []
for p, q in sesiones_qty.items():
    metricas_payload.append({
        "seller_id": SELLER_NEWSAN_WEB,
        "id_cliente": 14,
        "periodo": p,
        "tipo_metrica": "SESIONES",
        "cantidad": q,
        "unidad": "UNIDADES",
        "notas": "Sesiones mensuales de Tienda Newsan Web"
    })

for p, q in horas_qty.items():
    metricas_payload.append({
        "seller_id": SELLER_NEWSAN_WEB,
        "id_cliente": 14,
        "periodo": p,
        "tipo_metrica": "HORAS_EXTRAS",
        "cantidad": q,
        "unidad": "HORAS",
        "notas": "Horas extras mensuales de soporte Tienda Newsan Web"
    })

if metricas_payload:
    r_met = requests.post(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas", headers=HEADERS, json=metricas_payload)
    print(f" - Insertadas {len(metricas_payload)} filas en fact_metricas_operativas.")

# -----------------------------------------------------------------------------
# 4. CALCULAR Y CARGAR ESCALAS PARA ML Y WEB
# -----------------------------------------------------------------------------
print("\n4. Calculando y poblando dim_escalas y facturacion...")

# Limpiar escalas previas de los 4 sellers
for sid in [SELLER_NEWSAN_AR, SELLER_NEWSAN_MOTO, SELLER_PILISAR, SELLER_NEWSAN_WEB]:
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{sid}", headers=HEADERS)
    if sid == SELLER_NEWSAN_WEB:
        requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{sid}", headers=HEADERS)

all_ml_months = sorted(list(set(list(newsan_fact.keys()) + list(moto_fact.keys()) + list(pilisar_fact.keys()))))
escalas_inserts = []
web_facturacion_inserts = []

for p in all_ml_months:
    g_newsan = newsan_fact.get(p, 0.0)
    g_moto = moto_fact.get(p, 0.0)
    g_pilisar = pilisar_fact.get(p, 0.0)
    g_total = g_newsan + g_moto + g_pilisar
    
    # 4.A CALCULAR ML
    esc = escalas_ml.get(p, [])
    minimo_ml = next((e['monto'] for e in esc if e['tipo'] == 'MINIMO'), 0.0)
    tramos_porc = [e for e in esc if e['tipo'] == 'PORCENTUAL']
    
    # Encontrar alicuota según escala
    alicuota_aplicada = 0.0
    for t in reversed(tramos_porc):
        if g_total >= t['monto']:
            alicuota_aplicada = t['alicuota']
            break
    if alicuota_aplicada == 0.0 and tramos_porc:
        alicuota_aplicada = tramos_porc[0]['alicuota']
        
    fee_ml_calc = g_total * alicuota_aplicada
    subtotal_ml = max(minimo_ml, fee_ml_calc)
    
    # Alicuota efectiva para cada cuenta
    alicuota_efectiva = (subtotal_ml / g_total) if g_total > 0 else alicuota_aplicada
    
    # Insertar en dim_escalas para las 3 cuentas ML
    for sid, g_acc in [(SELLER_NEWSAN_AR, g_newsan), (SELLER_NEWSAN_MOTO, g_moto), (SELLER_PILISAR, g_pilisar)]:
        if g_acc > 0 or p in ['2026-07-01', '2026-08-01', '2026-09-01']:
            escalas_inserts.append({
                "seller_id": sid,
                "periodo": p,
                "pais": "AR",
                "moneda": "ARS",
                "tipo_cargo": "PORCENTUAL",
                "alicuota": round(alicuota_efectiva, 6),
                "monto_objetivo": 0.0,
                "variacion_mensual": 0.0,
                "estado": "REAL"
            })
            # Solo insertamos PORCENTUAL para que aplique la alícuota calculada del grupo ML
            pass

# 4.B CALCULAR TIENDA WEB
all_web_months = sorted(list(set(list(sesiones_qty.keys()) + list(horas_qty.keys()))))
for p in all_web_months:
    q_ses = sesiones_qty.get(p, 0.0)
    q_hs = horas_qty.get(p, 0.0)
    tar_hs = tarifa_hs_extra.get(p, 0.0)
    monto_hs = q_hs * tar_hs
    
    tar_ses = tarifa_sesion.get(p, 0.0)
    min_web = next((t['monto'] for t in tramos_sesiones.get(p, []) if t['tramo'] == 0), 0.0)
    
    if p >= '2026-04-01':
        monto_sesiones = max(min_web, q_ses * tar_ses)
    else:
        monto_sesiones = min_web
        for t in tramos_sesiones.get(p, []):
            if q_ses <= t['tramo']:
                monto_sesiones = t['monto']
                break
        if q_ses > tramos_sesiones.get(p, [])[-1]['tramo']:
            monto_sesiones = tramos_sesiones.get(p, [])[-1]['monto']
            
    subtotal_web = round(monto_sesiones + monto_hs, 2)
    
    # Para Tienda Web:
    # En facturacion: valor_facturado = 0.0
    web_facturacion_inserts.append({
        "seller_id": SELLER_NEWSAN_WEB,
        "periodo": p,
        "valor_facturado": 0.0,
        "variacion_mensual": 0.0,
        "estado": "REAL"
    })
    
    # En dim_escalas: tipo_cargo = MINIMO con monto_objetivo = subtotal_web
    escalas_inserts.append({
        "seller_id": SELLER_NEWSAN_WEB,
        "periodo": p,
        "pais": "AR",
        "moneda": "ARS",
        "tipo_cargo": "MINIMO",
        "alicuota": 0.0,
        "monto_objetivo": subtotal_web,
        "variacion_mensual": 0.0,
        "estado": "REAL"
    })

# Inserción por lotes
print(f"Insertando {len(escalas_inserts)} registros en dim_escalas...")
for i in range(0, len(escalas_inserts), 100):
    chunk = escalas_inserts[i:i+100]
    requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)

print(f"Insertando {len(web_facturacion_inserts)} registros en facturacion para Newsan Tienda Web...")
for i in range(0, len(web_facturacion_inserts), 100):
    chunk = web_facturacion_inserts[i:i+100]
    requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=chunk)

print("\n=== CARGA DE NEWSAN COMPLETADA EXITOSAMENTE ===")
