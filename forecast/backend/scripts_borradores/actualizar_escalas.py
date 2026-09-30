import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
from supabase import create_client, Client

# Configuración Supabase
SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = "sb_publishable_iFG5G7Msm-Uts45CPebzWA_ERpmVKBU"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def actualizar_escalas_mensuales():
    print("Iniciando actualización de escalas...")

    # 1. Traer todos los sellers que actualizan MENSUALMENTE
    res_sellers = supabase.table("dim_sellers").select("id_seller, nombre_seller").eq("frecuencia_actualizacion", "MENSUAL").execute()
    sellers = res_sellers.data

    if not sellers:
        print("No se encontraron sellers con frecuencia_actualizacion = 'MENSUAL'.")
        return

    # 2. Traer toda la tabla de inflación y guardarla en un diccionario para acceso rápido
    res_inf = supabase.table("inflacion").select("periodo, valor_inflacion, estado").execute()
    inflacion_dict = {row['periodo']: row['valor_inflacion'] for row in res_inf.data}
    inflacion_dict_estado = {row['periodo']: (row.get('estado') or 'REAL') for row in res_inf.data}

    for seller in sellers:
        seller_id = seller['id_seller']
        nombre = seller['nombre_seller']
        print(f"\nProcesando seller: {nombre} ({seller_id})")

        # 3. Buscar el último mes cargado en dim_escalas para este seller
        res_latest = supabase.table("dim_escalas") \
            .select("periodo") \
            .eq("seller_id", seller_id) \
            .order("periodo", desc=True) \
            .limit(1) \
            .execute()
        
        if not res_latest.data:
            print(f"  -> No tiene escalas previas. Saltando...")
            continue
            
        ultimo_periodo_str = res_latest.data[0]['periodo']
        print(f"  -> Último mes cargado: {ultimo_periodo_str}")

        if ultimo_periodo_str not in inflacion_dict:
            print(f"  -> NO tenemos el dato de inflación para {ultimo_periodo_str}. No se puede proyectar el mes siguiente.")
            continue
            
        valor_inflacion = inflacion_dict[ultimo_periodo_str]
        
        # Evitar proyectar si la inflación es 0.0 (valor dummy que usa la FK)
        if valor_inflacion == 0.0:
            print(f"  -> El dato de inflación para {ultimo_periodo_str} es 0.0 (valor temporal). Esperando al dato real para proyectar.")
            continue
        
        # 5. Calcular el nuevo mes (sumar 1 mes)
        ultimo_dt = datetime.strptime(ultimo_periodo_str, "%Y-%m-%d")
        nuevo_dt = ultimo_dt + relativedelta(months=1)
        nuevo_periodo_str = nuevo_dt.strftime("%Y-%m-%d")
        print(f"  -> Creando escalas para el mes siguiente: {nuevo_periodo_str} usando la inflación de {ultimo_periodo_str} ({valor_inflacion*100}%)")

        # Verificar que el nuevo mes no exista ya
        res_check = supabase.table("dim_escalas") \
            .select("id") \
            .eq("seller_id", seller_id) \
            .eq("periodo", nuevo_periodo_str) \
            .limit(1) \
            .execute()
            
        if res_check.data:
            print(f"  -> Las escalas para {nuevo_periodo_str} ya existen. Saltando para no pisar histórico.")
            continue

        # 6. Traer TODAS las filas de la escala del último mes
        res_escalas_previas = supabase.table("dim_escalas") \
            .select("*") \
            .eq("seller_id", seller_id) \
            .eq("periodo", ultimo_periodo_str) \
            .execute()
            
        escalas_viejas = res_escalas_previas.data
        nuevas_escalas = []

        # 7. Multiplicar montos y armar las nuevas filas
        for escala in escalas_viejas:
            viejo_monto = escala['monto_objetivo']
            # Se aplica la inflación al monto
            nuevo_monto = viejo_monto * (1 + valor_inflacion)
            
            nuevas_escalas.append({
                "seller_id": seller_id,
                "periodo": nuevo_periodo_str,
                "tipo_cargo": escala['tipo_cargo'],
                "alicuota": escala['alicuota'],
                "monto_objetivo": round(nuevo_monto, 2),
                "pais": escala['pais'],
                "moneda": escala['moneda'],
                "variacion_mensual": valor_inflacion, # La variación porcentual vs mes anterior es exactamente la inflación aplicada
                "estado": inflacion_dict_estado.get(ultimo_periodo_str, 'REAL')
            })

        # Insertar el periodo en la tabla inflacion si no existe (para evitar error de FK)
        if nuevo_periodo_str not in inflacion_dict:
            try:
                supabase.table("inflacion").insert({
                    "periodo": nuevo_periodo_str,
                    "valor_inflacion": 0.0
                }).execute()
                inflacion_dict[nuevo_periodo_str] = 0.0
            except Exception as e:
                pass # Puede que se haya insertado en el interín o falle silenciosamente

        # 8. Insertar el nuevo bloque de escalas
        if nuevas_escalas:
            res_insert = supabase.table("dim_escalas").insert(nuevas_escalas).execute()
            print(f"  -> Insertadas {len(nuevas_escalas)} filas nuevas para {nuevo_periodo_str}.")

    print("\nProceso finalizado.")

if __name__ == '__main__':
    actualizar_escalas_mensuales()
