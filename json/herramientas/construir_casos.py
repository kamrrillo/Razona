#!/usr/bin/env python3
"""Expande las fuentes compactas (fuentes/NNN.json) a casos completos (casos/RZ-PED-NNN.json).

Formato compacto por guía:
{
  "archivo": "029GER.pdf", "clave": "IMSS-029-08", "guia": "Título completo", "sindrome": "slug",
  "casos": [
    {"t": "I" | "V1", "vineta": "...", "pregunta": "...¿?", "op": [A, B, C, D, E], "rc": "B",
     "pc":  [[texto, seccion, pagina, fragmento], ...],
     "rub": [[tipo_error, descripcion, [opciones], [señales], pregunta_socratica, explicacion,
              seccion, pagina, fragmento], ...]}
  ]
}
Una cita sin respaldo se escribe como ["SIN_RESPALDO_GPC", motivo] en lugar de seccion, pagina, fragmento.

Recursos de aprendizaje (opcional): cada caso puede llevar "rec", una lista de objetos
{"n": 1, "tipo": ..., "concepto": ..., "para_errores": [...], "mostrar": "despues_de_responder", ...campos del tipo}
con las citas en formato compacto [seccion, pagina, fragmento] ("cita" o, en diagramas, "citas").
Se expanden a "recursos" con id <id del caso>-R<n> y estado "borrador"; esos casos pasan a la versión
VERSION_REC con fecha FECHA_REC.

Archivos que lee además de fuentes/:
  letras.json      letra correcta fija por caso. Un caso nuevo recibe la letra menos usada
                   y se agrega al archivo; las existentes nunca cambian (agregar una guía no
                   mueve las respuestas de los casos que ya estaban).
  revisiones.json  estado de revisión médica por caso (borrador si no aparece).

Uso:
  python3 herramientas/construir_casos.py                 # escribe casos/ y actualiza letras.json
  python3 herramientas/construir_casos.py --check         # no escribe; sale con 1 si casos/ no está al día
  python3 herramientas/construir_casos.py --solo 032 062  # escribe solo esas guías
  python3 herramientas/construir_casos.py --salida DIR    # escribe en otro directorio (por omisión, casos/)
"""
import argparse
import glob
import json
import os
import random
import sys
from collections import Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
LICENCIA = ("Equipo Razona (PCIC-UNAM), uso educativo no lucrativo; contenido clínico derivado de GPC "
            "CENETEC/IMSS, autorización de uso pendiente (H11)")
FECHA = "2026-11-20"
VERSION = "0.1.0"
VERSION_REC = "0.2.0"
FECHA_REC = "2026-11-21"
CAMPOS_REC = {
    "flashcard": ["frente", "reverso", "cita"],
    "diagrama": ["codigo", "citas"],
    "resaltado": ["fragmento", "motivo"],
    "tabla": ["columnas", "filas", "cita"],
    "imagen": ["url_imagen", "url_pagina", "fuente", "autor", "licencia", "descripcion", "archivo", "sha256"],
}


def cita(f, resto):
    if resto and resto[0] == "SIN_RESPALDO_GPC":
        return {"estado": "SIN_RESPALDO_GPC", "motivo": resto[1]}
    seccion, pagina, fragmento = resto
    return {"guia": f["guia"], "clave": f["clave"], "seccion": seccion, "pagina": pagina, "fragmento": fragmento}


def recurso(f, caso_id, r):
    """Expande un recurso compacto. Los campos que no pertenecen al tipo se conservan
    para que el esquema (additionalProperties: false) los rechace en lugar de perderlos en silencio."""
    out = {"id": f"{caso_id}-R{r['n']}", "tipo": r["tipo"], "concepto": r["concepto"],
           "para_errores": r["para_errores"], "mostrar": r["mostrar"], "estado": "borrador"}
    for k, v in r.items():
        if k in ("n", "tipo", "concepto", "para_errores", "mostrar"):
            continue
        if k == "cita":
            v = cita(f, v)
        elif k == "citas" and isinstance(v, list):
            v = [cita(f, x) for x in v]
        out[k] = v
    orden = list(out)[:6] + [k for k in CAMPOS_REC.get(r["tipo"], []) if k in out]
    return {k: out[k] for k in orden + [k for k in out if k not in orden]}


def baraja(c, semilla, destino):
    """Coloca la respuesta correcta en la letra `destino` y permuta los distractores
    de forma determinista (misma semilla, mismo orden); reasigna las letras de la rúbrica."""
    orig_rc = "ABCDE".index(c["rc"])
    distractores = [i for i in range(5) if i != orig_rc]
    random.Random(semilla).shuffle(distractores)
    orden = distractores[:]
    orden.insert("ABCDE".index(destino), orig_rc)   # orden[nueva_pos] = pos_original
    letra = {"ABCDE"[orig]: "ABCDE"[nueva] for nueva, orig in enumerate(orden)}
    c = dict(c)
    c["op"] = [c["op"][orig] for orig in orden]
    c["rc"] = letra[c["rc"]]
    c["rub"] = [r[:2] + [sorted(letra[x] for x in r[2])] + r[3:] for r in c["rub"]]
    return c


def lee_json(nombre, clave):
    ruta = os.path.join(RAIZ, nombre)
    if not os.path.exists(ruta):
        return {}
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)[clave]


