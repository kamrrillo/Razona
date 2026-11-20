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
"""
import glob
import random
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
LICENCIA = ("Equipo Razona (PCIC-UNAM), uso educativo no lucrativo; contenido clínico derivado de GPC "
            "CENETEC/IMSS, autorización de uso pendiente (H11)")
FECHA = "2026-11-20"
VERSION = "0.1.0"


def cita(f, resto):
    if resto and resto[0] == "SIN_RESPALDO_GPC":
        return {"estado": "SIN_RESPALDO_GPC", "motivo": resto[1]}
    seccion, pagina, fragmento = resto
    return {"guia": f["guia"], "clave": f["clave"], "seccion": seccion, "pagina": pagina, "fragmento": fragmento}


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


def expande(f, contador):
    num = f["archivo"][:3]
    base = {"guia": f["guia"], "clave": f["clave"], "archivo": f["archivo"]}
    out = []
    for c in f["casos"]:
        indice = c["t"] == "I"
        c = baraja(c, f"RZ-PED-{num}-{c['t']}", "ABCDE"[contador[0] % 5])
        contador[0] += 1
        out.append({
            "id": f"RZ-PED-{num}-{c['t']}",
            "version": VERSION,
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
            "estado": "borrador",
            "fecha": FECHA,
            "licencia": LICENCIA,
        })
    return num, out


def main(rutas):
    # Siempre se procesan todas las fuentes en orden, para que la letra correcta
    # de cada caso sea estable y quede repartida por igual entre A y E.
    rutas = sorted(glob.glob(os.path.join(RAIZ, "fuentes", "*.json")))
    contador = [0]
    for r in rutas:
        with open(r, encoding="utf-8") as fh:
            f = json.load(fh)
        num, casos = expande(f, contador)
        destino = os.path.join(RAIZ, "casos", f"RZ-PED-{num}.json")
        with open(destino, "w", encoding="utf-8") as fh:
            json.dump(casos, fh, ensure_ascii=False, indent=2)
        print(f"{r} -> {destino} ({len(casos)} casos)")


if __name__ == "__main__":
    main(sys.argv[1:])
