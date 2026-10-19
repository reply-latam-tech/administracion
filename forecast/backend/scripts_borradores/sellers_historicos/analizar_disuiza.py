import os
import sys
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://hnowniqxrtxrrujgnhqj.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SELLER_ID = 964690754 # Disuiza Colombia

headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

# Facturación
fact = requests.get(f"{SUPABASE_URL}/rest/v1/facturacion?seller_id=eq.{SELLER_ID}&order=periodo.asc", headers=headers).json()

# Tipo de Cambio
tc_map = {}
txt_path = os.path.join(os.path.dirname(__file__), "..", "tipo_de_cambio.txt")
with open(txt_path, "r", encoding="utf-8") as f:
    for line in f.readlines()[1:]:
        p = line.strip().split("\t")
        if len(p) >= 6 and p[5].strip():
            cop_str = p[5].strip().replace(".", "").replace(",", ".")
            tc_map[p[0].strip()] = float(cop_str)

print(f"Total registros facturacion Disuiza: {len(fact)}")
print("\n--- DETALLE REAL 2026 DISUIZA ---")
print(f"{'Periodo':<8} | {'Facturación COP':>15} | {'TC COP/USD':>10} | {'Facturación USD':>15} | {'Comisión 2%':>12} | {'Fee Cobrado USD':>15} | {'Modalidad'}")
print("-" * 95)

total_usd = 0.0
total_fee = 0.0

for f in fact:
    m = f["periodo"][:7]
    if m >= "2026-01":
        cop = f["valor_facturado"]
        tc = tc_map.get(m, 3300.0)
        usd = cop / tc if tc else 0.0
        fee_calc = usd * 0.02
        fee_final = max(1500.0, fee_calc)
        tipo = "MINIMO ($1,500)" if fee_final == 1500.0 else "PORCENTUAL (2%)"
        total_usd += usd
        total_fee += fee_final
        print(f"{m:<8} | {cop:>15,.0f} | {tc:>10.2f} | {usd:>15,.2f} | {fee_calc:>12,.2f} | {fee_final:>15,.2f} | {tipo}")

print("-" * 95)
print(f"Total Real 2026 (9 meses) -> Facturación USD: ${total_usd:,.2f} | Fees Reply: ${total_fee:,.2f} USD")
