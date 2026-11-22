#!/usr/bin/env python3
"""Regenera indice_banco.csv a partir de casos/*.json, con la columna n_recursos.

Uso: indice_banco.py [--casos DIR] [--salida RUTA]
"""
import argparse
import csv
import glob
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
COLUMNAS = ["id", "tipo", "caso_indice_id", "sindrome", "clave_gpc", "archivo_gpc", "guia",
            "respuesta_correcta", "texto_respuesta", "estado", "n_recursos"]


def filas(dir_casos):
    for ruta in sorted(glob.glob(os.path.join(dir_casos, "*.json"))):
        with open(ruta, encoding="utf-8") as fh:
            for c in json.load(fh):
                yield {
                    "id": c["id"], "tipo": c["tipo"], "caso_indice_id": c["caso_indice_id"] or "",
                    "sindrome": c["sindrome"], "clave_gpc": c["gpc_base"]["clave"],
                    "archivo_gpc": c["gpc_base"]["archivo"], "guia": c["gpc_base"]["guia"],
                    "respuesta_correcta": c["respuesta_correcta"],
                    "texto_respuesta": c["opciones"][c["respuesta_correcta"]],
                    "estado": c["estado"], "n_recursos": len(c.get("recursos") or []),
                }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--casos", default=os.path.join(RAIZ, "casos"))
    ap.add_argument("--salida", default=os.path.join(RAIZ, "indice_banco.csv"))
    a = ap.parse_args()
    datos = list(filas(a.casos))
    with open(a.salida, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows(datos)
    print(f"{a.salida}: {len(datos)} casos, {sum(d['n_recursos'] for d in datos)} recursos")


if __name__ == "__main__":
    main()
