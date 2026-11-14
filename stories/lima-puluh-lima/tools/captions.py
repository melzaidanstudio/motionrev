#!/usr/bin/env python3
"""Build the caption W/PHR arrays from assets/words.json and the phrase spec below, and inject them into
index.html between the markers  // @@CAPTIONS  and  // @@END_CAPTIONS .
Spec: one phrase per line; tokens separated by spaces; '_' joins words into one token (no-break space);
a leading '*' marks the emphasised (boxed) token."""
import json, re, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
SPEC = """
Hari pertama Rani
di kantor baru,
strateginya cuma satu:
disukai *semua_orang.
Dia bilang iya
ke semua permintaan,
makan siang gantian
sama semua orang,
dan nggak pernah
pulang duluan.
Tiga bulan kemudian
dia *capek,
dan tetap bukan orang
yang dipilih
buat proyek_besar.
Yang dipilih
justru *Dimas,
yang jarang ngobrol,
tapi entah kenapa
semua orang percaya
sama dia.
Masalahnya bukan
di usaha Rani,
tapi di *hitungannya.
Kantornya kecil,
*dua_belas orang.
Tapi dua_belas orang
bukan dua_belas *hubungan.
Tiap orang terhubung
ke sebelas lainnya,
totalnya
*enam_puluh_enam hubungan.
Rani cuma ada
di *sebelas di_antaranya.
*Lima_puluh_lima sisanya
terjadi tanpa_dia.
Dan riset Dunbar bilang,
sekitar *dua_pertiga
obrolan manusia
itu soal orang_lain.
Jadi reputasi Rani
dibentuk di *ruangan
yang nggak pernah
dia masuki.
Kalau dia jaga
sebelas hubungan itu
lima_belas_menit sehari,
habis hampir *tiga_jam,
tiap hari.
Itu yang bikin
dia capek:
dia mengurus sebelas_pintu,
padahal yang menentukan
ada di balik
*lima_puluh_lima.
*Dimas nggak begitu.
Dia cuma dekat
sama *tiga_orang:
yang paling lama
di kantor,
yang paling didengar bos,
dan yang paling sering
diajak makan siang.
Tiga orang itu ada
hampir di semua obrolan
yang nggak dia ikuti.
Jadi waktu nama Dimas
disebut,
selalu ada yang bilang:
*"dia_oke_kok."
Rani mulai
mengubah *taktiknya.
Bukan berhenti ramah,
tapi berhenti mencoba
ada di *mana-mana.
Bertahan di kantor
bukan soal
disukai semua_orang.
Tapi soal siapa
yang *membela kamu
saat kamu nggak ada
di ruangan.
"""
words = json.load(open(f"{ROOT}/assets/words.json", encoding="utf-8"))
W, PHR, wi = [], [], 0
for line in SPEC.strip().splitlines():
    toks = line.split()
    a = len(W)
    em = None
    for tok in toks:
        if tok.startswith("*"):
            em = len(W)
            tok = tok[1:]
        parts = tok.split("_")
        start = words[wi][1]
        for p in parts:
            if words[wi][0] != p:
                sys.exit(f"spec/script mismatch at word {wi}: spec '{p}' vs script '{words[wi][0]}'")
            wi += 1
        W.append([" ".join(parts), round(start, 2)])
    ph = {"a": a, "b": len(W) - 1}
    if em is not None:
        ph["em"] = em
    PHR.append(ph)
assert wi == len(words), (wi, len(words))
js = "const W = " + json.dumps(W, ensure_ascii=False) + ";\n      const PHR = " + json.dumps(PHR).replace('"', "") + ";"
html = open(f"{ROOT}/index.html", encoding="utf-8").read()
new = re.sub(r"// @@CAPTIONS.*?// @@END_CAPTIONS", lambda m: "// @@CAPTIONS\n      " + js + "\n      // @@END_CAPTIONS", html, flags=re.S)
open(f"{ROOT}/index.html", "w", encoding="utf-8").write(new)
print(f"{len(W)} tokens, {len(PHR)} phrases, injected" if new != html else "markers not found")
