"""
Script para sincronizar y sembrar Newsan Chile en Supabase:
1. Actualiza dim_sellers para las 6 cuentas de Newsan Chile:
   - 942368053: Newsan Chile ML (Plataforma: MELI)
   - 977559914: Newsan Chile Falabella (Plataforma: FALABELLA)
   - 962651791: Newsan Chile Ripley (Plataforma: RIPLEY)
   - 919428720: Newsan Chile Walmart (Plataforma: WALMART)
   - 978106559: Newsan Chile Paris (Plataforma: PARIS)
   - 936492429: Newsan Chile Kitchen Center (Plataforma: KITCHENCENTER)
   Configuración: pais='CL', codigo_pais='CL', moneda='CLP', estado=True, cobrar_botmaker=False, frecuencia_actualizacion='FIJA', id_cliente=14.

2. Genera y siembra dim_escalas en USD para todos los periodos (15 meses: 2026-07 a 2027-09).
   Regla contractual:
   - Facturación bruta en CLP de las 6 cuentas se pasa a USD con el TC oficial mensual.
   - Suma total consolidada se cruza con escala:
     * Si 1% < USD 4,000 -> Fee = USD 4,000 (MÍNIMO)
     * Si 1% >= USD 4,000 -> Fee = 1% del total en USD
   - Se distribuye en dim_escalas con prorrateo exacto según participación de ventas para que
     la vista liquidaciones totalice exactamente USD 4,000 por mes (o el 1% consolidado).
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
    "Prefer": "resolution=merge-duplicates"
}

SELLERS_NEWSAN_CHILE = [
    {
        "id_seller": 942368053,
        "nombre_seller": "Newsan Chile ML",
        "codigo_plataforma": "MELI",
        "pais": "CL",
        "codigo_pais": "CL",
        "moneda": "CLP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "id_cliente": 14
    },
    {
        "id_seller": 977559914,
        "nombre_seller": "Newsan Chile Falabella",
        "codigo_plataforma": "FALABELLA",
        "pais": "CL",
        "codigo_pais": "CL",
        "moneda": "CLP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "id_cliente": 14
    },
    {
        "id_seller": 962651791,
        "nombre_seller": "Newsan Chile Ripley",
        "codigo_plataforma": "RIPLEY",
        "pais": "CL",
        "codigo_pais": "CL",
        "moneda": "CLP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "id_cliente": 14
    },
    {
        "id_seller": 919428720,
        "nombre_seller": "Newsan Chile Walmart",
        "codigo_plataforma": "WALMART",
        "pais": "CL",
        "codigo_pais": "CL",
        "moneda": "CLP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "id_cliente": 14
    },
    {
        "id_seller": 978106559,
        "nombre_seller": "Newsan Chile Paris",
        "codigo_plataforma": "PARIS",
        "pais": "CL",
        "codigo_pais": "CL",
        "moneda": "CLP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "id_cliente": 14
    },
    {
        "id_seller": 936492429,
        "nombre_seller": "Newsan Chile Kitchen Center",
        "codigo_plataforma": "KITCHENCENTER",
        "pais": "CL",
        "codigo_pais": "CL",
        "moneda": "CLP",
        "estado": True,
        "cobrar_botmaker": False,
        "frecuencia_actualizacion": "FIJA",
        "id_cliente": 14
    }
]

TC_CLP_POR_MES = {
    '2026-07-01': 941.93,
    '2026-08-01': 929.18,
    '2026-09-01': 972.60,
    '2026-10-01': 975.00,
    '2026-11-01': 978.00,
    '2026-12-01': 982.00,
    '2027-01-01': 985.00,
    '2027-02-01': 989.00,
    '2027-03-01': 993.00,
    '2027-04-01': 998.00,
    '2027-05-01': 1002.00,
    '2027-06-01': 1006.00,
    '2027-07-01': 1010.00,
    '2027-08-01': 1014.00,
    '2027-09-01': 1018.00,
}

def update_sellers():
    print("1. Actualizando los 6 sellers de Newsan Chile en dim_sellers...")
    for s in SELLERS_NEWSAN_CHILE:
        sid = s["id_seller"]
        payload = {
            "nombre_seller": s["nombre_seller"],
            "codigo_plataforma": s["codigo_plataforma"],
            "pais": s["pais"],
            "codigo_pais": s["codigo_pais"],
            "moneda": s["moneda"],
            "estado": s["estado"],
            "cobrar_botmaker": s["cobrar_botmaker"],
            "frecuencia_actualizacion": s["frecuencia_actualizacion"],
            "id_cliente": s["id_cliente"]
        }
        r = requests.patch(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{sid}", headers=HEADERS, json=payload)
        print(f"  Seller {sid} ({s['nombre_seller']}): patch status {r.status_code}")

def seed_escalas():
    print("\n2. Leyendo facturación y calculando escalas proporcionales en USD...")
    seller_ids = [str(s["id_seller"]) for s in SELLERS_NEWSAN_CHILE]
    
    # Limpiar escalas anteriores si hubiese
    for sid in seller_ids:
        requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{sid}", headers=HEADERS)

    # Obtener facturación de los 6 sellers
    all_data = {}
    periodos_meta = {}
    for sid in seller_ids:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{sid}&order=periodo.asc", headers=HEADERS)
        for row in r.json():
            p = row['periodo']
            if p not in all_data:
                all_data[p] = {}
            all_data[p][sid] = row['valor_facturado']
            periodos_meta[p] = row['estado']

    escalas_payload = []

    print(f"\n{'Periodo':<12} | {'Total CLP':<18} | {'Total USD':<14} | {'Fee Total USD':<14}")
    print("-" * 65)

    for p in sorted(all_data.keys()):
        tot_clp = sum(all_data[p].values())
        tc = TC_CLP_POR_MES.get(p, 950.0)
        tot_usd = tot_clp / tc
        fee_1pct = tot_usd * 0.01
        fee_consolidado = max(4000.0, fee_1pct)
        estado_mes = periodos_meta.get(p, "REAL")

        print(f"{p:<12} | CLP {tot_clp:>13,.0f} | USD {tot_usd:>9,.2f} | USD {fee_consolidado:>9,.2f}")

        # Distribuir fee_consolidado entre las 6 cuentas proporcionalmente a sus ventas
        # y registrar tanto MINIMO como PORCENTUAL en dim_escalas
        for s in SELLERS_NEWSAN_CHILE:
            sid = str(s["id_seller"])
            v_clp = all_data[p].get(sid, 0.0)
            share = (v_clp / tot_clp) if tot_clp > 0 else (1.0 / len(seller_ids))
            fee_share = round(fee_consolidado * share, 2)

            # 1. Tier MINIMO proporcional (garantiza que la suma sea exactamente $4.000 USD)
            escalas_payload.append({
                "seller_id": int(sid),
                "periodo": p,
                "pais": "CL",
                "tipo_cargo": "MINIMO",
                "alicuota": 0.0,
                "monto_objetivo": fee_share,
                "moneda": "USD",
                "variacion_mensual": 0.0,
                "estado": estado_mes
            })

            # 2. Tier PORCENTUAL al 1% (para cuando el volumen supere los USD 400.000)
            escalas_payload.append({
                "seller_id": int(sid),
                "periodo": p,
                "pais": "CL",
                "tipo_cargo": "PORCENTUAL",
                "alicuota": 0.01,
                "monto_objetivo": 400000.0,
                "moneda": "USD",
                "variacion_mensual": 0.0,
                "estado": estado_mes
            })

    print(f"\n3. Insertando {len(escalas_payload)} registros de escala en dim_escalas...")
    for chunk_start in range(0, len(escalas_payload), 50):
        chunk = escalas_payload[chunk_start:chunk_start+50]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
        print(f"  Lote {chunk_start//50 + 1}: {len(chunk)} escalas insertadas (status {r.status_code})")

def main():
    print("================================================================================")
    print(" CONFIGURACIÓN Y SIEMBRA DE ESCALAS NEWSAN CHILE MULTICANAL (6 CUENTAS)")
    print("================================================================================")
    update_sellers()
    seed_escalas()
    print("\n¡Proceso de Newsan Chile completado con éxito!")

if __name__ == "__main__":
    main()
