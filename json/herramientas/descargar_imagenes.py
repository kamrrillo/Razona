#!/usr/bin/env python3
"""Descarga las imágenes de los recursos y verifica su sha256.

Uso: descargar_imagenes.py [--solo NNN ...] [--forzar] [--actualizar]
  Recorre fuentes/*.json; por cada recurso de tipo imagen descarga url_imagen a su "archivo"
  (relativo a la raíz del banco, p. ej. assets/RZ-PED-032-I-R6.png) si no existe o con --forzar,
  calcula el sha256 y lo compara con el de la fuente.
  --actualizar  escribe en la fuente el sha256 calculado cuando falta o no coincide
                (con poner_rec, sin reformatear el resto del archivo).
  Escribe reportes/imagenes.csv con: id, caso, url_pagina, licencia, resultado.
"""
import argparse
import csv
import glob
import hashlib
import json
import os
import sys
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
sys.path.insert(0, AQUI)
import poner_rec  # noqa: E402

# Wikimedia rechaza (HTTP 429) los agentes que imitan a un navegador; usar uno descriptivo.
# upload.wikimedia.org también puede dar 429: usar la URL thumb.wikimedia.org que da la API de Commons.
AGENTE = "edu-image-fetch/1.0 (python-urllib; educational use)"
FIRMAS = {b"\x89PNG": "png", b"\xff\xd8\xff": "jpg", b"GIF8": "gif", b"RIFF": "webp", b"<svg": "svg", b"<?xm": "svg"}


def baja(url, destino):
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(req, timeout=60) as resp:
        datos = resp.read()
        tipo = resp.headers.get("Content-Type", "")
    if not (tipo.startswith("image/") or any(datos.startswith(f) for f in FIRMAS)):
        raise ValueError(f"no es una imagen ({tipo or 'sin Content-Type'})")
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    tmp = destino + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(datos)
    os.replace(tmp, destino)


def sha256(ruta):
    with open(ruta, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo", nargs="*")
    ap.add_argument("--forzar", action="store_true")
    ap.add_argument("--actualizar", action="store_true")
    a = ap.parse_args()
    filas, fallos = [], 0
    for ruta in sorted(glob.glob(os.path.join(RAIZ, "fuentes", "*.json"))):
        num = os.path.basename(ruta)[:3]
        if a.solo and num not in a.solo:
            continue
        with open(ruta, encoding="utf-8", newline="") as fh:
            texto = fh.read()
        f = json.loads(texto)
        cambios = {}
        for caso in f["casos"]:
            cid = f"RZ-PED-{num}-{caso['t']}"
            for r in caso.get("rec") or []:
                if r.get("tipo") != "imagen":
                    continue
                rid = f"{cid}-R{r['n']}"
                destino = os.path.join(RAIZ, r.get("archivo", ""))
                try:
                    if a.forzar or not os.path.isfile(destino):
                        baja(r["url_imagen"], destino)
                        resultado = "descargado"
                    else:
                        resultado = "ya existía"
                    h = sha256(destino)
                    if r.get("sha256") == h:
                        resultado += "; sha256 ok"
                    elif a.actualizar:
                        r["sha256"] = h
                        cambios[caso["t"]] = caso["rec"]
                        resultado += "; sha256 escrito en la fuente"
                    else:
                        resultado += f"; sha256 distinto ({h})"
                        fallos += 1
                except Exception as e:  # noqa: BLE001 — se reporta en el CSV
                    resultado = f"error: {e}"
                    fallos += 1
                filas.append({"id": rid, "caso": cid, "url_pagina": r.get("url_pagina", ""),
                              "licencia": r.get("licencia", ""), "resultado": resultado})
                print(rid, resultado)
        if cambios:
            nuevo = poner_rec.pon(texto, cambios)
            with open(ruta + ".tmp", "w", encoding="utf-8", newline="") as fh:
                fh.write(nuevo)
            os.replace(ruta + ".tmp", ruta)
    os.makedirs(os.path.join(RAIZ, "reportes"), exist_ok=True)
    salida = os.path.join(RAIZ, "reportes", "imagenes.csv")
    previas = []
    if a.solo and os.path.exists(salida):
        with open(salida, encoding="utf-8", newline="") as fh:
            previas = [x for x in csv.DictReader(fh) if x["caso"][7:10] not in a.solo]
    todas = sorted(previas + filas, key=lambda x: x["id"])
    with open(salida, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["id", "caso", "url_pagina", "licencia", "resultado"])
        w.writeheader()
        w.writerows(todas)
    print(f"{salida}: {len(todas)} imágenes; {fallos} con problemas en esta corrida")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
