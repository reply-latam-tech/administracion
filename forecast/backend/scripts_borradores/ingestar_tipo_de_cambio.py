"""
Script de generación de migración e ingesta para Tipo de Cambio (cuentas del exterior).
Lee forecast/backend/scripts_borradores/tipo_de_cambio.txt y:
1. Genera forecast/backend/migrations/03_tabla_tipo_de_cambio.sql con datos REALES y PROYECTADOS (12 meses).
2. Si la tabla ya existe en Supabase, hace un upsert directo mediante la API REST.
"""

import os
import sys
import json
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hnowniqxrtxrrujgnhqj.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TXT_PATH = os.path.join(BASE_DIR, "tipo_de_cambio.txt")
MIGRATION_PATH = os.path.join(os.path.dirname(BASE_DIR), "migrations", "03_tabla_tipo_de_cambio.sql")

def parse_num(val):
    if not val or not val.strip():
        return None
    s = val.strip().replace(" ", "")
    if "." in s and "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    return round(float(s), 4)

def load_data():
    records = []
    if not os.path.exists(TXT_PATH):
        raise FileNotFoundError(f"No se encontró {TXT_PATH}")

    with open(TXT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    for line in lines[1:]:
        parts = line.strip("\r\n").split("\t")
        if not parts or not parts[0].strip():
            continue
        periodo = parts[0].strip()
        while len(parts) < 6:
            parts.append("")
        
        ars = parse_num(parts[1])
        mxn = parse_num(parts[2])
        pen = parse_num(parts[3])
        clp = parse_num(parts[4])
        cop = parse_num(parts[5])

        if any(v is not None for v in [ars, mxn, pen, clp, cop]):
            estado = "REAL" if periodo <= "2026-09" else "PROYECTADO"
            records.append({
                "periodo": f"{periodo}-01",
                "ars": ars,
                "mxn": mxn,
                "pen": pen,
                "clp": clp,
                "cop": cop,
                "moneda_base": "USD",
                "estado": estado
            })
    return records

def generate_migration_sql(records):
    sql_rows = []
    for r in records:
        ars_str = f"{r['ars']:.4f}" if r['ars'] is not None else "NULL"
        mxn_str = f"{r['mxn']:.4f}" if r['mxn'] is not None else "NULL"
        pen_str = f"{r['pen']:.4f}" if r['pen'] is not None else "NULL"
        clp_str = f"{r['clp']:.4f}" if r['clp'] is not None else "NULL"
        cop_str = f"{r['cop']:.4f}" if r['cop'] is not None else "NULL"
        sql_rows.append(f"    ('{r['periodo']}', {ars_str}, {mxn_str}, {pen_str}, {clp_str}, {cop_str}, 'USD', '{r['estado']}')")

    values_block = ",\n".join(sql_rows)

    sql_template = f"""-- ==============================================================================
-- MIGRACIÓN 03: TABLA DE TIPOS DE CAMBIO PARA CUENTAS REGIONALES / EXTERIOR
-- ==============================================================================
-- Almacena la cotización oficial mensual de monedas locales (ARS, MXN, PEN, CLP, COP)
-- con respecto a USD (Moneda Base).
-- Incluye histórico REAL y 12 meses PROYECTADOS para proyecciones futuras.
-- Fuente: forecast/backend/scripts_borradores/tipo_de_cambio.txt
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. REGISTRAR PAÍS PERÚ EN DIM_PAISES (Si no existe)
-- ------------------------------------------------------------------------------
INSERT INTO public.dim_paises (codigo_pais, nombre_pais, moneda_local, simbolo_moneda, bandera_emoji)
VALUES ('PE', 'Perú', 'PEN', 'S/', '🇵🇪')
ON CONFLICT (codigo_pais) DO UPDATE 
SET nombre_pais = EXCLUDED.nombre_pais,
    moneda_local = EXCLUDED.moneda_local,
    simbolo_moneda = EXCLUDED.simbolo_moneda,
    bandera_emoji = EXCLUDED.bandera_emoji;

-- ------------------------------------------------------------------------------
-- 2. TABLA PRINCIPAL: TIPO_DE_CAMBIO (Formato Columnar Mensual)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipo_de_cambio (
    periodo DATE PRIMARY KEY,                   -- Primer día del mes (ej. '2025-01-01')
    ars NUMERIC(14, 4),                         -- Pesos Argentinos por USD
    mxn NUMERIC(14, 4),                         -- Pesos Mexicanos por USD
    pen NUMERIC(14, 4),                         -- Soles Peruanos por USD
    clp NUMERIC(14, 4),                         -- Pesos Chilenos por USD
    cop NUMERIC(14, 4),                         -- Pesos Colombianos por USD
    moneda_base VARCHAR(5) NOT NULL DEFAULT 'USD',
    fuente VARCHAR(50) DEFAULT 'OFICIAL_REPLY',
    estado VARCHAR(20) NOT NULL DEFAULT 'REAL', -- 'REAL' o 'PROYECTADO'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columna estado si ya existía la tabla
ALTER TABLE public.tipo_de_cambio ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'REAL';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.tipo_de_cambio ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso
DROP POLICY IF EXISTS "Permitir lectura publica tipo_de_cambio" ON public.tipo_de_cambio;
CREATE POLICY "Permitir lectura publica tipo_de_cambio"
    ON public.tipo_de_cambio FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir modificacion tipo_de_cambio" ON public.tipo_de_cambio;
CREATE POLICY "Permitir modificacion tipo_de_cambio"
    ON public.tipo_de_cambio FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. VISTA ANALÍTICA NORMALIZADA: V_TIPO_DE_CAMBIO (Unpivot para cruces SQL)
-- ------------------------------------------------------------------------------
-- Facilita joins directos: JOIN v_tipo_de_cambio tc ON tc.periodo = l.periodo AND tc.moneda = l.moneda
CREATE OR REPLACE VIEW public.v_tipo_de_cambio AS
SELECT periodo, 'ARS' AS moneda, moneda_base, ars AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE ars IS NOT NULL
UNION ALL
SELECT periodo, 'MXN' AS moneda, moneda_base, mxn AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE mxn IS NOT NULL
UNION ALL
SELECT periodo, 'PEN' AS moneda, moneda_base, pen AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE pen IS NOT NULL
UNION ALL
SELECT periodo, 'CLP' AS moneda, moneda_base, clp AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE clp IS NOT NULL
UNION ALL
SELECT periodo, 'COP' AS moneda, moneda_base, cop AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE cop IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. POBLAR HISTÓRICO Y PROYECCIONES DESDE TIPO_DE_CAMBIO.TXT
-- ------------------------------------------------------------------------------
INSERT INTO public.tipo_de_cambio (periodo, ars, mxn, pen, clp, cop, moneda_base, estado)
VALUES
{values_block}
ON CONFLICT (periodo) DO UPDATE 
SET ars = EXCLUDED.ars,
    mxn = EXCLUDED.mxn,
    pen = EXCLUDED.pen,
    clp = EXCLUDED.clp,
    cop = EXCLUDED.cop,
    moneda_base = EXCLUDED.moneda_base,
    estado = EXCLUDED.estado,
    updated_at = NOW();

COMMIT;
"""
    os.makedirs(os.path.dirname(MIGRATION_PATH), exist_ok=True)
    with open(MIGRATION_PATH, "w", encoding="utf-8") as f:
        f.write(sql_template)
    print(f"Archivo de migración generado exitosamente en: {MIGRATION_PATH}")

def try_supabase_rest_upsert(records):
    print("Intentando upsert vía REST API de Supabase...")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    url = f"{SUPABASE_URL}/rest/v1/tipo_de_cambio"
    res = requests.post(url, headers=headers, json=records)
    if res.status_code in (200, 201):
        print(f"¡Éxito! Se insertaron/actualizaron {len(records)} registros en Supabase tipo_de_cambio.")
        return True
    elif res.status_code == 404:
        print("La tabla public.tipo_de_cambio aún no ha sido creada en la base de datos.")
        print("-> Es necesario ejecutar el archivo de migración en el SQL Editor de Supabase.")
        return False
    else:
        print(f"Error {res.status_code}: {res.text}")
        return False

def main():
    print("Iniciando procesamiento de tipos de cambio...")
    records = load_data()
    print(f"Se cargaron {len(records)} meses (33 REALES + 12 PROYECTADOS):")
    for r in records[-14:]:
        print(f"  {r['periodo']} | ARS: {r['ars']} | COP: {r['cop']} | Estado: {r['estado']}")

    generate_migration_sql(records)
    try_supabase_rest_upsert(records)

if __name__ == "__main__":
    main()
