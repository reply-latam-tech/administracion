"""
Script integral para calcular y sembrar las proyecciones de 12 meses (Octubre 2026 a Septiembre 2027)
para todas las cuentas de Newsan (id_cliente: 14) en Reply Forecast:
1. Actualiza dim_sellers para que todas las cuentas de Newsan tengan país y plataforma correctos.
2. Genera y siembra proyecciones de dim_escalas para:
   - Newsan ML (256189964): ajuste trimestral según inflación proyectada oficial.
   - Newsan Tienda Web (989595440): ajuste semestral según inflación proyectada oficial.
3. Genera y siembra proyecciones de métricas operativas en fact_metricas_operativas para Tienda Web:
   - Sesiones y Horas Extras con estacionalidad de e-commerce.
4. Genera y siembra proyecciones en facturacion para:
   - Newsan (Mercado Libre) consolidado: 256189964
   - Newsan Motorola: 308973138
   - Pilisar: 256324891
   - Newsan (Tienda Web): 989595440 (0.0 GMV, subtotal en escalas)
   - Newsan Chile (ML, Falabella, Ripley, Walmart, Paris, Kitchen Center)
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
    "Prefer": "return=representation"
}

# IDs de Sellers Newsan
ID_NEWSAN_ML = 256189964      # Newsan ML Consolidado
ID_NEWSAN_MOTO = 308973138    # Motorola
ID_PILISAR = 256324891        # Pilisar
ID_NEWSAN_WEB = 989595440     # Newsan Tienda Web

CHILE_SELLERS = [
    (942368053, "Newsan Chile ML", "MELI"),
    (977559914, "Newsan Chile Falabella", "FALABELLA"),
    (962651791, "Newsan Chile Ripley", "RIPLEY"),
    (919428720, "Newsan Chile Walmart", "WALMART"),
    (978106559, "Newsan Chile Paris", "PARIS"),
    (936492429, "Newsan Chile Kitchen Center", "KITCHEN_CENTER")
]

PERIODOS_PROYECTADOS = [
    "2026-10-01", "2026-11-01", "2026-12-01",
    "2027-01-01", "2027-02-01", "2027-03-01",
    "2027-04-01", "2027-05-01", "2027-06-01",
    "2027-07-01", "2027-08-01", "2027-09-01"
]

def step1_update_dim_sellers():
    print("1. Verificando y actualizando dim_sellers para todas las cuentas de Newsan...")
    # Asegurar cuentas Chile
    for s_id, s_name, plat in CHILE_SELLERS:
        payload = {
            "id_seller": s_id,
            "nombre_seller": s_name,
            "pais": "CL",
            "codigo_pais": "CL",
            "moneda": "CLP",
            "codigo_plataforma": plat,
            "id_cliente": 14,
            "estado": True,
            "cobrar_botmaker": False,
            "frecuencia_actualizacion": "MENSUAL"
        }
        r = requests.patch(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{s_id}", headers=HEADERS, json=payload)
        print(f"  - {s_name} ({s_id}): status {r.status_code}")

    # Asegurar cuentas Argentina
    ar_sellers = [
        (ID_NEWSAN_ML, "Newsan (Mercado Libre)", "MELI", "TRIMESTRAL"),
        (ID_NEWSAN_MOTO, "Newsan Motorola", "MELI", "TRIMESTRAL"),
        (ID_PILISAR, "Pilisar", "MELI", "TRIMESTRAL"),
        (ID_NEWSAN_WEB, "Newsan (Tienda Web)", "WEB", "SEMESTRAL")
    ]
    for s_id, s_name, plat, freq in ar_sellers:
        payload = {
            "id_seller": s_id,
            "nombre_seller": s_name,
            "pais": "AR",
            "codigo_pais": "AR",
            "moneda": "ARS",
            "codigo_plataforma": plat,
            "id_cliente": 14,
            "estado": True,
            "cobrar_botmaker": False,
            "frecuencia_actualizacion": freq
        }
        r = requests.patch(f"{SUPABASE_URL}/rest/v1/dim_sellers?id_seller=eq.{s_id}", headers=HEADERS, json=payload)
        print(f"  - {s_name} ({s_id}): status {r.status_code}")

def step2_project_dim_escalas():
    print("\n2. Generando proyecciones de escalas (Oct 2026 a Sep 2027) para Newsan ML y Web...")
    
    # Obtener inflación oficial
    r_inf = requests.get(f"{SUPABASE_URL}/rest/v1/inflacion?periodo=gte.2026-07-01&order=periodo.asc", headers=HEADERS)
    inf_dict = {row['periodo']: row['valor_inflacion'] for row in r_inf.json()}

    # Factores de inflación
    # Q3 2026 (Jul, Ago, Sep)
    f_q3_26 = (1.0 + inf_dict.get('2026-07-01', 0.021)) * (1.0 + inf_dict.get('2026-08-01', 0.017)) * (1.0 + inf_dict.get('2026-09-01', 0.019))
    # Q4 2026 (Oct, Nov, Dic)
    f_q4_26 = (1.0 + inf_dict.get('2026-10-01', 0.017)) * (1.0 + inf_dict.get('2026-11-01', 0.016)) * (1.0 + inf_dict.get('2026-12-01', 0.018))
    # Q1 2027 (Ene, Feb, Mar)
    f_q1_27 = (1.0 + inf_dict.get('2027-01-01', 0.016)) * (1.0 + inf_dict.get('2027-02-01', 0.016)) * (1.0 + inf_dict.get('2027-03-01', 0.017))
    # Q2 2027 (Abr, May, Jun)
    f_q2_27 = (1.0 + inf_dict.get('2027-04-01', 0.014)) * (1.0 + inf_dict.get('2027-05-01', 0.014)) * (1.0 + inf_dict.get('2027-06-01', 0.014))

    print(f"  Factor Q3 26: {f_q3_26:.6f} (+{(f_q3_26-1)*100:.2f}%)")
    print(f"  Factor Q4 26: {f_q4_26:.6f} (+{(f_q4_26-1)*100:.2f}%)")
    print(f"  Factor Q1 27: {f_q1_27:.6f} (+{(f_q1_27-1)*100:.2f}%)")
    print(f"  Factor Q2 27: {f_q2_27:.6f} (+{(f_q2_27-1)*100:.2f}%)")

    # Limpiar proyecciones existentes para evitar duplicados
    requests.delete(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=in.({ID_NEWSAN_ML},{ID_NEWSAN_WEB})&periodo=gte.2026-10-01", headers=HEADERS)

    # 2.A NEWSAN ML ESCALAS
    # Escala base Sep 2026
    r_sep_ml = requests.get(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{ID_NEWSAN_ML}&periodo=eq.2026-09-01", headers=HEADERS).json()
    
    escalas_ml_payload = []
    
    # Q4 2026 (Oct, Nov, Dic): Ajustado por f_q3_26 en Octubre, congelado en Nov y Dic
    tramos_q4_26 = []
    for t in r_sep_ml:
        monto_adj = round(t['monto_objetivo'] * f_q3_26, 2)
        tramos_q4_26.append({'tipo_cargo': t['tipo_cargo'], 'alicuota': t['alicuota'], 'monto_objetivo': monto_adj})
    
    for mes in ["2026-10-01", "2026-11-01", "2026-12-01"]:
        var_m = round(f_q3_26 - 1.0, 4) if mes == "2026-10-01" else 0.0
        for t in tramos_q4_26:
            escalas_ml_payload.append({
                "seller_id": ID_NEWSAN_ML, "periodo": mes, "pais": "AR", "moneda": "ARS",
                "tipo_cargo": t['tipo_cargo'], "alicuota": t['alicuota'], "monto_objetivo": t['monto_objetivo'],
                "variacion_mensual": var_m, "estado": "PROYECTADO"
            })

    # Q1 2027 (Ene, Feb, Mar): Ajustado por f_q4_26 en Enero, congelado en Feb y Mar
    tramos_q1_27 = []
    for t in tramos_q4_26:
        monto_adj = round(t['monto_objetivo'] * f_q4_26, 2)
        tramos_q1_27.append({'tipo_cargo': t['tipo_cargo'], 'alicuota': t['alicuota'], 'monto_objetivo': monto_adj})

    for mes in ["2027-01-01", "2027-02-01", "2027-03-01"]:
        var_m = round(f_q4_26 - 1.0, 4) if mes == "2027-01-01" else 0.0
        for t in tramos_q1_27:
            escalas_ml_payload.append({
                "seller_id": ID_NEWSAN_ML, "periodo": mes, "pais": "AR", "moneda": "ARS",
                "tipo_cargo": t['tipo_cargo'], "alicuota": t['alicuota'], "monto_objetivo": t['monto_objetivo'],
                "variacion_mensual": var_m, "estado": "PROYECTADO"
            })

    # Q2 2027 (Abr, May, Jun): Ajustado por f_q1_27 en Abril, congelado en May y Jun
    tramos_q2_27 = []
    for t in tramos_q1_27:
        monto_adj = round(t['monto_objetivo'] * f_q1_27, 2)
        tramos_q2_27.append({'tipo_cargo': t['tipo_cargo'], 'alicuota': t['alicuota'], 'monto_objetivo': monto_adj})

    for mes in ["2027-04-01", "2027-05-01", "2027-06-01"]:
        var_m = round(f_q1_27 - 1.0, 4) if mes == "2027-04-01" else 0.0
        for t in tramos_q2_27:
            escalas_ml_payload.append({
                "seller_id": ID_NEWSAN_ML, "periodo": mes, "pais": "AR", "moneda": "ARS",
                "tipo_cargo": t['tipo_cargo'], "alicuota": t['alicuota'], "monto_objetivo": t['monto_objetivo'],
                "variacion_mensual": var_m, "estado": "PROYECTADO"
            })

    # Q3 2027 (Jul, Ago, Sep): Ajustado por f_q2_27 en Julio, congelado en Ago y Sep
    tramos_q3_27 = []
    for t in tramos_q2_27:
        monto_adj = round(t['monto_objetivo'] * f_q2_27, 2)
        tramos_q3_27.append({'tipo_cargo': t['tipo_cargo'], 'alicuota': t['alicuota'], 'monto_objetivo': monto_adj})

    for mes in ["2027-07-01", "2027-08-01", "2027-09-01"]:
        var_m = round(f_q2_27 - 1.0, 4) if mes == "2027-07-01" else 0.0
        for t in tramos_q3_27:
            escalas_ml_payload.append({
                "seller_id": ID_NEWSAN_ML, "periodo": mes, "pais": "AR", "moneda": "ARS",
                "tipo_cargo": t['tipo_cargo'], "alicuota": t['alicuota'], "monto_objetivo": t['monto_objetivo'],
                "variacion_mensual": var_m, "estado": "PROYECTADO"
            })

    for i in range(0, len(escalas_ml_payload), 50):
        chunk = escalas_ml_payload[i:i+50]
        requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
    print(f"  -> Insertados {len(escalas_ml_payload)} tramos proyectados de escalas para Newsan ML.")

    # 2.B NEWSAN TIENDA WEB ESCALAS
    # Escala base Sep 2026 (15 tramos)
    r_sep_web = requests.get(f"{SUPABASE_URL}/rest/v1/dim_escalas?seller_id=eq.{ID_NEWSAN_WEB}&periodo=eq.2026-09-01", headers=HEADERS).json()
    
    # Factor semestral 1 (Oct 26 a Mar 27) = f_q4_26 * f_q1_27
    f_sem1 = f_q4_26 * f_q1_27
    # Factor semestral 2 (Abr 27 a Ago 27) = f_q2_27 * 1.028
    f_sem2 = f_q2_27 * (1.0 + inf_dict.get('2027-07-01', 0.014)) * (1.0 + inf_dict.get('2027-08-01', 0.014))

    escalas_web_payload = []
    
    # Oct 2026 a Mar 2027: Congelados a Sep 2026
    for mes in ["2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01"]:
        for t in r_sep_web:
            escalas_web_payload.append({
                "seller_id": ID_NEWSAN_WEB, "periodo": mes, "pais": "AR", "moneda": "ARS",
                "tipo_cargo": t['tipo_cargo'], "alicuota": t['alicuota'], "monto_objetivo": t['monto_objetivo'],
                "variacion_mensual": 0.0, "estado": "PROYECTADO"
            })

    # Abr 2027 a Ago 2027: Ajustados en Abril por f_sem1 (+10.45%)
    tramos_sem1 = []
    for t in r_sep_web:
        monto_adj = round(t['monto_objetivo'] * f_sem1, 2)
        tramos_sem1.append({'tipo_cargo': t['tipo_cargo'], 'alicuota': t['alicuota'], 'monto_objetivo': monto_adj})

    for mes in ["2027-04-01", "2027-05-01", "2027-06-01", "2027-07-01", "2027-08-01"]:
        var_m = round(f_sem1 - 1.0, 4) if mes == "2027-04-01" else 0.0
        for t in tramos_sem1:
            escalas_web_payload.append({
                "seller_id": ID_NEWSAN_WEB, "periodo": mes, "pais": "AR", "moneda": "ARS",
                "tipo_cargo": t['tipo_cargo'], "alicuota": t['alicuota'], "monto_objetivo": t['monto_objetivo'],
                "variacion_mensual": var_m, "estado": "PROYECTADO"
            })

    # Sep 2027: Ajustado en Sep por f_sem2
    tramos_sem2 = []
    for t in tramos_sem1:
        monto_adj = round(t['monto_objetivo'] * f_sem2, 2)
        tramos_sem2.append({'tipo_cargo': t['tipo_cargo'], 'alicuota': t['alicuota'], 'monto_objetivo': monto_adj})

    for t in tramos_sem2:
        escalas_web_payload.append({
            "seller_id": ID_NEWSAN_WEB, "periodo": "2027-09-01", "pais": "AR", "moneda": "ARS",
            "tipo_cargo": t['tipo_cargo'], "alicuota": t['alicuota'], "monto_objetivo": t['monto_objetivo'],
            "variacion_mensual": round(f_sem2 - 1.0, 4), "estado": "PROYECTADO"
        })

    for i in range(0, len(escalas_web_payload), 50):
        chunk = escalas_web_payload[i:i+50]
        requests.post(f"{SUPABASE_URL}/rest/v1/dim_escalas", headers=HEADERS, json=chunk)
    print(f"  -> Insertados {len(escalas_web_payload)} tramos proyectados de escalas para Newsan Web.")

def step3_project_tienda_web_metrics():
    print("\n3. Generando y guardando métricas operativas proyectadas para Tienda Web (Oct 26 a Sep 27)...")
    requests.delete(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas?seller_id=eq.{ID_NEWSAN_WEB}&periodo=gte.2026-10-01", headers=HEADERS)

    # Proyección con estacionalidad retail
    metricas_proy = [
        ("2026-10-01", 3200, 40),
        ("2026-11-01", 6500, 120), # CyberMonday
        ("2026-12-01", 4800, 80),  # Navidad
        ("2027-01-01", 3000, 30),  # Verano
        ("2027-02-01", 2800, 25),
        ("2027-03-01", 3500, 40),  # Vuelta al cole
        ("2027-04-01", 3200, 35),
        ("2027-05-01", 6800, 130), # Hot Sale
        ("2027-06-01", 4200, 60),  # Día del Padre
        ("2027-07-01", 3100, 35),
        ("2027-08-01", 2900, 30),
        ("2027-09-01", 3300, 35)
    ]

    metricas_payload = []
    for p_str, ses, hs in metricas_proy:
        metricas_payload.append({
            "seller_id": ID_NEWSAN_WEB, "id_cliente": 14, "periodo": p_str,
            "tipo_metrica": "SESIONES", "cantidad": ses, "unidad": "UNIDADES",
            "notas": "Sesiones proyectadas de Tienda Newsan Web"
        })
        metricas_payload.append({
            "seller_id": ID_NEWSAN_WEB, "id_cliente": 14, "periodo": p_str,
            "tipo_metrica": "HORAS_EXTRAS", "cantidad": hs, "unidad": "HORAS",
            "notas": "Horas extras proyectadas de soporte Tienda Newsan Web"
        })

    r = requests.post(f"{SUPABASE_URL}/rest/v1/fact_metricas_operativas", headers=HEADERS, json=metricas_payload)
    print(f"  -> Insertadas {len(metricas_payload)} métricas operativas proyectadas (status {r.status_code}).")

def step4_project_facturacion():
    print("\n4. Generando y guardando proyecciones en facturacion (Oct 26 a Sep 27)...")
    
    # 4.A NEWSAN ARGENTINA
    # Proyecciones mensuales en ARS coherentes con estacionalidad e inflación
    # Tupla: (periodo, moto_val, pilisar_val, total_ml_val)
    proyecciones_ar = [
        ("2026-10-01", 1520000000.0, 4100000000.0, 11200000000.0),
        ("2026-11-01", 2600000000.0, 11200000000.0, 22500000000.0), # CyberWeek
        ("2026-12-01", 1350000000.0, 6250000000.0, 14200000000.0),  # Navidad
        ("2027-01-01", 850000000.0,  4100000000.0, 10100000000.0),  # Verano
        ("2027-02-01", 800000000.0,  3800000000.0, 9500000000.0),
        ("2027-03-01", 1200000000.0, 5100000000.0, 12200000000.0),  # Vuelta al cole
        ("2027-04-01", 1050000000.0, 4500000000.0, 11000000000.0),
        ("2027-05-01", 2400000000.0, 11500000000.0, 24500000000.0), # Hot Sale
        ("2027-06-01", 1450000000.0, 6200000000.0, 15200000000.0),  # Día del Padre
        ("2027-07-01", 1150000000.0, 4800000000.0, 11800000000.0),
        ("2027-08-01", 1150000000.0, 4700000000.0, 11500000000.0),  # Día del Niño
        ("2027-09-01", 1250000000.0, 5050000000.0, 12400000000.0)
    ]

    all_fact_payload = []

    # Limpiar proyecciones previas de los sellers en Supabase
    all_sids = [ID_NEWSAN_ML, ID_NEWSAN_MOTO, ID_PILISAR, ID_NEWSAN_WEB] + [s[0] for s in CHILE_SELLERS]
    sids_str = ",".join(str(s) for s in all_sids)
    requests.delete(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=in.({sids_str})&periodo=gte.2026-10-01", headers=HEADERS)

    # Armar payload Argentina
    prev_moto = 1439146107.0
    prev_pili = 3811253698.0
    prev_tot = 10330429822.0

    for p_str, v_moto, v_pili, v_tot in proyecciones_ar:
        var_moto = round((v_moto - prev_moto) / prev_moto, 4)
        var_pili = round((v_pili - prev_pili) / prev_pili, 4)
        var_tot = round((v_tot - prev_tot) / prev_tot, 4)

        all_fact_payload.append({
            "seller_id": ID_NEWSAN_MOTO, "periodo": p_str,
            "valor_facturado": v_moto, "variacion_mensual": var_moto, "estado": "PROYECTADO"
        })
        all_fact_payload.append({
            "seller_id": ID_PILISAR, "periodo": p_str,
            "valor_facturado": v_pili, "variacion_mensual": var_pili, "estado": "PROYECTADO"
        })
        all_fact_payload.append({
            "seller_id": ID_NEWSAN_ML, "periodo": p_str,
            "valor_facturado": v_tot, "variacion_mensual": var_tot, "estado": "PROYECTADO"
        })
        all_fact_payload.append({
            "seller_id": ID_NEWSAN_WEB, "periodo": p_str,
            "valor_facturado": 0.0, "variacion_mensual": 0.0, "estado": "PROYECTADO"
        })

        prev_moto, prev_pili, prev_tot = v_moto, v_pili, v_tot

    # 4.B NEWSAN CHILE (CLP)
    # Valores proyectados mensuales por canal en CLP
    chile_proy_map = {
        977559914: [ # Falabella
            ("2026-10-01", 110000000.0), ("2026-11-01", 185000000.0), ("2026-12-01", 150000000.0),
            ("2027-01-01", 85000000.0),  ("2027-02-01", 80000000.0),  ("2027-03-01", 105000000.0),
            ("2027-04-01", 95000000.0),  ("2027-05-01", 190000000.0), ("2027-06-01", 120000000.0),
            ("2027-07-01", 100000000.0), ("2027-08-01", 105000000.0), ("2027-09-01", 115000000.0)
        ],
        942368053: [ # ML Chile
            ("2026-10-01", 32000000.0),  ("2026-11-01", 65000000.0),  ("2026-12-01", 55000000.0),
            ("2027-01-01", 25000000.0),  ("2027-02-01", 24000000.0),  ("2027-03-01", 33000000.0),
            ("2027-04-01", 30000000.0),  ("2027-05-01", 70000000.0),  ("2027-06-01", 42000000.0),
            ("2027-07-01", 32000000.0),  ("2027-08-01", 34000000.0),  ("2027-09-01", 36000000.0)
        ],
        978106559: [ # Paris
            ("2026-10-01", 16000000.0),  ("2026-11-01", 30000000.0),  ("2026-12-01", 26000000.0),
            ("2027-01-01", 14000000.0),  ("2027-02-01", 13000000.0),  ("2027-03-01", 17000000.0),
            ("2027-04-01", 15000000.0),  ("2027-05-01", 32000000.0),  ("2027-06-01", 20000000.0),
            ("2027-07-01", 16000000.0),  ("2027-08-01", 17000000.0),  ("2027-09-01", 18000000.0)
        ],
        919428720: [ # Walmart
            ("2026-10-01", 8000000.0),   ("2026-11-01", 15000000.0),  ("2026-12-01", 13000000.0),
            ("2027-01-01", 6000000.0),   ("2027-02-01", 6000000.0),   ("2027-03-01", 8000000.0),
            ("2027-04-01", 7500000.0),   ("2027-05-01", 16000000.0),  ("2027-06-01", 10000000.0),
            ("2027-07-01", 8000000.0),   ("2027-08-01", 8500000.0),   ("2027-09-01", 9000000.0)
        ],
        962651791: [ # Ripley
            ("2026-10-01", 3200000.0),   ("2026-11-01", 6500000.0),   ("2026-12-01", 5500000.0),
            ("2027-01-01", 2800000.0),   ("2027-02-01", 2500000.0),   ("2027-03-01", 3500000.0),
            ("2027-04-01", 3000000.0),   ("2027-05-01", 7000000.0),   ("2027-06-01", 4500000.0),
            ("2027-07-01", 3500000.0),   ("2027-08-01", 3500000.0),   ("2027-09-01", 4000000.0)
        ],
        936492429: [ # Kitchen Center
            ("2026-10-01", 2500000.0),   ("2026-11-01", 5000000.0),   ("2026-12-01", 4500000.0),
            ("2027-01-01", 2000000.0),   ("2027-02-01", 1800000.0),   ("2027-03-01", 2500000.0),
            ("2027-04-01", 2200000.0),   ("2027-05-01", 5500000.0),   ("2027-06-01", 3500000.0),
            ("2027-07-01", 2500000.0),   ("2027-08-01", 2500000.0),   ("2027-09-01", 3000000.0)
        ]
    }

    for sid, proy_list in chile_proy_map.items():
        prev_val = 0.0
        for p_str, val in proy_list:
            var_m = round((val - prev_val) / prev_val, 4) if prev_val > 0 else 0.0
            all_fact_payload.append({
                "seller_id": sid, "periodo": p_str,
                "valor_facturado": val, "variacion_mensual": var_m, "estado": "PROYECTADO"
            })
            prev_val = val

    print(f"  -> Insertando {len(all_fact_payload)} filas en facturacion...")
    for i in range(0, len(all_fact_payload), 50):
        chunk = all_fact_payload[i:i+50]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/facturacion", headers=HEADERS, json=chunk)
        print(f"     Lote {i//50 + 1}: status {r.status_code}")

def main():
    print("========================================================================")
    print(" SIEMBRA INTEGRAL DE PROYECCIONES PARA NEWSAN (CLIENTE 14) - 12 MESES")
    print("========================================================================")
    step1_update_dim_sellers()
    step2_project_dim_escalas()
    step3_project_tienda_web_metrics()
    step4_project_facturacion()
    print("\n¡Proyecciones de Newsan sembradas con éxito!")

if __name__ == "__main__":
    main()
