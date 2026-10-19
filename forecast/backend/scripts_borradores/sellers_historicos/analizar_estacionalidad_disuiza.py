import os
import sys
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SELLER_ID = 964690754 # Disuiza Colombia

headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
fact = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&order=periodo.asc", headers=headers).json()

# Tipos de cambio proyectados y reales
tc_map = {}
txt_path = os.path.join(os.path.dirname(__file__), "..", "tipo_de_cambio.txt")
with open(txt_path, "r", encoding="utf-8") as f:
    for line in f.readlines()[1:]:
        p = line.strip().split("\t")
        if len(p) >= 6 and p[5].strip():
            cop_str = p[5].strip().replace(".", "").replace(",", ".")
            tc_map[p[0].strip()] = float(cop_str)

meses_nombres = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
}

mes_map = {}
for f in fact:
    p = f["periodo"]
    mm = p[5:7]
    val = f["valor_facturado"]
    if mm not in mes_map:
        mes_map[mm] = []
    mes_map[mm].append(val)

total_avg = sum([f["valor_facturado"] for f in fact]) / len(fact)
print(f"Promedio general histórico (30 meses): {total_avg:,.0f} COP\n")

print(f"{'Mes':<12} | {'Años con datos':>14} | {'Promedio COP':>15} | {'Índice Estacional':>17}")
print("-" * 65)

indices = {}
for mm in sorted(mes_map.keys()):
    vals = mes_map[mm]
    avg = sum(vals) / len(vals)
    idx = avg / total_avg
    indices[mm] = idx
    print(f"{meses_nombres[mm]:<12} | {len(vals):>14} | {avg:>15,.0f} | {idx:>16.2f}x")

# Proyectar próximos 12 meses (2026-10 a 2027-09)
# Tomar como run-rate base el promedio reciente 2026 (~128M COP)
run_rate_base = 128300000.0
g_monthly = 0.012 # +1.2% mensual compuesto

print("\n--- SIMULACIÓN PROYECCIÓN 12 MESES DISUIZA (2026-10 a 2027-09) ---")
print(f"{'Periodo':<8} | {'Facturación COP':>15} | {'TC COP/USD':>10} | {'Facturación USD':>15} | {'Comisión 2%':>12} | {'Fee Reply USD':>15} | {'Modalidad'}")
print("-" * 95)

proyecciones = []
proy_meses = [
    ("2026-10-01", "10"), ("2026-11-01", "11"), ("2026-12-01", "12"),
    ("2027-01-01", "01"), ("2027-02-01", "02"), ("2027-03-01", "03"),
    ("2027-04-01", "04"), ("2027-05-01", "05"), ("2027-06-01", "06"),
    ("2027-07-01", "07"), ("2027-08-01", "08"), ("2027-09-01", "09"),
]

for t, (p_str, mm) in enumerate(proy_meses, start=1):
    m_key = p_str[:7]
    s_factor = indices.get(mm, 1.0)
    # Crecimiento compuesto
    cop_proy = round(run_rate_base * s_factor * ((1 + g_monthly) ** t), 0)
    tc = tc_map.get(m_key, 3350.0)
    usd_proy = round(cop_proy / tc, 2)
    comision_2pct = round(usd_proy * 0.02, 2)
    fee_final = max(1500.0, comision_2pct)
    modalidad = "MINIMO ($1,500)" if fee_final == 1500.0 else "PORCENTUAL (2%)"
    proyecciones.append({
        "periodo": p_str,
        "cop": cop_proy,
        "tc": tc,
        "usd": usd_proy,
        "comision_2pct": comision_2pct,
        "fee": fee_final,
        "modalidad": modalidad
    })
    print(f"{m_key:<8} | {cop_proy:>15,.0f} | {tc:>10.2f} | {usd_proy:>15,.2f} | {comision_2pct:>12,.2f} | {fee_final:>15,.2f} | {modalidad}")

print("-" * 95)
total_proy_cop = sum([p["cop"] for p in proyecciones])
total_proy_usd = sum([p["usd"] for p in proyecciones])
total_proy_fee = sum([p["fee"] for p in proyecciones])
print(f"Total 12M Proyectados -> COP: ${total_proy_cop:,.0f} | USD: ${total_proy_usd:,.2f} | Fee Total Reply: ${total_proy_fee:,.2f} USD")
