#!/usr/bin/env python3
"""Valida los casos de Razona contra caso.schema.json y reglas del proyecto.

Uso:
  python3 validar_casos.py DIR_CASOS [--gpc DIR_TEXTO_GPC] [--esquema RUTA]

Reglas además del esquema:
  R1  ids únicos; cada variante apunta a un caso índice existente del mismo archivo de GPC.
  R2  cada caso índice cubre los 4 tipos de error en su rúbrica.
  R3  el estado coincide con revisiones.json (borrador si el caso no aparece ahí);
      "revisado_medico" exige revisor y fecha en revisiones.json.
  R4  la variante no se resuelve memorizando el índice: viñeta distinta (Jaccard < 0.5)
      y texto de la opción correcta distinto.
  R5  (con --gpc) cada cita existe: la página está dentro del PDF y el fragmento
      literal aparece en esa página.
  R6  opciones distintas entre sí; opciones_asociadas de la rúbrica no incluyen la
      respuesta correcta salvo en errores de 'lectura' o 'dato_omitido' explícitos.
  R7  (aviso) la opción correcta no debe ser mucho más larga que los distractores.
Sale con código 1 si hay errores.
"""
import argparse
import glob
import json
import os
import re
import sys
import unicodedata

from jsonschema import Draft202012Validator

AQUI = os.path.dirname(os.path.abspath(__file__))
TIPOS = {"lectura", "dato_omitido", "razonamiento", "conocimiento"}


def norm(t):
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]", "", t)


def palabras(t):
    return set(re.findall(r"[a-záéíóúñü]{4,}", t.lower()))


def jaccard(a, b):
    a, b = palabras(a), palabras(b)
    return len(a & b) / max(1, len(a | b))


class Paginas:
    def __init__(self, dir_gpc):
        self.dir = dir_gpc
        self.cache = {}

    def de(self, archivo):
        base = archivo.replace(".pdf", "")
        if base not in self.cache:
            textos = []
            for suf in (".txt", ".raw.txt"):
                p = os.path.join(self.dir, base + suf)
                if os.path.exists(p):
                    with open(p, encoding="utf-8") as fh:
                        textos.append([norm(x) for x in fh.read().split("\f")])
            self.cache[base] = textos
        return self.cache[base]

    def verifica(self, archivo, pagina, fragmento):
        textos = self.de(archivo)
        if not textos:
            return False, "sin texto de la GPC"
        n = max(len(t) for t in textos)
        if pagina > n:
            return False, f"página {pagina} fuera del PDF ({n} págs.)"
        f = norm(fragmento)
        if any(pagina - 1 < len(t) and f in t[pagina - 1] for t in textos):
            return True, ""
        otras = sorted({i + 1 for t in textos for i, pg in enumerate(t) if f in pg})
        return False, f"fragmento no está en p{pagina}" + (f"; aparece en p{otras}" if otras else "; no aparece en la guía")


def citas(caso):
    for i, pc in enumerate(caso.get("puntos_clave", [])):
        yield f"puntos_clave[{i}]", pc.get("cita_gpc", {})
    for i, r in enumerate(caso.get("rubrica", [])):
        yield f"rubrica[{i}]", r.get("cita_gpc", {})


ESTADOS_REVISION = {"en_revision", "revisado_medico", "retirado"}


def lee_revisiones(ruta=None):
    ruta = ruta or os.path.join(AQUI, "..", "revisiones.json")
    if not os.path.exists(ruta):
        return {}
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh).get("revisiones", {})


