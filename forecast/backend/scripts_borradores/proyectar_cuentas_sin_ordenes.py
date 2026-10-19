"""
Script para proyectar facturación y escalas en cuentas sin información diaria (API de órdenes).
Caso de Estudio y Producción: Natura Colombia (id_seller 941943480).

Metodología:
1. Descomposición Multiplicativa de Series Temporales (Time Series Decomposition).
2. Nivel base desestacionalizado (Run Rate) calculado del historial reciente.
3. Índice de estacionalidad mensual específico de la categoría (Belleza y Cuidado Personal)
   y del calendario comercial minorista de Colombia (Día de la Madre en Mayo, Amor y Amistad en Sep,
   Black Friday en Nov, Navidad y Prima en Dic, bajón en Ene/Feb).
4. Tasa de crecimiento orgánico e inflacionario compuesto (+1.2% mensual).
5. Conversión a USD con la curva proyectada de tipo de cambio oficial de Reply.
6. Cruce con los tiers de la escala en USD para determinar el Fee proyectado mensual.
7. Inserta los 12 meses proyectados (2026-10 a 2027-09) en Supabase:
   - Tabla facturacion (con estado='PROYECTADO')
   - Tabla dim_escalas (con estado='PROYECTADO')
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

# 12 meses proyectados con TC proyectado, estacionalidad y facturación calculada
PROYECCIONES = [
    {
        "periodo": "2026-10-01",
        "mes_nombre": "Octubre 2026",
        "estacionalidad": 1.02,
        "tc_proyectado": 3325.00,
        "facturacion_cop": 237415200.0,
        "usd": 71403.07,
        "tier": "70k",
        "alicuota": 0.0244,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 1742.23
    },
    {
        "periodo": "2026-11-01",
        "mes_nombre": "Noviembre 2026 (Black Friday)",
        "estacionalidad": 1.35,
        "tc_proyectado": 3340.00,
        "facturacion_cop": 317996712.0,
        "usd": 95208.60,
        "tier": "90k",
        "alicuota": 0.0228,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 2170.76
    },
    {
        "periodo": "2026-12-01",
        "mes_nombre": "Diciembre 2026 (Navidad / Prima)",
        "estacionalidad": 1.60,
        "tc_proyectado": 3360.00,
        "facturacion_cop": 381407612.0,
        "usd": 113514.17,
        "tier": "90k",
        "alicuota": 0.0228,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 2588.12
    },
    {
        "periodo": "2027-01-01",
        "mes_nombre": "Enero 2027 (Posfiestas)",
        "estacionalidad": 0.82,
        "tc_proyectado": 3375.00,
        "facturacion_cop": 197817058.0,
        "usd": 58612.46,
        "tier": "45k",
        "alicuota": 0.0276,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 1617.70
    },
    {
        "periodo": "2027-02-01",
        "mes_nombre": "Febrero 2027",
        "estacionalidad": 0.88,
        "tc_proyectado": 3390.00,
        "facturacion_cop": 214838975.0,
        "usd": 63374.33,
        "tier": "45k",
        "alicuota": 0.0276,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 1749.13
    },
    {
        "periodo": "2027-03-01",
        "mes_nombre": "Marzo 2027 (Día de la Mujer)",
        "estacionalidad": 1.05,
        "tc_proyectado": 3410.00,
        "facturacion_cop": 259418062.0,
        "usd": 76075.68,
        "tier": "70k",
        "alicuota": 0.0244,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 1856.25
    },
    {
        "periodo": "2027-04-01",
        "mes_nombre": "Abril 2027",
        "estacionalidad": 1.08,
        "tc_proyectado": 3425.00,
        "facturacion_cop": 270031966.0,
        "usd": 78841.45,
        "tier": "70k",
        "alicuota": 0.0244,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 1923.73
    },
    {
        "periodo": "2027-05-01",
        "mes_nombre": "Mayo 2027 (Día de la Madre)",
        "estacionalidad": 1.38,
        "tc_proyectado": 3440.00,
        "facturacion_cop": 349181336.0,
        "usd": 101506.20,
        "tier": "90k",
        "alicuota": 0.0228,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 2314.34
    },
    {
        "periodo": "2027-06-01",
        "mes_nombre": "Junio 2027 (Día del Padre / Prima)",
        "estacionalidad": 1.12,
        "tc_proyectado": 3455.00,
        "facturacion_cop": 286794271.0,
        "usd": 83008.47,
        "tier": "70k",
        "alicuota": 0.0244,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 2025.41
    },
    {
        "periodo": "2027-07-01",
        "mes_nombre": "Julio 2027 (Cyber Days)",
        "estacionalidad": 1.15,
        "tc_proyectado": 3470.00,
        "facturacion_cop": 298009975.0,
        "usd": 85881.84,
        "tier": "70k",
        "alicuota": 0.0244,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 2095.52
    },
    {
        "periodo": "2027-08-01",
        "mes_nombre": "Agosto 2027",
        "estacionalidad": 1.18,
        "tc_proyectado": 3485.00,
        "facturacion_cop": 309453558.0,
        "usd": 88795.86,
        "tier": "70k",
        "alicuota": 0.0244,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 2166.62
    },
    {
        "periodo": "2027-09-01",
        "mes_nombre": "Septiembre 2027 (Amor y Amistad)",
        "estacionalidad": 1.32,
        "tc_proyectado": 3500.00,
        "facturacion_cop": 350322408.0,
        "usd": 100092.12,
        "tier": "90k",
        "alicuota": 0.0228,
        "tipo_cargo": "PORCENTUAL",
        "fee_usd": 2282.10
    }
]

def seed_projected_facturacion():
    print(f"\n1. Ingestando Facturación Proyectada en Supabase para {SELLER_NAME}...")
    
    # Obtener el último valor real para calcular variación del primer mes proyectado
    res_last = requests.get(
        f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&periodo=eq.2026-09-01",
        headers=HEADERS
    ).json()
    last_real_val = res_last[0]["valor_facturado"] if res_last else 306362411.0

    prev_val = last_real_val
    for p in PROYECCIONES:
        variacion = round((p["facturacion_cop"] - prev_val) / prev_val, 4) if prev_val > 0 else 0.0
        payload = {
            "seller_id": SELLER_ID,
            "periodo": p["periodo"],
            "valor_facturado": p["facturacion_cop"],
            "variacion_mensual": variacion,
            "estado": "PROYECTADO"
        }
        
        # Verificar si existe para actualizar o insertar
        check = requests.get(
            f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&periodo=eq.{p['periodo']}",
            headers=HEADERS
        ).json()
        
        if check:
            fid = check[0]["id"]
            rf = requests.patch(f"{SUPABASE_URL}/rest/v1/facturacion?id=eq.{fid}", headers=HEADERS, json=payload)
            print(f"  Actualizado {p['periodo']}: {p['facturacion_cop']:,.0f} COP (~${p['usd']:,.0f} USD | Fee: ${p['fee_usd']:,.2f} USD) [status {rf.status_code}]")
        else:
            rf = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=[payload])
            print(f"  Insertado {p['periodo']}: {p['facturacion_cop']:,.0f} COP (~${p['usd']:,.0f} USD | Fee: ${p['fee_usd']:,.2f} USD) [status {rf.status_code}]")
            
        prev_val = p["facturacion_cop"]

def seed_projected_escalas():
    print(f"\n2. Ingestando Escalas Proyectadas en USD en dim_escalas para {SELLER_NAME}...")
    
    tiers_usd = [
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
    for p in PROYECCIONES:
        for tipo, alicuota, monto in tiers_usd:
            escalas_payload.append({
                "seller_id": SELLER_ID,
                "periodo": p["periodo"],
                "pais": "CO",
                "tipo_cargo": tipo,
                "alicuota": alicuota,
                "monto_objetivo": monto,
                "moneda": "USD",
                "variacion_mensual": 0.0,
                "estado": "PROYECTADO"
            })

    # Limpiar proyecciones previas si existían
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{SELLER_ID}&estado=eq.PROYECTADO", headers=HEADERS)

    for chunk_start in range(0, len(escalas_payload), 50):
        chunk = escalas_payload[chunk_start:chunk_start+50]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
        print(f"  Lote de {len(chunk)} escalas proyectadas insertado (status {r.status_code})")

def main():
    print("================================================================================")
    print(" PROYECCIÓN DE CUENTAS SIN DATOS DIARIOS (NATURA COLOMBIA - 12 MESES)")
    print("================================================================================")
    seed_projected_facturacion()
    seed_projected_escalas()
    print("\n¡Proceso finalizado con éxito!")

if __name__ == "__main__":
    main()
