"""
Converte requirements.txt para UTF-8 no build Docker (evita falha do pip com UTF-16 do Windows).
"""
from pathlib import Path

p = Path("requirements.txt")
b = p.read_bytes()

if b.startswith(b"\xff\xfe"):
    text = b.decode("utf-16-le")
elif b.startswith(b"\xfe\xff"):
    text = b.decode("utf-16-be")
elif b.startswith(b"\xef\xbb\xbf"):
    text = b[3:].decode("utf-8")
elif b"\x00" in b[: min(120, len(b))]:
    text = b.decode("utf-16-le", errors="replace")
else:
    text = b.decode("utf-8", errors="replace").replace("\x00", "")

lines = [
    ln.strip()
    for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    if ln.strip() and not ln.strip().startswith("#")
]
p.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
