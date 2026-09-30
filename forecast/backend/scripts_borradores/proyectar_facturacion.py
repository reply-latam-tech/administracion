import os
import math
from datetime import datetime
from dateutil.relativedelta import relativedelta
from supabase import create_client

# Configuración Supabase
url = "https://hnowniqxrtxrrujgnhqj.supabase.co"
key = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase = create_client(url, key)

def main():
    print("Iniciando motor de proyección de facturación...")

    # 1. Ejecutar RPC para recalcular la estacionalidad con los datos más frescos
    print("1. Recalculando estacionalidad en la base de datos...")
    try:
        supabase.rpc("calcular_estacionalidad").execute()
    except Exception as e:
        print(f"Error al calcular estacionalidad: {e}")
        return

    # 2. Borrar las proyecciones anteriores para recalcular todo en limpio
    print("2. Limpiando proyecciones anteriores en tabla facturacion...")
    supabase.table("facturacion").delete().eq("estado", "PROYECTADO").execute()

    # 3. Traer tabla de inflación para el cálculo del factor nominal
    res_inf = supabase.table("inflacion").select("*").order("periodo").execute()
    inflacion_data = res_inf.data
    max_periodo = max([x["periodo"] for x in inflacion_data]) if inflacion_data else None
    
    # Función que simula la lógica de la vista (de real a nominal)
    # Si tenemos un valor "real" a precios del max_periodo, para llevarlo al periodo_origen (nominal),
    # hay que dividirlo por este factor.
    def get_factor_inflacion(periodo_origen):
        factor = 1.0
        for r in inflacion_data:
            if r["periodo"] > periodo_origen and r["periodo"] <= max_periodo:
                factor *= (1.0 + float(r["valor_inflacion"]))
        return factor

    # 4. Traer todos los sellers
    res_sellers = supabase.table("dim_sellers").select("*").execute()
    sellers = res_sellers.data

    # 5. Iterar por seller para proyectar
    for seller in sellers:
        seller_id = seller["id_seller"]
        print(f"\nProcesando proyecciones para seller: {seller['nombre_seller']} ({seller_id})")

        # A. Traer los índices mensuales de este seller
        res_est = supabase.table("estacionalidad_mensual").select("*").eq("seller_id", seller_id).execute()
        est_mensual = {row["mes"]: float(row["indice_peso"]) for row in res_est.data}

        # Traer índices de DOM para extrapolar mes actual
        res_est_diaria = supabase.table("estacionalidad_diaria").select("*").eq("seller_id", seller_id).execute()
        est_diaria_dom = {}
        for r in res_est_diaria.data:
            if r["tipo"] == "DIA_MES":
                est_diaria_dom[r["llave"]] = float(r["indice_peso"])

        # B. Determinar el último mes "REAL" cerrado para este seller
        res_real = supabase.table("facturacion_real_historica") \
            .select("*") \
            .eq("seller_id", seller_id) \
            .eq("estado", "REAL") \
            .order("periodo_origen", desc=True) \
            .execute()
        
        if not res_real.data:
            print(f"  -> No hay datos reales para {seller_id}, saltando...")
            continue
            
        ultimo_mes_real = res_real.data[0]["periodo_origen"]
        
        # C. Calcular el VOLUMEN BASE PURO (Promedio de los últimos 3 meses reales)
        ultimos_3 = res_real.data[:3]
        volumen_base_real = sum([float(x["valor_real"]) for x in ultimos_3]) / len(ultimos_3)
        print(f"  -> Volumen base mensual a precios de {max_periodo}: ${volumen_base_real:,.2f}")

        # D. Generar las proyecciones para los meses futuros (hasta donde haya inflación proyectada)
        proyecciones_insertar = []
        for inf_row in inflacion_data:
            if inf_row["periodo"] <= ultimo_mes_real:
                continue # Ya es pasado
                
            mes_futuro_str = inf_row["periodo"]
            
            # Buscar si hay órdenes reales en ese mes (ej. estamos a mitad de mes)
            mes_start = mes_futuro_str
            # fin de mes aproximado (+31 dias, truncado a mes)
            dt_start = datetime.strptime(mes_start, "%Y-%m-%d")
            dt_next = dt_start + relativedelta(months=1)
            mes_end = dt_next.strftime("%Y-%m-%d")
            
            # Buscar si el mes es el actual revisando la tabla de seguimiento diario
            res_diario = supabase.table("seguimiento_diario_proyecciones") \
                .select("*") \
                .eq("seller_id", seller_id) \
                .gte("fecha", mes_start) \
                .lt("fecha", mes_end) \
                .order("fecha", desc=True) \
                .limit(1) \
                .execute()
                
            volumen_nominal_proyectado = 0
            
            if res_diario.data and len(res_diario.data) > 0:
                # 1. ESTAMOS EN EL MES CORRIENTE
                diario_data = res_diario.data[0]
                ventas_hasta_ahora = float(diario_data["facturacion_acumulada_mes"])
                dias_transcurridos = int(diario_data["dias_transcurridos"])
                dias_totales_mes = int(diario_data["total_dias_mes"])
                
                # Extrapolación lineal basada en el promedio diario
                if dias_transcurridos > 0:
                    volumen_nominal_proyectado = (ventas_hasta_ahora / dias_transcurridos) * dias_totales_mes
                else:
                    volumen_nominal_proyectado = ventas_hasta_ahora
                    
                print(f"    - Proyectando {mes_futuro_str} por PROMEDIO DIARIO: Ventas=${ventas_hasta_ahora:,.0f} (Día {dias_transcurridos}/{dias_totales_mes}) -> Nominal=${int(volumen_nominal_proyectado):,}")
            else:
                # 2. ES UN MES COMPLETAMENTE FUTURO (Usar tendencia + inflación)
                mes_num = int(mes_futuro_str.split("-")[1])
                peso = est_mensual.get(mes_num, 1.0)
                volumen_real_esperado = volumen_base_real * peso
                factor = get_factor_inflacion(mes_futuro_str)
                volumen_nominal_proyectado = volumen_real_esperado / factor
                print(f"    - Proyectando {mes_futuro_str} por TENDENCIA: Peso={peso:.2f} | Nominal=${int(volumen_nominal_proyectado):,}")
            
            proyecciones_insertar.append({
                "seller_id": seller_id,
                "periodo": mes_futuro_str,
                "valor_facturado": int(volumen_nominal_proyectado),
                "estado": "PROYECTADO"
            })

        # E. Insertar en bloque en Supabase
        if proyecciones_insertar:
            supabase.table("facturacion").insert(proyecciones_insertar).execute()
            print(f"  -> Insertadas {len(proyecciones_insertar)} proyecciones con éxito.")

    print("\n¡Proceso finalizado exitosamente!")

if __name__ == "__main__":
    main()
