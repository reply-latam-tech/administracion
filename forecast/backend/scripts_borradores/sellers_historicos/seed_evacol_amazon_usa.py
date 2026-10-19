"""
Script para sincronizar y sembrar Evacol Amazon USA (id_seller: 918210724) en Supabase:
1. Actualiza dim_sellers (id_seller 918210724, Evacol Amazon USA, US, USD, AMAZON, id_cliente: 19).
2. Asegura el histórico real en facturacion (2026-09-01: 4.459,24 USD).
3. Inyecta 12 meses proyectados en facturacion (2026-10 a 2027-09 con estado='PROYECTADO').
4. Inyecta los 8 tiers oficiales en USD en dim_escalas para todos los periodos.
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

SELLER_ID = 918210724
SELLER_NAME = "Evacol Amazon USA"

# 12 meses proyectados para Amazon USA en USD
# Estacionalidad retail US: Q4 fuerte (Nov/Dic), bajon en Ene/Feb, Prime Day en Julio
PROYECCIONES_USA = [
    ("2026-10-01", 5200.0),
    ("2026-11-01", 7500.0), # Black Friday / Cyber Monday
    ("2026-12-01", 8800.0), # Christmas / Holiday shopping
    ("2027-01-01", 4200.0), # Post-holiday slowdown
    ("2027-02-01", 4500.0),
    ("2027-03-01", 5000.0), # Spring
    ("2027-04-01", 5200.0),
    ("2027-05-01", 5600.0),
    ("2027-06-01", 5800.0),
    ("2027-07-01", 7200.0), # Amazon Prime Day
    ("2027-08-01", 6100.0), # Back to School
    ("2027-09-01", 5500.0),
]

def update_seller():
    print(f"1. Actualizando seller {SELLER_NAME} ({SELLER_ID}) en dim_sellers...")
    payload = {
        "id_seller": SELLER_ID,
        "nombre_seller": SELLER_NAME,
        "pais": "US",
        "codigo_pais": "US",
        "moneda": "USD",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "codigo_plataforma": "AMAZON",
        "id_cliente": 19
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=[payload])
    print(f"  dim_sellers status: {r.status_code}")

def seed_facturacion():
    print(f"\n2. Asegurando histórico real e inyectando proyecciones para {SELLER_NAME}...")
    
    # Histórico real Sep 2026
    real_payload = {
        "seller_id": SELLER_ID,
        "periodo": "2026-09-01",
        "valor_facturado": 4459.24,
        "variacion_mensual": 0.0,
        "estado": "REAL"
    }
    check = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&periodo=eq.2026-09-01", headers=HEADERS).json()
    if check:
        fid = check[0]["id"]
        requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=HEADERS, json=real_payload)
        print(f"  [REAL] Actualizado 2026-09-01: $ 4,459.24 USD")
    else:
        requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=[real_payload])
        print(f"  [REAL] Insertado 2026-09-01: $ 4,459.24 USD")

    # Proyecciones
    prev_val = 4459.24
    for periodo, valor in PROYECCIONES_USA:
        variacion = round((valor - prev_val) / prev_val, 4) if prev_val > 0 else 0.0
        payload = {
            "seller_id": SELLER_ID,
            "periodo": periodo,
            "valor_facturado": valor,
            "variacion_mensual": variacion,
            "estado": "PROYECTADO"
        }
        check_p = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&periodo=eq.{periodo}", headers=HEADERS).json()
        if check_p:
            fid = check_p[0]["id"]
            rf = requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=HEADERS, json=payload)
            print(f"  [PROY] Actualizado {periodo}: $ {valor:,.2f} USD (status {rf.status_code})")
        else:
            rf = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=[payload])
            print(f"  [PROY] Insertado {periodo}: $ {valor:,.2f} USD (status {rf.status_code})")
        prev_val = valor

def seed_escalas():
    print(f"\n3. Inyectando escala oficial en USD en dim_escalas para {SELLER_NAME}...")
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_ID}", headers=HEADERS)

    fact_rows = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&order=periodo.asc", headers=HEADERS).json()
    periodos = [(f["periodo"], f["estado"]) for f in fact_rows]
    print(f"  Se generarán escalas para {len(periodos)} periodos.")

    # Escala en USD de Evacol Amazon USA:
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
                "seller_id": SELLER_ID,
                "periodo": p_str,
                "pais": "US",
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
    print(" CONFIGURACIÓN Y SIEMBRA DE EVACOL AMAZON USA (ID SELLER: 918210724)")
    print("================================================================================")
    update_seller()
    seed_facturacion()
    seed_escalas()
    print("\n¡Sembrado de Evacol Amazon USA finalizado con éxito!")

if __name__ == "__main__":
    main()