def letra_para(cid, letras):
    """Letra fija del caso; uno nuevo recibe la menos usada (empate: orden A–E)."""
    if cid not in letras:
        uso = Counter(letras.values())
        letras[cid] = min("ABCDE", key=lambda x: (uso[x], x))
    return letras[cid]


def estado_para(cid, revisiones):
    return revisiones.get(cid, {}).get("estado", "borrador")


def expande(f, letras, revisiones):
    num = f["archivo"][:3]
    base = {"guia": f["guia"], "clave": f["clave"], "archivo": f["archivo"]}
    out = []
    for c in f["casos"]:
        indice = c["t"] == "I"
        cid = f"RZ-PED-{num}-{c['t']}"
        c = baraja(c, cid, letra_para(cid, letras))
        rec = c.get("rec")
        caso = {
            "id": cid,
            "version": VERSION_REC if rec else VERSION,
            "sindrome": f["sindrome"],
            "tipo": "indice" if indice else "variante",
            "caso_indice_id": None if indice else f"RZ-PED-{num}-I",
            "gpc_base": base,
            "vineta": c["vineta"],
            "pregunta": c["pregunta"],
            "opciones": dict(zip("ABCDE", c["op"])),
            "respuesta_correcta": c["rc"],
            "puntos_clave": [{"texto": p[0], "cita_gpc": cita(f, p[1:])} for p in c["pc"]],
            "rubrica": [{
                "tipo_error": r[0], "descripcion": r[1], "opciones_asociadas": r[2],
                "senales_en_justificacion": r[3], "pregunta_socratica_semilla": r[4],
                "explicacion": r[5], "cita_gpc": cita(f, r[6:])} for r in c["rub"]],
            "autor": "claude",
            "estado": estado_para(cid, revisiones),
            "fecha": FECHA_REC if rec else FECHA,
            "licencia": LICENCIA,
        }
        if rec:
            caso["recursos"] = [recurso(f, cid, r) for r in rec]
        out.append(caso)
    return num, out


def construye(salida_dir=None, solo=None):
    """Devuelve {ruta_destino: casos} y las letras (incluidas las de casos nuevos).
    Siempre recorre todas las fuentes para asignar letras; `solo` filtra lo que se devuelve."""
    salida_dir = salida_dir or os.path.join(RAIZ, "casos")
    letras = dict(lee_json("letras.json", "letras"))
    revisiones = lee_json("revisiones.json", "revisiones")
    salida = {}
    for r in sorted(glob.glob(os.path.join(RAIZ, "fuentes", "*.json"))):
        with open(r, encoding="utf-8") as fh:
            f = json.load(fh)
        num, casos = expande(f, letras, revisiones)
        if solo and num not in solo:
            continue
        salida[os.path.join(salida_dir, f"RZ-PED-{num}.json")] = casos
    return salida, letras


def serializa(dato):
    return json.dumps(dato, ensure_ascii=False, indent=2)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Expande json/fuentes a json/casos.")
    ap.add_argument("--check", action="store_true", help="no escribe; falla si casos/ no está al día")
    ap.add_argument("--solo", nargs="*", default=None, help="escribe solo esas guías (NNN)")
    ap.add_argument("--salida", default=None, help="directorio de salida (por omisión, casos/)")
    args = ap.parse_args(argv)
    salida, letras = construye(args.salida, args.solo)
    letras_ruta = os.path.join(RAIZ, "letras.json")
    letras_doc = {
        "descripcion": (
            "Letra de la respuesta correcta de cada caso. La asigna construir_casos.py la primera "
            "vez y queda fija: cambiarla rompe el historial de respuestas de las alumnas. "
            "No editar a mano."
        ),
        "letras": dict(sorted(letras.items())),
    }

    if args.check:
        distintos = []
        for destino, casos in salida.items():
            actual = open(destino, encoding="utf-8").read() if os.path.exists(destino) else None
            if actual != serializa(casos):
                distintos.append(os.path.relpath(destino, RAIZ))
        esperados = {os.path.normpath(d) for d in salida}
        extra = [] if args.solo else sorted(
            os.path.relpath(p, RAIZ)
            for p in glob.glob(os.path.join(args.salida or os.path.join(RAIZ, "casos"), "*.json"))
            if os.path.normpath(p) not in esperados
        )
        nuevos = sorted(set(letras) - set(lee_json("letras.json", "letras")))
        for d in distintos:
            print(f"DESACTUALIZADO {d}: corre python3 herramientas/construir_casos.py")
        for e in extra:
            print(f"SOBRANTE {e}: no tiene fuente en fuentes/")
        if nuevos:
            print(f"letras.json no tiene {len(nuevos)} casos nuevos: corre construir_casos.py")
        ok = not (distintos or extra or nuevos)
        print("OK: json/casos está al día" if ok else "json/casos no está al día")
        return 0 if ok else 1

    for destino in {os.path.dirname(d) for d in salida}:
        os.makedirs(destino, exist_ok=True)
    for destino, casos in salida.items():
        tmp = destino + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(serializa(casos))
        os.replace(tmp, destino)
        print(f"-> {os.path.relpath(destino, RAIZ)} ({len(casos)} casos)")
    with open(letras_ruta, "w", encoding="utf-8") as fh:
        fh.write(serializa(letras_doc) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
