from google.oauth2 import service_account
from google.cloud import bigquery

CREDENTIALS_PATH = r'c:\Users\matia\OneDrive\Escritorio\reply\proyecto_facturacion_admin\bi-acco-b0f31f4abbe6.json'
credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
bq = bigquery.Client(credentials=credentials, project='bi-acco')

retail_data = {
  '2026-01-01': 12190560.0,
  '2026-02-01': 11071928.0,
  '2026-03-01': 14735858.34,
  '2026-04-01': 21062209.39,
  '2026-05-01': 19152880.36,
  '2026-06-01': 16733404.10,
  '2026-07-01': 28083559.97,
  '2026-08-01': 34702657.36,
  '2026-09-01': 30431254.20,
  '2026-10-01': 3131338.06
}

print('Borrando datos viejos...')
bq.query("DELETE FROM `bi-acco.facturacion.stg_facturacion_retail` WHERE seller_name = 'Juan Valdez'").result()

print('Insertando orders nuevos...')
for d, m in retail_data.items():
    bq.query(f"INSERT INTO `bi-acco.facturacion.stg_facturacion_retail` (periodo, seller_name, monto_facturado) VALUES ('{d}', 'Juan Valdez', {m})").result()

print('Listo.')
