"""
Script para sincronizar y sembrar Disuiza Colombia en Supabase:
- Actualiza dim_sellers (id_seller 964690754, pais='CO', codigo_pais='CO', moneda='COP', cobrar_botmaker=False, frecuencia='FIJA')
- Inyecta las proyecciones a 12 meses en facturacion (2026-10 a 2027-09 con estado='PROYECTADO')
- Inyecta la escala en USD en dim_escalas para todos los periodos (2024-04 a 2027-09)
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

SELLER_ID = 964690754
SELLER_NAME = "Disuiza Colombia"

PROYECCIONES_DISUIZA = [
    ("2026-10-01", 181869243.0),
    ("2026-11-01", 170211937.0),
    ("2026-12-01", 173650447.0),
    ("2027-01-01", 87168722.0),
    ("2027-02-01", 79333475.0),
    ("2027-03-01", 214885065.0),
    ("2027-04-01", 97147847.0),
    ("2027-05-01", 160790920.0),
    ("2027-06-01", 133089211.0),
    ("2027-07-01", 151181455.0),
    ("2027-08-01", 112288137.0),
    ("2027-09-01", 131978200.0),
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
        "id_cliente": 22
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_sellers", headers=HEADERS, json=[payload])
    print(f"  dim_sellers status: {r.status_code}")

def seed_projected_facturacion():
    print(f"\n2. Inyectando 12 meses proyectados en facturacion para {SELLER_NAME}...")
    
    # Obtener el último valor real para variación mensual
    last_real = 117603343.0
    prev_val = last_real

    for periodo, valor in PROYECCIONES_DISUIZA:
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
    print(f"\n3. Inyectando escala fija oficial en USD en dim_escalas para {SELLER_NAME}...")
    # Eliminar escalas previas de este seller para evitar duplicaciones
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_ID}", headers=HEADERS)

    # Obtener todos los periodos de facturación (reales y proyectados)
    fact_rows = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&order=periodo.asc", headers=HEADERS).json()
    periodos = [(f["periodo"], f["estado"]) for f in fact_rows]
    print(f"  Se generarán escalas para {len(periodos)} periodos.")

    # Escala oficial Disuiza:
    # 0      1.500,00 (Mínimo mensual fijo)
    # 2,00%      0,00 (Alícuota porcentual desde 0)
    tiers = [
        ("MINIMO", 0.0, 1500.0),
        ("PORCENTUAL", 0.02, 0.0)
    ]

    escalas_payload = []
    for p_str, estado in periodos:
        for tipo, alicuota, monto in tiers:
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
    print(" CONFIGURACIÓN Y SIEMBRA DE DISUIZA COLOMBIA (SELLER ID 964690754)")
    print("================================================================================")
    update_seller()
    seed_projected_facturacion()
    seed_escalas()
    print("\n¡Proceso finalizado con éxito!")

if __name__ == "__main__":
    main()
