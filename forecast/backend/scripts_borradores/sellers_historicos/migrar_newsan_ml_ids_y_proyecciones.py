import os
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

print("=== MIGRACIÓN DE NEWSAN A SELLER_IDS OFICIALES DE ML Y PROYECCIONES ===")

# IDs Oficiales de Mercado Libre según el usuario:
ID_OFICIAL_NEWSAN = 256189964      # Newsan ML
ID_OFICIAL_MOTO = 308973138        # Newsan Motorola
ID_OFICIAL_PILISAR = 256324891      # Pilisar
ID_NEWSAN_WEB = 989595440          # Newsan Tienda Web

# IDs Antiguos / placeholders a migrar
ID_VIEJO_NEWSAN = 959595439
ID_VIEJO_MOTO = 948058233
ID_VIEJO_PILISAR = 914884786

# -----------------------------------------------------------------------------
# 1. ACTUALIZAR / CREAR SELLERS OFICIALES EN DIM_SELLERS
# -----------------------------------------------------------------------------
print("\n1. Registrando sellers con IDs oficiales de ML en dim_sellers...")
sellers_oficiales = [
    {
        "id_seller": ID_OFICIAL_NEWSAN,
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
        "id_seller": ID_OFICIAL_MOTO,
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
        "id_seller": ID_OFICIAL_PILISAR,
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
        "id_seller": ID_NEWSAN_WEB,
        "nombre_seller": "Newsan (Tienda Web)",
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

for s in sellers_oficiales:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=s)
    if r.status_code not in (200, 201):
        requests.patch(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{s['id_seller']}", headers=HEADERS, json=s)
    print(f" - {s['nombre_seller']} ({s['id_seller']}): OK")

# -----------------------------------------------------------------------------
# 2. MIGRAR REGISTROS DE FACTURACION Y DIM_ESCALAS A LOS NUEVOS IDS
# -----------------------------------------------------------------------------
print("\n2. Migrando dim_escalas y facturacion hacia los IDs oficiales de ML...")

# 2.A Migrar dim_escalas de 959595439 -> 256189964
r_esc = requests.get(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{ID_VIEJO_NEWSAN}&limit=2000", headers=HEADERS)
old_escalas = r_esc.json()
if old_escalas:
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{ID_OFICIAL_NEWSAN}", headers=HEADERS)
    new_esc_payload = []
    for row in old_escalas:
        new_row = dict(row)
        new_row.pop('id', None)
        new_row['seller_id'] = ID_OFICIAL_NEWSAN
        new_esc_payload.append(new_row)
    
    for i in range(0, len(new_esc_payload), 100):
        requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=new_esc_payload[i:i+100])
    print(f" - Migrados {len(new_esc_payload)} registros de dim_escalas a {ID_OFICIAL_NEWSAN}.")

# 2.B Migrar facturacion de los 3 sellers ML
for viejo_id, nuevo_id in [(ID_VIEJO_NEWSAN, ID_OFICIAL_NEWSAN), (ID_VIEJO_MOTO, ID_OFICIAL_MOTO), (ID_VIEJO_PILISAR, ID_OFICIAL_PILISAR)]:
    r_fact = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{viejo_id}&limit=2000", headers=HEADERS)
    old_facts = r_fact.json()
    if old_facts:
        requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{nuevo_id}", headers=HEADERS)
        new_fact_payload = []
        for row in old_facts:
            new_row = dict(row)
            new_row.pop('id', None)
            new_row['seller_id'] = nuevo_id
            new_fact_payload.append(new_row)
        for i in range(0, len(new_fact_payload), 100):
            requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=new_fact_payload[i:i+100])
        print(f" - Migrados {len(new_fact_payload)} registros de facturacion de {viejo_id} a {nuevo_id}.")

# Limpiar antiguos sellers placeholders de facturacion, dim_escalas y dim_sellers
print("\n3. Eliminando sellers placeholders antiguos...")
for viejo_id in [ID_VIEJO_NEWSAN, ID_VIEJO_MOTO, ID_VIEJO_PILISAR]:
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{viejo_id}", headers=HEADERS)
    requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{viejo_id}", headers=HEADERS)
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{viejo_id}", headers=HEADERS)
print(" - Antiguos placeholders eliminados con éxito.")

# -----------------------------------------------------------------------------
# 3. PROYECCIONES FUTURAS DE ESCALAS (OCT 2026 - MAR 2027)
# -----------------------------------------------------------------------------
print("\n4. Generando proyecciones futuras de escalas...")

# Obtener inflación para calcular factores acumulados
r_inf = requests.get(f"{SUPABASE_URL}/rest/v1/inflacion?periodo=gte.2026-07-01&order=periodo.asc", headers=HEADERS)
inf_data = {row['periodo']: row['valor_inflacion'] for row in r_inf.json()}

# Inflación de Q3 2026 (Jul + Ago + Sep)
inf_jul = inf_data.get('2026-07-01', 0.021)
inf_ago = inf_data.get('2026-08-01', 0.017)
inf_sep = inf_data.get('2026-09-01', 0.019)
factor_q3 = (1.0 + inf_jul) * (1.0 + inf_ago) * (1.0 + inf_sep)
print(f" - Inflación Q3 2026 acumulada: {(factor_q3 - 1.0) * 100:.2f}% (Factor: {factor_q3:.6f})")

# Inflación de Q4 2026 (Oct + Nov + Dic)
inf_oct = inf_data.get('2026-10-01', 0.017)
inf_nov = inf_data.get('2026-11-01', 0.016)
inf_dic = inf_data.get('2026-12-01', 0.018)
factor_q4 = (1.0 + inf_oct) * (1.0 + inf_nov) * (1.0 + inf_dic)
print(f" - Inflación Q4 2026 acumulada: {(factor_q4 - 1.0) * 100:.2f}% (Factor: {factor_q4:.6f})")

# Obtener escala base de Sep 2026 para Newsan ML
r_sep_ml = requests.get(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{ID_OFICIAL_NEWSAN}&periodo=eq.2026-09-01", headers=HEADERS)
sep_ml_tramos = r_sep_ml.json()

# Obtener escala base de Sep 2026 para Newsan Tienda Web
r_sep_web = requests.get(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{ID_NEWSAN_WEB}&periodo=eq.2026-09-01", headers=HEADERS)
sep_web_tramos = r_sep_web.json()

# Limpiar proyecciones previas de ambos sellers
requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=in.({ID_OFICIAL_NEWSAN},{ID_NEWSAN_WEB})&periodo=gte.2026-10-01", headers=HEADERS)

proyecciones_payload = []

# --- 4.A NEWSAN ML: TRIMESTRAL ---
# Q4 2026: Octubre (se ajusta por factor_q3), Noviembre y Diciembre (congelados a Octubre)
tramos_q4_2026 = []
for t in sep_ml_tramos:
    monto_q4 = round(t['monto_objetivo'] * factor_q3, 2)
    tramos_q4_2026.append({
        'tipo_cargo': t['tipo_cargo'],
        'alicuota': t['alicuota'],
        'monto_objetivo': monto_q4
    })

for mes in ['2026-10-01', '2026-11-01', '2026-12-01']:
    var_mensual = round(factor_q3 - 1.0, 4) if mes == '2026-10-01' else 0.0
    for t in tramos_q4_2026:
        proyecciones_payload.append({
            "seller_id": ID_OFICIAL_NEWSAN,
            "periodo": mes,
            "pais": "AR",
            "moneda": "ARS",
            "tipo_cargo": t['tipo_cargo'],
            "alicuota": t['alicuota'],
            "monto_objetivo": t['monto_objetivo'],
            "variacion_mensual": var_mensual,
            "estado": "PROYECTADO"
        })

# Q1 2027: Enero (se ajusta por factor_q4), Febrero y Marzo (congelados a Enero)
tramos_q1_2027 = []
for t in tramos_q4_2026:
    monto_q1 = round(t['monto_objetivo'] * factor_q4, 2)
    tramos_q1_2027.append({
        'tipo_cargo': t['tipo_cargo'],
        'alicuota': t['alicuota'],
        'monto_objetivo': monto_q1
    })

for mes in ['2027-01-01', '2027-02-01', '2027-03-01']:
    var_mensual = round(factor_q4 - 1.0, 4) if mes == '2027-01-01' else 0.0
    for t in tramos_q1_2027:
        proyecciones_payload.append({
            "seller_id": ID_OFICIAL_NEWSAN,
            "periodo": mes,
            "pais": "AR",
            "moneda": "ARS",
            "tipo_cargo": t['tipo_cargo'],
            "alicuota": t['alicuota'],
            "monto_objetivo": t['monto_objetivo'],
            "variacion_mensual": var_mensual,
            "estado": "PROYECTADO"
        })

print(" - Generadas proyecciones trimestrales para Newsan ML (Oct 26 - Mar 27).")

# --- 4.B NEWSAN TIENDA WEB: SEMESTRAL (Abril y Septiembre) ---
# Como se actualizó en Septiembre 2026 y la próxima es en Abril 2027:
# Para Oct 2026 a Mar 2027 (6 meses), la escala permanece congelada exactamente idéntica a Septiembre 2026
for mes in ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01']:
    for t in sep_web_tramos:
        proyecciones_payload.append({
            "seller_id": ID_NEWSAN_WEB,
            "periodo": mes,
            "pais": "AR",
            "moneda": "ARS",
            "tipo_cargo": t['tipo_cargo'],
            "alicuota": t['alicuota'],
            "monto_objetivo": t['monto_objetivo'],
            "variacion_mensual": 0.0,
            "estado": "PROYECTADO"
        })

print(" - Generadas proyecciones semestrales para Newsan Tienda Web (Oct 26 - Mar 27, congeladas hasta Abr 27).")

# Insertar todas las proyecciones en dim_escalas
print(f" - Insertando {len(proyecciones_payload)} registros proyectados en dim_escalas...")
for i in range(0, len(proyecciones_payload), 100):
    chunk = proyecciones_payload[i:i+100]
    requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)

print("\n=== MIGRACIÓN Y PROYECCIONES COMPLETADAS EXITOSAMENTE ===")
