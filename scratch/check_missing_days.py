import os
import requests
from datetime import datetime

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://hnowniqxrtxrrujgnhqj.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_KEY:
    print("Error: SUPABASE_SERVICE_ROLE_KEY not set")
    exit(1)

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

print("Fetching active sellers...")
res = requests.get(f"{SUPABASE_URL}/rest/v1/dim_sellers?select=id_seller,nombre_seller", headers=headers)
if res.status_code != 200:
    print(f"Error fetching sellers: {res.text}")
    exit(1)

sellers = res.json()

print(f"\nFound {len(sellers)} sellers. Checking last order date for each...\n")

now = datetime.now()
print(f"{'Seller Name':<25} | {'Seller ID':<12} | {'Last Order Date':<20} | {'Missing Days'}")
print("-" * 75)

for seller in sellers:
    seller_id = seller['id_seller']
    name = seller['nombre_seller']
    
    # Get the latest order for this seller
    url = f"{SUPABASE_URL}/rest/v1/ordenes?select=date_created&seller_id=eq.{seller_id}&order=date_created.desc&limit=1"
    res = requests.get(url, headers=headers)
    
    if res.status_code == 200:
        orders = res.json()
        if orders:
            last_date_str = orders[0]['date_created']
            # Parse ISO date, ignore timezone for simple diff
            last_date = datetime.fromisoformat(last_date_str.replace('Z', '+00:00')).replace(tzinfo=None)
            diff = (now - last_date).days
            print(f"{name:<25} | {seller_id:<12} | {last_date_str[:10]:<20} | {diff} days")
        else:
            print(f"{name:<25} | {seller_id:<12} | {'No orders found':<20} | N/A")
    else:
        print(f"{name:<25} | {seller_id:<12} | Error fetching orders")

print("\nDone.")
