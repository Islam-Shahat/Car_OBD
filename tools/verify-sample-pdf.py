import re
import zlib
from pathlib import Path

data = Path("docs/samples/report-sample.pdf").read_bytes()
cmaps = []
for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", data, re.DOTALL):
    try:
        s = zlib.decompress(m.group(1))
        if b"beginbfchar" in s:
            cmaps.append(s)
    except Exception:
        pass

print(f"Found {len(cmaps)} ToUnicode CMaps")
all_mapped_chars = set()

for c in cmaps:
    for bf in re.finditer(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", c):
        u_hex = bf.group(2).decode("latin1")
        for i in range(0, len(u_hex), 4):
            val = int(u_hex[i:i+4], 16)
            all_mapped_chars.add(chr(val))

all_text = "".join(sorted(all_mapped_chars))
print(f"Total mapped characters across all embedded font subsets: {len(all_text)}")
print("Mapped chars preview:\n", all_text[:200])

# Check for Arabic letters
ar_chars = [c for c in all_mapped_chars if '\u0600' <= c <= '\u06ff' or '\ufb50' <= c <= '\ufefc']
print(f"Total Arabic characters mapped in fonts: {len(ar_chars)}")
print("Arabic chars sample:", "".join(ar_chars[:40]))

# Check for digits & Latin
latin_chars = [c for c in all_mapped_chars if 'a' <= c.lower() <= 'z']
print(f"Total Latin letters mapped: {len(latin_chars)}")
print("Latin letters sample:", "".join(latin_chars[:30]))

# Check if expected words can be formed
print("Can spell 'تقرير':", all(c in all_mapped_chars for c in "تقرير"))
print("Can spell 'OBD Diagnose':", all(c in all_mapped_chars for c in "OBD Diagnose"))

# Check Arabic presentation forms
print("Contains Initial Feh (ﻓ):", '\ufed7' in all_mapped_chars)
print("Contains Medial Hah (ﺤ):", '\ufea4' in all_mapped_chars)
print("Contains Final Sad (ﺺ):", '\ufeba' in all_mapped_chars)
print("Shaped Arabic 'فحص' (ﻓﺤﺺ) glyphs present:", '\ufed7' in all_mapped_chars and '\ufea4' in all_mapped_chars and '\ufeba' in all_mapped_chars)

# Normalize Arabic presentation forms to standard Arabic characters
import unicodedata
normalized_chars = {unicodedata.normalize('NFKD', c) for c in all_mapped_chars}
normalized_text = "".join(normalized_chars)
print("\n--- NFKD Normalized Arabic Verification ---")
print("Can spell standard 'فحص':", all(c in normalized_text for c in "فحص"))
print("Can spell standard 'المحرك':", all(c in normalized_text for c in "المحرك"))
print("Can spell standard 'الجاهزية':", all(c in normalized_text for c in "الجاهزية"))
print("Can spell standard 'مؤشرات':", all(c in normalized_text for c in "مؤشرات"))
print("Can spell standard 'الأكسجين':", all(c in normalized_text for c in "الأكسجين"))
print("Can spell standard 'مسح الأعطال':", all(c in normalized_text for c in "مسح الأعطال"))
print("Can spell standard 'إخلاء المسؤولية':", all(c in normalized_text for c in "إخلاء المسؤولية"))
