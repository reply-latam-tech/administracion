import urllib.request
import json
import os

SELLER_ID = "447463711"
# NOTA: Reemplazá esto con un Access Token válido de Mercado Libre
ACCESS_TOKEN = "APP_USR-..." 

def fetch_seller_info():
    url = f"https://api.mercadolibre.com/users/{SELLER_ID}"
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {ACCESS_TOKEN}')
    req.add_header('User-Agent', 'Mozilla/5.0')
    
    try:
        print(f"Obteniendo info del seller {SELLER_ID}...")
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read())
            
            # Guardar la info en dapsa.txt
            out_file = 'dapsa.txt'
            with open(out_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
                
            print(f"✅ ¡Éxito! Información guardada correctamente en {out_file}")
            
    except Exception as e:
        print(f"❌ Error al consultar la API: {e}")
        if hasattr(e, 'read'):
            print(e.read().decode())

if __name__ == "__main__":
    fetch_seller_info()
