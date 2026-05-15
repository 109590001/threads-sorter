import pandas as pd
import json

# 讀取 Excel
file_path = "threads_second2.0.xlsx"

# 如果不是第一個工作表可以改 sheet_name
df = pd.read_excel(file_path)

# D欄 = content
# AX欄 = id
# Excel 第3列開始 -> pandas index 2開始
contents = df.iloc[2:, 3]   # D欄
ids = df.iloc[2:, 49]       # AX欄

result = []

for word_id, content in zip(ids, contents):
    # 跳過空值
    if pd.isna(content) or pd.isna(word_id):
        continue

    result.append({
        "id": str(word_id).strip(),
        "content": str(content).strip()
    })

# 輸出 JSON
with open("words.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"完成，共輸出 {len(result)} 筆資料到 words.json")