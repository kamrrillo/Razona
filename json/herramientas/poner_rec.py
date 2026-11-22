#!/usr/bin/env python3
"""Inserta o reemplaza la clave "rec" de los casos de una fuente sin reformatear el resto del archivo.

Uso: poner_rec.py NNN BORRADOR.json
  BORRADOR.json = {"I": [recursos del índice], "V1": [recursos de la variante]}
  (una clave ausente deja ese caso como está; una lista vacía le quita "rec").

Las fuentes tienen formatos hechos a mano, así que el cambio se hace como texto: se localiza
cada objeto de casos[] y se agrega "rec" como última clave. Al final se comprueba que el
archivo resultante, sin "rec", sea idéntico en contenido al original.
"""
import copy
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
DEC = json.JSONDecoder()


def tramos_casos(texto):
    """(inicio, fin) de cada objeto de casos[] en el texto."""
    m = re.search(r'"casos"\s*:\s*\[', texto)
    i = m.end()
    out = []
    while True:
        while texto[i] in " \t\r\n,":
            i += 1
        if texto[i] == "]":
            return out
        _, fin = DEC.raw_decode(texto, i)
        out.append((i, fin))
        i = fin


def sin_rec(texto_caso, nl):
    """Quita una clave "rec" final ya insertada por este script."""
    k = texto_caso.rfind(f',{nl}  "rec": ')
    return texto_caso if k == -1 else texto_caso[:k] + "}"


def pon(texto, borrador):
    nl = "\r\n" if "\r\n" in texto else "\n"
    original = json.loads(texto)
    partes, prev = [], 0
    for (ini, fin), caso in zip(tramos_casos(texto), original["casos"]):
        bloque = texto[ini:fin]
        if "rec" in caso:
            bloque = sin_rec(bloque, nl)
            if "rec" in json.loads(bloque):
                sys.exit(f"No pude quitar el rec existente del caso {caso['t']}; edítalo a mano.")
        rec = borrador.get(caso["t"], caso.get("rec"))
        if rec:
            cuerpo = json.dumps(rec, ensure_ascii=False, indent=1).replace("\n", nl + "  ")
            bloque = bloque.rstrip()[:-1].rstrip() + f',{nl}  "rec": ' + cuerpo + "}"
        partes += [texto[prev:ini], bloque]
        prev = fin
    partes.append(texto[prev:])
    nuevo = "".join(partes)
    # Comprobación: el contenido sin rec no cambió y el rec es el del borrador.
    a, b = copy.deepcopy(original), json.loads(nuevo)
    for x in a["casos"] + b["casos"]:
        x.pop("rec", None)
    assert a == b, "el contenido de la fuente cambió fuera de rec"
    for caso in json.loads(nuevo)["casos"]:
        if caso["t"] in borrador:
            assert caso.get("rec", []) == borrador[caso["t"]], "rec no quedó igual al borrador"
    return nuevo


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    num, borr = sys.argv[1], sys.argv[2]
    ruta = os.path.join(RAIZ, "fuentes", f"{num}.json")
    with open(ruta, encoding="utf-8", newline="") as fh:
        texto = fh.read()
    with open(borr, encoding="utf-8") as fh:
        borrador = json.load(fh)
    nuevo = pon(texto, borrador)
    tmp = ruta + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as fh:
        fh.write(nuevo)
    os.replace(tmp, ruta)
    n = {t: len(v) for t, v in borrador.items()}
    print(f"{ruta}: rec actualizado {n}")


if __name__ == "__main__":
    main()
