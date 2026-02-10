
import re

file_path = "c:/Users/Taikutsu Lyrz/Desktop/invoice/src/renderer/contexts/LanguageContext.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract en block
en_match = re.search(r"en: \{([\s\S]*?)\},", content)
fa_match = re.search(r"fa: \{([\s\S]*?)\},", content)

if not en_match or not fa_match:
    print("Could not find en or fa blocks")
    exit(1)

en_block = en_match.group(1)
fa_block = fa_match.group(1)

def extract_keys(block):
    keys = set()
    for line in block.split('\n'):
        # Match 'key': 'value'
        m = re.search(r"^\s*'([\w\.]+)'\s*:", line)
        if m:
            keys.add(m.group(1))
    return keys

en_keys = extract_keys(en_block)
fa_keys = extract_keys(fa_block)

missing_in_fa = en_keys - fa_keys
missing_in_en = fa_keys - en_keys

print(f"Total EN keys: {len(en_keys)}")
print(f"Total FA keys: {len(fa_keys)}")

if missing_in_fa:
    print("Missing in FA:")
    for k in sorted(missing_in_fa):
        print(f"  {k}")
else:
    print("No keys missing in FA.")

if missing_in_en:
    print("Missing in EN (Extra in FA):")
    for k in sorted(missing_in_en):
        print(f"  {k}")
