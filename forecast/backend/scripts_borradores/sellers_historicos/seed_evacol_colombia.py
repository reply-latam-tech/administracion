"""
Script para sincronizar y sembrar Evacol Colombia ML en Supabase:
- Actualiza dim_sellers (id_seller 928666257, nombre_seller='Evacol Colombia ML', pais='CO', codigo_pais='CO', moneda='COP', cobrar_botmaker=False, frecuencia='FIJA')
- Inyecta las proyecciones a 12 meses en facturacion (2026-10 a 2027-09 con estado='PROYECTADO')
- Inyecta la escala oficial en USD en dim_escalas para todos los periodos (2026-02 a 2027-09)
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

SELLER_ID = 928666257
SELLER_NAME = "Evacol Colombia ML"

PROYECCIONES_EVACOL = [
    ("2026-10-01", 69161424.0),
    ("2026-11-01", 92658120.0),
    ("2026-12-01", 107674340.0),
    ("2027-01-01", 56230150.0),
    ("2027-02-01", 74693810.0),
    ("2027-03-01", 71996530.0),
    ("2027-04-01", 69218420.0),
    ("2027-05-01", 92179350.0),
    ("2027-06-01", 85819120.0),
    ("2027-07-01", 90628740.0),
    ("2027-08-01", 80243680.0),
    ("2027-09-01", 85086320.0),
]

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
        "id_cliente": 19
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=[payload])
    print(f"  dim_sellers status: {r.status_code}")

def seed_projected_facturacion():
    print(f"\n2. Inyectando 12 meses proyectados en facturacion para {SELLER_NAME}...")
    
    last_real = 69884519.0
    prev_val = last_real

    for periodo, valor in PROYECCIONES_EVACOL:
        variacion = round((valor - prev_val) / prev_val, 4) if prev_val > 0 else 0.0
        payload = {
            "seller_id": SELLER_ID,
            "periodo": periodo,
            "valor_facturado": valor,
            "variacion_mensual": variacion,
            "estado": "PROYECTADO"
        }
        
        check = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&periodo=eq.{periodo}", headers=HEADERS).json()
        if check:
            fid = check[0]["id"]
            rf = requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=HEADERS, json=payload)
            print(f"  Actualizado {periodo}: {valor:,.0f} COP (status {rf.status_code})")
        else:
            rf = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=[payload])
            print(f"  Insertado {periodo}: {valor:,.0f} COP (status {rf.status_code})")
        prev_val = valor

def seed_escalas():
    print(f"\n3. Inyectando escala oficial en USD en dim_escalas para {SELLER_NAME}...")
    # Limpiar escalas previas de este seller
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_ID}", headers=HEADERS)

    # Obtener todos los periodos de facturación (reales y proyectados)
    fact_rows = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&order=periodo.asc", headers=HEADERS).json()
    periodos = [(f["periodo"], f["estado"]) for f in fact_rows]
    print(f"  Se generarán escalas para {len(periodos)} periodos.")

    # Escala oficial en USD:
    # 0       1.000,00  (Mínimo garantizado)
    # 4,00%  50.000,00
    # 3,50%  60.000,00
    # 3,00%  80.000,00
    # 2,50% 110.000,00
    # 2,00% 150.000,00
    tiers_usd = [
        ("MINIMO", 0.0, 1000.0),
        ("PORCENTUAL", 0.040, 50000.0),
        ("PORCENTUAL", 0.035, 60000.0),
        ("PORCENTUAL", 0.030, 80000.0),
        ("PORCENTUAL", 0.025, 110000.0),
        ("PORCENTUAL", 0.020, 150000.0)
    ]

    escalas_payload = []
    for p_str, estado in periodos:
        for tipo, alicuota, monto in tiers_usd:
            escalas_payload.append({
                "seller_id": SELLER_ID,
                "periodo": p_str,
                "pais": "CO",
                "tipo_cargo": tipo,
                "alicuota": alicuota,
                "monto_objetivo": monto,
                "moneda": "USD",
                "variacion_mensual": 0.0,
                "estado": estado
            })

    # Insertar en lotes de 50
    for chunk_start in range(0, len(escalas_payload), 50):
        chunk = escalas_payload[chunk_start:chunk_start+50]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
        print(f"  Lote de {len(chunk)} escalas insertado (status {r.status_code})")

def main():
    print("================================================================================")
    print(" CONFIGURACIÓN Y SIEMBRA DE EVACOL COLOMBIA ML (SELLER ID 928666257)")
    print("================================================================================")
    update_seller()
    seed_projected_facturacion()
    seed_escalas()
    print("\n¡Proceso finalizado con éxito!")

if __name__ == "__main__":
    main()
