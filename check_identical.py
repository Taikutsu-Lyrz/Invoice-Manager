
import re

file_path = "c:/Users/Taikutsu Lyrz/Desktop/invoice/src/renderer/contexts/LanguageContext.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

en_match = re.search(r"en: \{([\s\S]*?)\},", content)
fa_match = re.search(r"fa: \{([\s\S]*?)\},", content)

en_block = en_match.group(1)
fa_block = fa_match.group(1)

def extract_key_values(block):
    kv = {}
    for line in block.split('\n'):
        m = re.search(r"^\s*'([\w\.]+)':\s*'(.*)',", line)
        if m:
            kv[m.group(1)] = m.group(2)
    return kv

en_kv = extract_key_values(en_block)
fa_kv = extract_key_values(fa_block)

print("Checking for identical values...")
for k, v in en_kv.items():
    if k in fa_kv:
        if fa_kv[k] == v:
            print(f"Identical value for {k}: '{v}'")

