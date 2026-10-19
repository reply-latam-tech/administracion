"""
Script para sincronizar y sembrar Formex Colombia (seller_id real: 127711636) en Supabase:
1. Registra id_seller 127711636 en dim_sellers (Formex Colombia, CO, COP, cobro USD, fija, no botmaker, id_cliente: 23).
2. Limpia el seller dummy anterior (969294346) si existe.
3. Ingesta los 5 meses históricos reales (2026-05 a 2026-09) en facturacion para 127711636.
4. Genera e ingesta 12 meses proyectados (2026-10 a 2027-09) con estacionalidad retail Colombia.
5. Ingesta los 8 tiers oficiales en USD en dim_escalas para todos los periodos (17 meses).
"""

import os
import sys
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

SELLER_ID_REAL = 127711636
SELLER_ID_DUMMY = 969294346
SELLER_NAME = "Formex Colombia"

# 5 meses reales en COP según formex.txt
HISTORICO_REAL = [
    ("2026-05-01", 29577205.0),
    ("2026-06-01", 45556212.0),
    ("2026-07-01", 58066865.0),
    ("2026-08-01", 97249068.0),
    ("2026-09-01", 48604023.0),
]

# 12 meses proyectados aplicando estacionalidad minorista Colombia + crecimiento orgánico
PROYECCIONES_FORMEX = [
    ("2026-10-01", 51200000.0),
    ("2026-11-01", 68500000.0),
    ("2026-12-01", 81800000.0),
    ("2027-01-01", 42500000.0),
    ("2027-02-01", 46200000.0),
    ("2027-03-01", 55800000.0),
    ("2027-04-01", 58100000.0),
    ("2027-05-01", 75200000.0),
    ("2027-06-01", 61800000.0),
    ("2027-07-01", 64200000.0),
    ("2027-08-01", 66700000.0),
    ("2027-09-01", 75500000.0),
]

def update_seller():
    print(f"1. Registrando seller real {SELLER_NAME} ({SELLER_ID_REAL}) en dim_sellers...")
    payload = {
        "id_seller": SELLER_ID_REAL,
        "nombre_seller": SELLER_NAME,
        "pais": "CO",
        "codigo_pais": "CO",
        "moneda": "COP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "codigo_plataforma": "MELI",
        "id_cliente": 23
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=[payload])
    print(f"  dim_sellers status: {r.status_code}")

    # Limpiar dummy si existe
    print(f"  Limpiando seller dummy {SELLER_ID_DUMMY} si existe...")
    requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID_DUMMY}", headers=HEADERS)
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_ID_DUMMY}", headers=HEADERS)
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{SELLER_ID_DUMMY}", headers=HEADERS)

def seed_facturacion():
    print(f"\n2. Inyectando histórico real y proyecciones en facturacion para {SELLER_ID_REAL}...")
    
    # Histórico real
    prev_val = 0.0
    for p_str, val in HISTORICO_REAL:
        var = round((val - prev_val) / prev_val, 4) if prev_val > 0 else 0.0
        payload = {
            "seller_id": SELLER_ID_REAL,
            "periodo": p_str,
            "valor_facturado": val,
            "variacion_mensual": var,
            "estado": "REAL"
        }
        check = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID_REAL}&periodo=eq.{p_str}", headers=HEADERS).json()
        if check:
            fid = check[0]["id"]
            rf = requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=HEADERS, json=payload)
            print(f"  [REAL] Actualizado {p_str}: {val:,.2f} COP (status {rf.status_code})")
        else:
            rf = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=[payload])
            print(f"  [REAL] Insertado {p_str}: {val:,.2f} COP (status {rf.status_code})")
        prev_val = val

    # Proyecciones
    for p_str, val in PROYECCIONES_FORMEX:
        var = round((val - prev_val) / prev_val, 4) if prev_val > 0 else 0.0
        payload = {
            "seller_id": SELLER_ID_REAL,
            "periodo": p_str,
            "valor_facturado": val,
            "variacion_mensual": var,
            "estado": "PROYECTADO"
        }
        check = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID_REAL}&periodo=eq.{p_str}", headers=HEADERS).json()
        if check:
            fid = check[0]["id"]
            rf = requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=HEADERS, json=payload)
            print(f"  [PROY] Actualizado {p_str}: {val:,.2f} COP (status {rf.status_code})")
        else:
            rf = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=[payload])
            print(f"  [PROY] Insertado {p_str}: {val:,.2f} COP (status {rf.status_code})")
        prev_val = val

def seed_escalas():
    print(f"\n3. Inyectando escala oficial en USD en dim_escalas para Formex ({SELLER_ID_REAL})...")
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_ID_REAL}", headers=HEADERS)

    fact_rows = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID_REAL}&order=periodo.asc", headers=HEADERS).json()
    periodos = [(f["periodo"], f["estado"]) for f in fact_rows]
    print(f"  Se generarán escalas para {len(periodos)} periodos.")

    # Escala en USD de Formex:
    # 0       1.000,00  (Mínimo garantizado)
    # 2,93%  35.000,00
    # 2,76%  45.000,00
    # 2,44%  70.000,00
    # 2,28%  90.000,00
    # 1,95% 125.000,00
    # 1,63% 170.000,00
    # 1,30% 230.000,00
    tiers_usd = [
        ("MINIMO", 0.0, 1000.0),
        ("PORCENTUAL", 0.0293, 35000.0),
        ("PORCENTUAL", 0.0276, 45000.0),
        ("PORCENTUAL", 0.0244, 70000.0),
        ("PORCENTUAL", 0.0228, 90000.0),
        ("PORCENTUAL", 0.0195, 125000.0),
        ("PORCENTUAL", 0.0163, 170000.0),
        ("PORCENTUAL", 0.0130, 230000.0)
    ]

    escalas_payload = []
    for p_str, estado in periodos:
        for tipo, alicuota, monto in tiers_usd:
            escalas_payload.append({
                "seller_id": SELLER_ID_REAL,
                "periodo": p_str,
                "pais": "CO",
                "tipo_cargo": tipo,
                "alicuota": alicuota,
                "monto_objetivo": monto,
                "moneda": "USD",
                "variacion_mensual": 0.0,
                "estado": estado
            })

    for chunk_start in range(0, len(escalas_payload), 50):
        chunk = escalas_payload[chunk_start:chunk_start+50]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
        print(f"  Lote de {len(chunk)} escalas insertado (status {r.status_code})")

def main():
    print("================================================================================")
    print(" CONFIGURACIÓN Y SIEMBRA DE FORMEX COLOMBIA (SELLER ID REAL: 127711636)")
    print("================================================================================")
    update_seller()
    seed_facturacion()
    seed_escalas()
    print("\n¡Sembrado de Formex completado con éxito!")

if __name__ == "__main__":
    main()
