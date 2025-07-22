import pandas as pd

# Limpiar y re-guardar archivo CSV
csv_file = "warera_transactions_final.csv"
df_csv = pd.read_csv(csv_file, encoding="utf-8-sig")  # BOM-safe lectura
df_csv.to_csv(csv_file, index=False, encoding="utf-8")  # Guardar sin BOM
print(f"✅ CSV limpio guardado como: {csv_file}")

# Limpiar y re-guardar archivo Excel
xlsx_file = "warera_transactions_final.xlsx"
df_xlsx = pd.read_excel(xlsx_file, engine="openpyxl")
df_xlsx.to_excel(xlsx_file, index=False, engine="openpyxl")
print(f"✅ Excel limpio guardado como: {xlsx_file}")
