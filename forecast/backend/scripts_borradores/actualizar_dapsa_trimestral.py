import os
from supabase import create_client, Client

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SELLER_ID = 447463711
SELLER_NAME = "Dapsa"

def run_actualizacion():
    print("=" * 70)
    print(f"ACTUALIZANDO CONDICIONES CONTRACTUALES PARA {SELLER_NAME} ({SELLER_ID})")
    print("=" * 70)

    # 1. Actualizar dim_sellers
    print("\n1. Actualizando dim_sellers:")
    print("   - frecuencia_actualizacion: 'TRIMESTRAL'")
    print("   - cobrar_botmaker: True")
    r_seller = supabase.table("dim_sellers").update({
        "frecuencia_actualizacion": "TRIMESTRAL",
        "cobrar_botmaker": True
    }).eq("id_seller", SELLER_ID).execute()
    print("   -> Seller actualizado:", r_seller.data)

    # 2. Inflación mensual cargada
    inf = {
        '2026-04-01': 0.026, '2026-05-01': 0.021, '2026-06-01': 0.019,
        '2026-07-01': 0.021, '2026-08-01': 0.017, '2026-09-01': 0.019,
        '2026-10-01': 0.017, '2026-11-01': 0.016, '2026-12-01': 0.018,
        '2027-01-01': 0.016, '2027-02-01': 0.016, '2027-03-01': 0.017,
        '2027-04-01': 0.014, '2027-05-01': 0.014, '2027-06-01': 0.014
    }

    # Escala base (Febrero 2026)
    tramos_base = [
        51537304.0, 73624721.0, 103074611.0, 139886972.0, 
        191424277.0, 279773943.0, 412298442.0, 588997775.0
    ]
    alicuotas = [0.055, 0.045, 0.0425, 0.0375, 0.035, 0.03, 0.025, 0.02]
    minimo_feb = 2834552.0

    # Marzo 2026 (+2.9%)
    minimo_mar = round(minimo_feb * 1.029, 2)
    tramos_mar = [round(x * 1.029, 2) for x in tramos_base]

    # Abril 2026 (+3.4% en tramos, Mínimo contractual pactado $2.754.698,00)
    minimo_abr = 2754698.0
    tramos_abr = [round(x * 1.034, 2) for x in tramos_mar]

    # Factores acumulados trimestrales
    q3_factor = (1 + inf['2026-04-01']) * (1 + inf['2026-05-01']) * (1 + inf['2026-06-01'])
    minimo_jul = round(minimo_abr * q3_factor, 2)
    tramos_jul = [round(x * q3_factor, 2) for x in tramos_abr]

    q4_factor = (1 + inf['2026-07-01']) * (1 + inf['2026-08-01']) * (1 + inf['2026-09-01'])
    minimo_oct = round(minimo_jul * q4_factor, 2)
    tramos_oct = [round(x * q4_factor, 2) for x in tramos_jul]

    q1_27_factor = (1 + inf['2026-10-01']) * (1 + inf['2026-11-01']) * (1 + inf['2026-12-01'])
    minimo_ene27 = round(minimo_oct * q1_27_factor, 2)
    tramos_ene27 = [round(x * q1_27_factor, 2) for x in tramos_oct]

    q2_27_factor = (1 + inf['2027-01-01']) * (1 + inf['2027-02-01']) * (1 + inf['2027-03-01'])
    minimo_abr27 = round(minimo_ene27 * q2_27_factor, 2)
    tramos_abr27 = [round(x * q2_27_factor, 2) for x in tramos_ene27]

    q3_27_factor = (1 + inf['2027-04-01']) * (1 + inf['2027-05-01']) * (1 + inf['2027-06-01'])
    minimo_jul27 = round(minimo_abr27 * q3_27_factor, 2)
    tramos_jul27 = [round(x * q3_27_factor, 2) for x in tramos_abr27]

    # Definir cada período
    periodos_def = [
        # Periodo, Minimo, Tramos, Variacion Mensual
        ('2026-02-01', minimo_feb, tramos_base, 0.0),
        ('2026-03-01', minimo_mar, tramos_mar, 0.029),
        ('2026-04-01', minimo_abr, tramos_abr, 0.034),
        ('2026-05-01', minimo_abr, tramos_abr, 0.0),
        ('2026-06-01', minimo_abr, tramos_abr, 0.0),
        ('2026-07-01', minimo_jul, tramos_jul, round(q3_factor - 1, 4)),
        ('2026-08-01', minimo_jul, tramos_jul, 0.0),
        ('2026-09-01', minimo_jul, tramos_jul, 0.0),
        ('2026-10-01', minimo_oct, tramos_oct, round(q4_factor - 1, 4)),
        ('2026-11-01', minimo_oct, tramos_oct, 0.0),
        ('2026-12-01', minimo_oct, tramos_oct, 0.0),
        ('2027-01-01', minimo_ene27, tramos_ene27, round(q1_27_factor - 1, 4)),
        ('2027-02-01', minimo_ene27, tramos_ene27, 0.0),
        ('2027-03-01', minimo_ene27, tramos_ene27, 0.0),
        ('2027-04-01', minimo_abr27, tramos_abr27, round(q2_27_factor - 1, 4)),
        ('2027-05-01', minimo_abr27, tramos_abr27, 0.0),
        ('2027-06-01', minimo_abr27, tramos_abr27, 0.0),
        ('2027-07-01', minimo_jul27, tramos_jul27, round(q3_27_factor - 1, 4)),
        ('2027-08-01', minimo_jul27, tramos_jul27, 0.0),
        ('2027-09-01', minimo_jul27, tramos_jul27, 0.0),
    ]

    escalas_payload = []
    for periodo, min_val, tramos_val, var_val in periodos_def:
        estado = "REAL" if periodo <= "2026-09-01" else "PROYECTADO"
        
        # 1. Fila de Mínimo
        escalas_payload.append({
            "seller_id": SELLER_ID,
            "periodo": periodo,
            "tipo_cargo": "MINIMO",
            "alicuota": 0.0,
            "monto_objetivo": min_val,
            "pais": "AR",
            "moneda": "ARS",
            "variacion_mensual": var_val,
            "estado": estado
        })
        
        # 2. Ocho filas porcentuales
        for ali, tramo in zip(alicuotas, tramos_val):
            escalas_payload.append({
                "seller_id": SELLER_ID,
                "periodo": periodo,
                "tipo_cargo": "PORCENTUAL",
                "alicuota": ali,
                "monto_objetivo": tramo,
                "pais": "AR",
                "moneda": "ARS",
                "variacion_mensual": var_val,
                "estado": estado
            })

    print(f"\n2. Regenerando {len(escalas_payload)} registros en dim_escalas...")
    r_del = supabase.table("dim_escalas").delete().eq("seller_id", SELLER_ID).execute()
    print("   -> Eliminadas escalas previas de Dapsa.")

    for i in range(0, len(escalas_payload), 50):
        chunk = escalas_payload[i:i+50]
        supabase.table("dim_escalas").insert(chunk).execute()
    print("   -> Insertadas con éxito todas las escalas trimestrales corregidas.")

    # 3. Validar resultados en la vista liquidaciones
    print("\n3. Validando cálculo resultante en la vista liquidaciones:")
    liq_res = supabase.table("liquidaciones").select(
        "periodo, valor_facturado, tipo_cargo_aplicado, subtotal_mercado_libre, botmaker, subtotal, iva, total_factura"
    ).eq("seller_id", SELLER_ID).order("periodo").execute()

    print(f"{'Período':<12} | {'Facturado ML':<14} | {'Tipo':<8} | {'Fee ML':<14} | {'Botmaker':<10} | {'Subtotal':<14} | {'IVA':<12} | {'Total Factura':<14}")
    print("-" * 115)
    for row in liq_res.data:
        p = row['periodo']
        vf = row['valor_facturado'] or 0
        t = row['tipo_cargo_aplicado'] or ''
        sml = row['subtotal_mercado_libre'] or 0
        bot = row['botmaker'] or 0
        sub = row['subtotal'] or 0
        iva = row['iva'] or 0
        tot = row['total_factura'] or 0
        print(f"{p:<12} | ${vf:>12,.2f} | {t:<8} | ${sml:>12,.2f} | ${bot:>8,.2f} | ${sub:>12,.2f} | ${iva:>10,.2f} | ${tot:>12,.2f}")

    print("\n" + "=" * 70)
    print("¡ACTUALIZACIÓN COMPLETADA CON ÉXITO!")
    print("=" * 70)

if __name__ == "__main__":
    run_actualizacion()
