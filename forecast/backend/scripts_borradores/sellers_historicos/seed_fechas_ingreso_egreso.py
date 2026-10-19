"""
Script para registrar fechas de ingreso y egreso de sellers.
Caso especial: TRADEMEDICAL CHILE SPA (id_seller 983474076)
Ingreso: 2026-08-01
Egreso: 2026-09-30
Estado: False (Baja)
"""

import os
import sys
import requests
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, "..", "..", ".env")
load_dotenv(ENV_PATH)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hnowniqxrtxrrujgnhqj.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def seed_fechas():
    print("=== REGISTRANDO ESTADO Y FECHAS DE SELLERS ===")
    
    # 1. Actualizar Trademedical Chile SPA
    trademedical_payload = {
        "nombre_seller": "Trademedical Chile SPA",
        "estado": False
    }
    
    # Intentar actualizar con fecha_ingreso y fecha_egreso si las columnas ya existen
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.983474076",
        headers=HEADERS,
        json={"nombre_seller": "Trademedical Chile SPA", "estado": False, "fecha_ingreso": "2026-08-01", "fecha_egreso": "2026-09-30"}
    )
    
    if r.status_code == 200:
        print(" Trademedical Chile SPA actualizado con fecha_ingreso y fecha_egreso exitosamente!")
    else:
        # Fallback sin las columnas de fecha si la migración DDL aún no se ejecutó en la DB
        r2 = requests.patch(
            f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.983474076",
            headers=HEADERS,
            json=trademedical_payload
        )
        print(f" Trademedical Chile SPA actualizado (estado=False): {r2.status_code}")
        print("  Nota: Ejecutar 'forecast/backend/migrations/05_fechas_ingreso_egreso_sellers.sql' en Supabase para agregar las columnas fecha_ingreso y fecha_egreso.")

if __name__ == "__main__":
    seed_fechas()
