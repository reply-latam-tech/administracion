import os
import sys
import requests
import json
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, "..", "..", ".env")
load_dotenv(ENV_PATH)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hnowniqxrtxrrujgnhqj.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

SELLER_ID = 807100133
SELLER_NAME = "Evacol México ML"

# Tipos de cambio oficiales MXN / USD por mes
TC_MAP = {
    '2026-08': 16.97,
    '2026-09': 18.07,
    '2026-10': 18.12,
    '2026-11': 18.18,
    '2026-12': 18.25,
    '2027-01': 18.32,
    '2027-02': 18.38,
    '2027-03': 18.45,
    '2027-04': 18.52,
    '2027-05': 18.58,
    '2027-06': 18.65,
    '2027-07': 18.72,
    '2027-08': 18.80,
    '2027-09': 18.90
}

# Facturación en MXN: 2 reales (Agosto 1,398 y Septiembre 2,097) + 12 proyectados
DATOS_FACTURACION_MXN = [
    ("2026-08-01", 1398.0, "REAL"),
    ("2026-09-01", 2097.0, "REAL"),
    ("2026-10-01", 35000.0, "PROYECTADO"),
    ("2026-11-01", 65000.0, "PROYECTADO"),
    ("2026-12-01", 78000.0, "PROYECTADO"),
    ("2027-01-01", 38000.0, "PROYECTADO"),
    ("2027-02-01", 42000.0, "PROYECTADO"),
    ("2027-03-01", 48000.0, "PROYECTADO"),
    ("2027-04-01", 52000.0, "PROYECTADO"),
    ("2027-05-01", 72000.0, "PROYECTADO"),
    ("2027-06-01", 58000.0, "PROYECTADO"),
    ("2027-07-01", 62000.0, "PROYECTADO"),
    ("2027-08-01", 65000.0, "PROYECTADO"),
    ("2027-09-01", 70000.0, "PROYECTADO"),
]

def update_facturacion():
    print(f"1. Actualizando facturación en MXN para {SELLER_NAME} ({SELLER_ID})...")
    prev_val = 0.0
    for p_str, val_mxn, estado in DATOS_FACTURACION_MXN:
        var = round((val_mxn - prev_val) / prev_val, 4) if prev_val > 0 else 0.0
        payload = {
            "seller_id": SELLER_ID,
            "periodo": p_str,
            "valor_facturado": val_mxn,
            "variacion_mensual": var,
            "estado": estado
        }
        check = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&periodo=eq.{p_str}", headers=headers).json()
        if check:
            fid = check[0]["id"]
            rf = requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=headers, json=payload)
            print(f"  [{estado}] Actualizado {p_str}: $ {val_mxn:,.2f} MXN (status {rf.status_code})")
        else:
            rf = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=headers, json=[payload])
            print(f"  [{estado}] Insertado {p_str}: $ {val_mxn:,.2f} MXN (status {rf.status_code})")
        prev_val = val_mxn

def calculate_fee_usd(gmv_usd):
    # Escala oficial en USD (sin deducir IVA):
    # 0       1.000,00  (Mínimo garantizado)
    # 2,93%  35.000,00
    # 2,76%  45.000,00
    # 2,44%  70.000,00
    # 2,28%  90.000,00
    # 1,95% 125.000,00
    # 1,63% 170.000,00
    # 1,30% 230.000,00
    if gmv_usd >= 230000.0:
        return gmv_usd * 0.0130, 0.0130, "PORCENTUAL"
    elif gmv_usd >= 170000.0:
        return gmv_usd * 0.0163, 0.0163, "PORCENTUAL"
    elif gmv_usd >= 125000.0:
        return gmv_usd * 0.0195, 0.0195, "PORCENTUAL"
    elif gmv_usd >= 90000.0:
        return gmv_usd * 0.0228, 0.0228, "PORCENTUAL"
    elif gmv_usd >= 70000.0:
        return gmv_usd * 0.0244, 0.0244, "PORCENTUAL"
    elif gmv_usd >= 45000.0:
        return gmv_usd * 0.0276, 0.0276, "PORCENTUAL"
    elif gmv_usd >= 35000.0:
        return gmv_usd * 0.0293, 0.0293, "PORCENTUAL"
    else:
        return 1000.0, 0.0, "MINIMO"

def update_liquidaciones():
    print(f"\n2. Actualizando liquidaciones en Supabase para {SELLER_NAME} ({SELLER_ID})...")
    # Borrar liquidaciones existentes de Evacol México para regenerarlas limpias
    r_del = requests.delete(f"{SUPABASE_URL}/rest/v1/liquidaciones?seller_id=eq.{SELLER_ID}", headers=headers)
    print(f"  Limpieza de liquidaciones previas: status {r_del.status_code}")

    liqs_payload = []
    for p_str, val_mxn, estado in DATOS_FACTURACION_MXN:
        m_key = p_str[:7]
        tc = TC_MAP.get(m_key, 18.12)
        gmv_usd = val_mxn / tc
        fee_usd, alicuota, tipo_cargo = calculate_fee_usd(gmv_usd)
        
        # Conversión del fee a pesos mexicanos (MXN)
        fee_mxn = round(fee_usd * tc, 2)
        
        # Sin IVA para cuentas de México
        iva_mxn = 0.0
        total_mxn = fee_mxn

        payload = {
            "seller_id": SELLER_ID,
            "periodo": p_str,
            "nombre_seller": SELLER_NAME,
            "valor_facturado": val_mxn,
            "tipo_cargo_aplicado": tipo_cargo,
            "alicuota_aplicada": alicuota,
            "subtotal_mercado_libre": fee_mxn,
            "subtotal_botmaker": 0.0,
            "subtotal": fee_mxn,
            "iva": iva_mxn,
            "total_factura": total_mxn,
            "moneda": "MXN",
            "estado": estado
        }
        liqs_payload.append(payload)
        print(f"  {p_str}: GMV=${val_mxn:,.2f} MXN (US$ {gmv_usd:,.2f}) -> Fee=US$ {fee_usd:,.2f} ({tipo_cargo}) -> Cobro=${fee_mxn:,.2f} MXN | IVA=$0.00 | Total=${total_mxn:,.2f} MXN")

    r_ins = requests.post(f"{SUPABASE_URL}/rest/v1/liquidaciones", headers=headers, json=liqs_payload)
    print(f"  Inserción de {len(liqs_payload)} liquidaciones: status {r_ins.status_code}")

def main():
    print("================================================================================")
    print(" ACTUALIZACIÓN REGLAS COMERCIALES EVACOL MÉXICO (SELLER ID: 807100133)")
    print(" Regla: Facturación en MXN -> TC a USD -> Cruce Escala USD -> Cobro MXN sin IVA")
    print("================================================================================")
    update_facturacion()
    update_liquidaciones()
    print("\n¡Actualización completada con éxito!")

if __name__ == "__main__":
    main()
