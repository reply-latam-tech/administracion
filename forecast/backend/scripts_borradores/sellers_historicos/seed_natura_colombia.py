"""
Script para sembrar y sincronizar Natura Colombia en Supabase:
- Actualiza dim_sellers (id_seller 941943480, pais='CO', moneda='COP', cobrar_botmaker=False)
- Inserta / actualiza facturacion completa corregida (12/2025 a 09/2026)
- Inserta las escalas oficiales fijas en USD en dim_escalas (2026-02 a 2026-09)
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

SELLER_ID = 941943480
SELLER_NAME = "Natura Colombia"

def update_seller():
    print(f"1. Actualizando seller {SELLER_NAME} ({SELLER_ID})...")
    payload = {
        "id_seller": SELLER_ID,
        "nombre_seller": SELLER_NAME,
        "pais": "CO",
        "codigo_pais": "CO",
        "moneda": "COP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "codigo_plataforma": "MELI",
        "id_cliente": 20
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=[payload])
    print(f"  dim_sellers status: {r.status_code}")

def seed_facturacion():
    print(f"2. Insertando facturación corregida para {SELLER_NAME}...")
    fact_raw = [
        ("2025-12-01", 158695534.0),
        ("2026-01-01", 128584662.0),
        ("2026-02-01", 95797771.0),
        ("2026-03-01", 152080379.0),
        ("2026-04-01", 148478788.0),
        ("2026-05-01", 176212697.0),
        ("2026-06-01", 171340589.0),
        ("2026-07-01", 217037158.0),
        ("2026-08-01", 226062619.0),
        ("2026-09-01", 306362411.0),
    ]

    fact_data = []
    for i, (periodo, valor) in enumerate(fact_raw):
        variacion = 0.0
        if i > 0 and fact_raw[i-1][1] > 0:
            variacion = (valor - fact_raw[i-1][1]) / fact_raw[i-1][1]
        fact_data.append({
            "seller_id": SELLER_ID,
            "periodo": periodo,
            "valor_facturado": valor,
            "variacion_mensual": round(variacion, 4),
            "estado": "REAL"
        })

    for f in fact_data:
        check = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&periodo=eq.{f['periodo']}", headers=HEADERS).json()
        if check:
            fid = check[0]["id"]
            rf = requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=HEADERS, json=f)
            print(f"  Actualizado {f['periodo']}: {f['valor_facturado']:,.0f} COP (status {rf.status_code})")
        else:
            rf = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=[f])
            print(f"  Insertado {f['periodo']}: {f['valor_facturado']:,.0f} COP (status {rf.status_code})")

def seed_escalas():
    print(f"3. Insertando escalas en USD para {SELLER_NAME}...")
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_ID}", headers=HEADERS)

    meses = [
        "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01",
        "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"
    ]
    tiers = [
        ("MINIMO", 0.0, 1200.0),
        ("PORCENTUAL", 0.0293, 35000.0),
        ("PORCENTUAL", 0.0276, 45000.0),
        ("PORCENTUAL", 0.0244, 70000.0),
        ("PORCENTUAL", 0.0228, 90000.0),
        ("PORCENTUAL", 0.0195, 125000.0),
        ("PORCENTUAL", 0.0163, 170000.0),
        ("PORCENTUAL", 0.0130, 230000.0)
    ]

    escalas_payload = []
    for m in meses:
        for tipo, alicuota, monto in tiers:
            escalas_payload.append({
                "seller_id": SELLER_ID,
                "periodo": m,
                "pais": "CO",
                "tipo_cargo": tipo,
                "alicuota": alicuota,
                "monto_objetivo": monto,
                "moneda": "USD",
                "variacion_mensual": 0.0,
                "estado": "REAL"
            })

    for chunk_start in range(0, len(escalas_payload), 50):
        chunk = escalas_payload[chunk_start:chunk_start+50]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
        print(f"  Lote de {len(chunk)} escalas insertado (status {r.status_code})")

def main():
    print("=== SINCRONIZANDO NATURA COLOMBIA (FACTURACIÓN CORREGIDA) ===")
    update_seller()
    seed_facturacion()
    seed_escalas()
    print("=== PROCESO COMPLETADO EXITOSAMENTE ===")

if __name__ == "__main__":
    main()
