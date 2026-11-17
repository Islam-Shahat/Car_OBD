import re
import sys
import unicodedata
import zlib
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

data = Path("docs/samples/report-sample.pdf").read_bytes()

# Parse all PDF indirect objects accurately
headers = list(re.finditer(rb"(?:^|\r|\n)(\d+)\s+0\s+obj\b", data))
objs = {}
for idx, h in enumerate(headers):
    obj_num = int(h.group(1))
    start = h.end()
    end = headers[idx + 1].start() if idx + 1 < len(headers) else len(data)
    body = data[start:end]
    sm = re.search(rb"stream\r?\n(.*?)\r?\nendstream", body, re.DOTALL)
    if sm:
        try:
            objs[obj_num] = (body[: sm.start()], zlib.decompress(sm.group(1)))
        except Exception:
            objs[obj_num] = (body[: sm.start()], sm.group(1))
    else:
        objs[obj_num] = (body, None)

cmaps = {}
all_mapped_chars = set()

for num, (hdr, stream) in objs.items():
    if stream and (b"beginbfchar" in stream or b"beginbfrange" in stream):
        cmap = {}
        for sec in re.finditer(rb"beginbfchar(.*?)endbfchar", stream, re.DOTALL):
            for bf in re.finditer(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", sec.group(1)):
                cid = int(bf.group(1), 16)
                u_hex = bf.group(2).decode("latin1")
                chars = "".join(chr(int(u_hex[i : i + 4], 16)) for i in range(0, len(u_hex), 4))
                cmap[cid] = chars
                for ch in chars:
                    all_mapped_chars.add(ch)
        for sec in re.finditer(rb"beginbfrange(.*?)endbfrange", stream, re.DOTALL):
            for bfr in re.finditer(
                rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", sec.group(1)
            ):
                start_cid = int(bfr.group(1), 16)
                end_cid = int(bfr.group(2), 16)
                base_u = int(bfr.group(3), 16)
                for idx, cid in enumerate(range(start_cid, end_cid + 1)):
                    ch = chr(base_u + idx)
                    cmap[cid] = ch
                    all_mapped_chars.add(ch)
        cmaps[num] = cmap

print(f"Found {len(cmaps)} ToUnicode CMaps")
all_text = "".join(sorted([c for c in all_mapped_chars if not ("\ud800" <= c <= "\udfff")]))
print(f"Total mapped characters across all embedded font subsets: {len(all_text)}")

ar_chars = [c for c in all_mapped_chars if "\u0600" <= c <= "\u06ff" or "\ufb50" <= c <= "\ufefc"]
print(f"Total Arabic characters mapped in fonts: {len(ar_chars)}")
latin_chars = [c for c in all_mapped_chars if "a" <= c.lower() <= "z"]
print(f"Total Latin letters mapped: {len(latin_chars)}")

normalized_chars = {unicodedata.normalize("NFKD", c) for c in all_mapped_chars}
normalized_text = "".join(normalized_chars)
print("\n--- NFKD Normalized Arabic Verification ---")
for word in ["تقرير", "فحص", "المحرك", "الجاهزية", "مؤشرات", "الأكسجين", "مسح الأعطال", "إخلاء المسؤولية"]:
    print(f"Can spell standard '{word}':", all(c in normalized_text for c in word))

# Extract lines from pages to test copy/paste reading order
font_info = {}
for num, (hdr, stream) in objs.items():
    tu = re.search(rb"/ToUnicode\s+(\d+)\s+0\s+R", hdr)
    if tu:
        is_type0 = b"/Subtype /Type0" in hdr
        font_info[num] = (4 if is_type0 else 2, cmaps.get(int(tu.group(1)), {}))

print("\n--- Copy/Paste Text Extraction Order Test ---")
for pnum, target_ys in [
    (2, [401.0, 501.0]),
    (43, [1060.0, 1061.0, 1087.0, 1103.0]),
    (51, [2803.0]),
]:
    if pnum not in objs:
        continue
    hdr = objs[pnum][0]
    cm = re.search(rb"/Contents\s+(\d+)\s+0\s+R", hdr)
    if not cm or b"/Font" not in hdr:
        continue
    c_obj = int(cm.group(1))
    f_sec = hdr.split(b"/Font")[1]
    p_fonts = {}
    for fm in re.finditer(rb"/(F\d+)\s+(\d+)\s+0\s+R", f_sec):
        p_fonts[fm.group(1).decode("latin1")] = font_info.get(int(fm.group(2)), (2, {}))
    c_stream = objs[c_obj][1].decode("latin1")
    lines_by_y = {}
    cur_f = None
    for bt in re.finditer(r"BT(.*?)ET", c_stream, re.DOTALL):
        block = bt.group(1)
        tm = re.search(r"1\s+0\s+0\s+-1\s+([\d.]+)\s+([\d.]+)\s+Tm", block)
        y = float(tm.group(2)) if tm else 0.0
        x = float(tm.group(1)) if tm else 0.0
        out_tj = ""
        out_actual = ""
        in_actual = False
        for line in block.splitlines():
            fm = re.search(r"/(F\d+)\s+[\d.]+\s+Tf", line)
            if fm:
                cur_f = fm.group(1)
            am = re.search(r"/ActualText\s*<FEFF([0-9A-Fa-f]+)>", line)
            if am:
                uh = am.group(1)
                out_actual += "".join(chr(int(uh[i : i + 4], 16)) for i in range(0, len(uh), 4))
                in_actual = True
            for tj in re.finditer(r"<([0-9A-Fa-f]+)>\s*Tj", line):
                hs = tj.group(1)
                step, cmap = p_fonts.get(cur_f, (2, {}))
                s = "".join(cmap.get(int(hs[i : i + step], 16), "") for i in range(0, len(hs), step))
                out_tj += s
                if not in_actual:
                    out_actual += s
            if "EMC" in line:
                in_actual = False
        lines_by_y.setdefault(y, []).append((x, out_tj, out_actual))
    for y in target_ys:
        items = lines_by_y.get(y, [])
        if not items:
            continue
        tj_line = "".join(t for _, t, _ in items)
        act_line = "".join(a for _, _, a in items)
        print(f"Page obj {pnum} Y={y:6.1f} | Stream ToUnicode : {tj_line}")
        print(f"Page obj {pnum} Y={y:6.1f} | Stream ActualText: {act_line}")

