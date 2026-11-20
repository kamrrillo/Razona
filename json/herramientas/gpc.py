#!/usr/bin/env python3
"""Consulta del texto de las GPC por página del PDF.

Uso:
  gpc.py toc CLAVE                 encabezados numerados con su página
  gpc.py buscar CLAVE REGEX [N]    coincidencias con página (N = caracteres de contexto)
  gpc.py pag CLAVE INI [FIN]       texto de las páginas (compactado)
  gpc.py seccion CLAVE PAG         último encabezado numerado en o antes de PAG

CLAVE es el número del archivo, p. ej. 032 (archivo 032GER.pdf).
Las páginas son las del archivo PDF, contadas desde 1.
"""
import re
import sys
import glob
import os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gpc_paginas")
HEAD = re.compile(r"^\s{0,12}(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+([A-ZÁÉÍÓÚÑ][^\n]{3,90})$")


def ruta(clave, raw=False):
    pat = os.path.join(BASE, f"{clave}GER*.{'raw.' if raw else ''}txt")
    cand = [p for p in glob.glob(pat) if raw or not p.endswith(".raw.txt")]
    if not cand:
        sys.exit(f"No encuentro la guía {clave}")
    return cand[0]


def paginas(clave, raw=False):
    with open(ruta(clave, raw), encoding="utf-8") as fh:
        return fh.read().split("\f")


def compacta(t):
    out = []
    for ln in t.splitlines():
        ln = re.sub(r" {3,}", " · ", ln.strip())
        if ln:
            out.append(ln)
    return "\n".join(out)


def encabezados(clave):
    res = []
    for i, p in enumerate(paginas(clave), 1):
        for ln in p.splitlines():
            m = HEAD.match(ln)
            if m and not re.search(r"\.{4,}|…", ln):
                titulo = re.sub(r"\s{2,}.*$", "", m.group(2)).strip()
                res.append((i, m.group(1), titulo))
    return res


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, clave = sys.argv[1], sys.argv[2]
    if cmd == "toc":
        for pg, num, tit in encabezados(clave):
            print(f"p{pg:>3}  {num:<8} {tit}")
    elif cmd == "buscar":
        rx = re.compile(sys.argv[3], re.I)
        ctx = int(sys.argv[4]) if len(sys.argv) > 4 else 120
        for i, p in enumerate(paginas(clave, raw=True), 1):
            plano = re.sub(r"\s+", " ", p)
            for m in rx.finditer(plano):
                a, b = max(0, m.start() - ctx), min(len(plano), m.end() + ctx)
                print(f"p{i}: …{plano[a:b]}…")
    elif cmd == "pag":
        ini = int(sys.argv[3])
        fin = int(sys.argv[4]) if len(sys.argv) > 4 else ini
        ps = paginas(clave)
        for i in range(ini, fin + 1):
            print(f"===== PÁGINA PDF {i} =====")
            print(compacta(ps[i - 1]))
    elif cmd == "seccion":
        pg = int(sys.argv[3])
        prev = [e for e in encabezados(clave) if e[0] <= pg]
        print(prev[-1] if prev else "sin encabezado")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
