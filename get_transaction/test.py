import requests
import pandas as pd
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import time
import json
import openpyxl

# ========== PARTE 1: DESCARGAR TRANSACCIONES ==========
API_URL = "https://api2.warera.io/trpc/transaction.getPaginatedTransactions"
COUNTRY_ID = "6813b6d546e731854c7ac83c"  # Chile
PARAMS_TEMPLATE = {
    "limit": 100,
    "countryId": COUNTRY_ID,
    "transactionType": "trading"
}
HEADERS = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}

def fetch_transactions():
    all_items = []
    cursor = None

    while True:
        params = PARAMS_TEMPLATE.copy()
        if cursor:
            params["cursor"] = cursor

        input_param = json.dumps(params)
        url = f"{API_URL}?input={input_param}"
        res = requests.get(url, headers=HEADERS)

        if res.status_code != 200:
            print(f"❌ Error: {res.status_code}")
            break

        data = res.json()
        items = data["result"]["data"]["items"]
        all_items.extend(items)

        cursor = data["result"]["data"].get("nextCursor")
        if not cursor:
            break
        time.sleep(0.5)
        
    return pd.DataFrame(all_items)


# ========== PARTE 2: ENRIQUECER CON NOMBRES ==========
def fetch_username(user_id):
    if pd.isna(user_id) or user_id in user_cache:
        return
    url = f"https://api2.warera.io/trpc/user.getUserLite?input={{\"userId\":\"{user_id}\"}}"
    try:
        r = requests.get(url)
        user_cache[user_id] = r.json()["result"]["data"]["username"]
    except:
        user_cache[user_id] = user_id

def fetch_country_name(country_id):
    if pd.isna(country_id) or country_id in country_cache:
        return
    url = f"https://api2.warera.io/trpc/country.getCountryById?input={{\"countryId\":\"{country_id}\"}}"
    try:
        r = requests.get(url)
        country_cache[country_id] = r.json()["result"]["data"]["name"]
    except:
        country_cache[country_id] = country_id

# ========== PARTE 3: PROCESAR Y EXPORTAR ==========
def clean_and_export(df):
    # Asegurar tipos numéricos correctos
    df["money"] = df["money"].astype(float)
    df["quantity"] = pd.to_numeric(df["quantity"], errors='coerce')

    # Reemplazar IDs
    df["sellerId"] = df["sellerId"].map(user_cache)
    df["buyerId"] = df["buyerId"].map(user_cache)
    df["sellerCountryId"] = df["sellerCountryId"].map(country_cache)
    df["buyerCountryId"] = df["buyerCountryId"].map(country_cache)

    # Calcular precio por unidad y formato de fecha
    df["moneyPerUnit"] = df["money"] / df["quantity"]
    df["updatedAt"] = pd.to_datetime(df["updatedAt"]).dt.strftime('%d/%m/%Y %H:%M')

    # Seleccionar y renombrar columnas finales
    final_df = df[[
        "sellerCountryId", "sellerId", "itemCode", "quantity",
        "moneyPerUnit", "buyerCountryId", "buyerId", "money", "updatedAt"
    ]].rename(columns={
        "sellerCountryId": "sellerCountry",
        "sellerId": "sellBy",
        "buyerCountryId": "buyerCountry",
        "buyerId": "buyerBy",
        "money": "totalMoney"
    })

    final_df.to_csv("warera_transactions_final.csv", index=False, float_format='%.4f')
    final_df.to_excel("warera_transactions_final.xlsx", index=False)
    print("✅ También exportado como Excel: warera_transactions_final.xlsx")
    print("✅ Archivo exportado: warera_transactions_final.csv")

# ========== EJECUCIÓN ==========
if __name__ == "__main__":
    print("📥 Descargando transacciones...")
    df = fetch_transactions()

    print("🔎 Resolviendo nombres de usuario y países...")
    user_cache = {}
    country_cache = {}

    user_ids = pd.unique(df[["sellerId", "buyerId"]].values.ravel('K'))
    country_ids = pd.unique(df[["sellerCountryId", "buyerCountryId"]].values.ravel('K'))

    with ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(fetch_username, user_ids)
        executor.map(fetch_country_name, country_ids)

    print("📊 Formateando y exportando resultados...")
    print(df[["money", "quantity"]].head())
    print(df.dtypes)
    clean_and_export(df)
    