def valida(dir_casos, dir_gpc=None, esquema=None, revisiones=None):
    esquema = esquema or os.path.join(AQUI, "..", "esquema", "caso.schema.json")
    revisiones = lee_revisiones() if revisiones is None else revisiones
    with open(esquema, encoding="utf-8") as fh:
        val = Draft202012Validator(json.load(fh))
    errores, avisos, casos = [], [], {}
    sin_respaldo = 0
    for ruta in sorted(glob.glob(os.path.join(dir_casos, "**", "*.json"), recursive=True)):
        with open(ruta, encoding="utf-8") as fh:
            try:
                dato = json.load(fh)
            except json.JSONDecodeError as e:
                errores.append(f"{ruta}: JSON inválido: {e}")
                continue
        for caso in dato if isinstance(dato, list) else [dato]:
            cid = caso.get("id", f"?{ruta}")
            for e in val.iter_errors(caso):
                errores.append(f"{cid}: esquema: {'/'.join(map(str, e.path))}: {e.message[:160]}")
            if cid in casos:
                errores.append(f"{cid}: id repetido")
            casos[cid] = caso
    pags = Paginas(dir_gpc) if dir_gpc else None
    for cid, c in casos.items():
        rev = revisiones.get(cid, {})
        esperado = rev.get("estado", "borrador")
        if rev and esperado not in ESTADOS_REVISION:
            errores.append(f"{cid}: revisiones.json tiene un estado no válido: {esperado} (R3)")
        elif c.get("estado") != esperado:
            errores.append(
                f"{cid}: estado '{c.get('estado')}' no coincide con revisiones.json ('{esperado}') (R3)"
            )
        if esperado == "revisado_medico" and not (rev.get("revisor") and rev.get("fecha")):
            errores.append(f"{cid}: revisado_medico requiere revisor y fecha en revisiones.json (R3)")
        ops = list((c.get("opciones") or {}).values())
        if len({norm(o) for o in ops}) != len(ops):
            errores.append(f"{cid}: opciones repetidas (R6)")
        rc = c.get("respuesta_correcta")
        if rc and len(ops) == 5:
            otras = [len(v) for k, v in c["opciones"].items() if k != rc]
            if len(c["opciones"][rc]) > 1.25 * max(otras):
                avisos.append(f"{cid}: la opción correcta es más de 1.25 veces más larga que cualquier distractor (R7)")
        for i, r in enumerate(c.get("rubrica", [])):
            if rc in r.get("opciones_asociadas", []) and r.get("tipo_error") in ("razonamiento", "conocimiento"):
                avisos.append(f"{cid}: rubrica[{i}] asocia la respuesta correcta a un error de {r['tipo_error']}")
        if c.get("tipo") == "indice":
            faltan = TIPOS - {r.get("tipo_error") for r in c.get("rubrica", [])}
            if faltan:
                errores.append(f"{cid}: faltan tipos de error {sorted(faltan)} (R2)")
        if c.get("tipo") == "variante":
            ind = casos.get(c.get("caso_indice_id"))
            if not ind:
                errores.append(f"{cid}: caso_indice_id {c.get('caso_indice_id')} no existe (R1)")
            else:
                if ind["gpc_base"]["archivo"] != c["gpc_base"]["archivo"]:
                    errores.append(f"{cid}: la variante usa otra GPC que su índice (R1)")
                j = jaccard(ind["vineta"], c["vineta"])
                if j >= 0.5:
                    errores.append(f"{cid}: viñeta demasiado parecida al índice (Jaccard {j:.2f}) (R4)")
                if norm(ind["opciones"][ind["respuesta_correcta"]]) == norm(c["opciones"][c["respuesta_correcta"]]):
                    errores.append(f"{cid}: misma opción correcta que el índice (R4)")
        for donde, cita in citas(c):
            if cita.get("estado") == "SIN_RESPALDO_GPC":
                sin_respaldo += 1
                avisos.append(f"{cid}: {donde}: SIN_RESPALDO_GPC — {cita.get('motivo')}")
                continue
            if cita.get("clave") and cita["clave"] != c["gpc_base"]["clave"]:
                avisos.append(f"{cid}: {donde}: cita otra guía ({cita['clave']})")
            if pags and "pagina" in cita:
                ok, msg = pags.verifica(c["gpc_base"]["archivo"], cita["pagina"], cita.get("fragmento", ""))
                if not ok:
                    errores.append(f"{cid}: {donde}: cita no verificada: {msg} (R5)")
    return casos, errores, avisos, sin_respaldo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir_casos")
    ap.add_argument("--gpc")
    ap.add_argument("--esquema")
    a = ap.parse_args()
    if not a.gpc:
        print("AVISO sin --gpc: no se verifican las citas contra el texto de las GPC (R5)")
    casos, errores, avisos, sr = valida(a.dir_casos, a.gpc, a.esquema)
    n_ind = sum(c.get("tipo") == "indice" for c in casos.values())
    print(f"Casos: {len(casos)} ({n_ind} índice, {len(casos) - n_ind} variante). Citas SIN_RESPALDO_GPC: {sr}")
    for a_ in avisos:
        print("AVISO", a_)
    for e in errores:
        print("ERROR", e)
    print("OK" if not errores else f"{len(errores)} errores")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
