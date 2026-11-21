#!/usr/bin/env python3
"""Valida los casos de Razona contra caso.schema.json y reglas del proyecto.

Uso:
  python3 validar_casos.py DIR_CASOS [--gpc DIR_TEXTO_GPC] [--esquema RUTA]

Reglas además del esquema:
  R1  ids únicos; cada variante apunta a un caso índice existente del mismo archivo de GPC.
  R2  cada caso índice cubre los 4 tipos de error en su rúbrica.
  R3  estado inicial "borrador" (nunca "revisado_medico" desde este generador).
  R4  la variante no se resuelve memorizando el índice: viñeta distinta (Jaccard < 0.5)
      y texto de la opción correcta distinto.
  R5  (con --gpc) cada cita existe: la página está dentro del PDF y el fragmento
      literal aparece en esa página.
  R6  opciones distintas entre sí; opciones_asociadas de la rúbrica no incluyen la
      respuesta correcta salvo en errores de 'lectura' o 'dato_omitido' explícitos.
  R7  (aviso) la opción correcta no debe ser mucho más larga que los distractores.
Recursos de aprendizaje (campo opcional "recursos"; sus citas también pasan por R5):
  R8  ids de recurso únicos y con el prefijo "<id del caso>-R".
  R9  el fragmento de cada resaltado aparece en la viñeta de su caso (normalización de R5).
  R10 el código de cada diagrama empieza con flowchart o graph, tiene como máximo 12 nodos y
      el texto de los nodos va entre comillas; si mermaid-cli (mmdc) está instalado, además compila.
  R11 el archivo de cada imagen existe (relativo a --assets, por omisión la raíz del banco),
      se llama <id del recurso>.<ext> y su sha256 coincide.
  R12 (aviso) un recurso contiene el texto completo de la opción correcta.
  R13 (aviso) los recursos de un caso índice no cubren los 4 tipos de error.
  R14 (aviso) un recurso menciona una letra de opción ("opción C", "inciso B").
Sale con código 1 si hay errores.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
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
    for r in caso.get("recursos", []) or []:
        rid = r.get("id", "?")
        if isinstance(r.get("cita"), dict):
            yield f"{rid}.cita", r["cita"]
        for j, ci in enumerate(r.get("citas") or []):
            if isinstance(ci, dict):
                yield f"{rid}.citas[{j}]", ci


RX_LETRA = re.compile(r"\b(?:[Oo]pci[oó]n(?:es)?|[Ii]ncisos?|[Ll]etras?|[Rr]espuesta)\s+[\"“«(]?[A-E]\b")
RX_INICIO_MERMAID = re.compile(r"^\s*(flowchart|graph)\b")
RX_FLECHA = re.compile(r"<?[-=.]{2,}[>xo]?|&")
NO_NODO = {"flowchart", "graph", "TD", "TB", "BT", "LR", "RL", "subgraph", "end", "classDef", "class",
           "style", "linkStyle", "click", "direction", "o", "x"}
MAX_NODOS = 12


def nodos_mermaid(codigo):
    """Ids de nodo de un flowchart sencillo. Devuelve (ids, etiquetas_sin_comillas)."""
    ids, sin_comillas = set(), []
    for ln in codigo.splitlines()[1:]:
        ln = ln.split("%%")[0].strip()
        if not ln or ln.split()[0] in ("classDef", "class", "style", "linkStyle", "click", "subgraph", "end", "direction"):
            continue
        ln = re.sub(r'"[^"]*"', "", ln)
        ln = re.sub(r"\|[^|]*\|", "", ln)
        for m in re.finditer(r"[\[\(\{>]+([^\[\]\(\)\{\}]*)[\]\)\}]+", ln):
            if m.group(1).strip():
                sin_comillas.append(m.group(1).strip())
        ln = re.sub(r"[\[\(\{>]+[^\[\]\(\)\{\}]*[\]\)\}]+", " ", ln)
        ln = re.sub(r":::\w+", " ", ln)
        for tok in RX_FLECHA.sub(" ", ln).split():
            if re.fullmatch(r"[A-Za-z_][\w]*", tok) and tok not in NO_NODO:
                ids.add(tok)
    return ids, sin_comillas


def compila_mermaid(codigo):
    mmdc = shutil.which("mmdc")
    if not mmdc:
        return True, ""
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "d.mmd"), os.path.join(d, "d.svg")
        with open(src, "w", encoding="utf-8") as fh:
            fh.write(codigo)
        p = subprocess.run([mmdc, "-i", src, "-o", dst], capture_output=True, text=True)
        return p.returncode == 0, (p.stderr or p.stdout).strip()[:200]


def textos_recurso(r):
    """Texto visible del recurso para R12 y R14 (sin citas, ids, urls ni archivos)."""
    out = []
    for k in ("frente", "reverso", "motivo", "descripcion"):
        if isinstance(r.get(k), str):
            out.append(r[k])
    if isinstance(r.get("codigo"), str):
        out += re.findall(r'"([^"]*)"', r["codigo"])
    for k in ("columnas",):
        out += [x for x in r.get(k) or [] if isinstance(x, str)]
    for fila in r.get("filas") or []:
        out += [x for x in fila if isinstance(x, str)]
    return out


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 16), b""):
            h.update(b)
    return h.hexdigest()


def valida_recursos(cid, c, errores, avisos, ids_vistos, dir_assets):
    recs = c.get("recursos") or []
    if not recs:
        return
    vineta = norm(c.get("vineta", ""))
    rc = c.get("respuesta_correcta")
    correcta = norm((c.get("opciones") or {}).get(rc, "")) if rc else ""
    for r in recs:
        rid = r.get("id", "?")
        if rid in ids_vistos:
            errores.append(f"{cid}: {rid}: id de recurso repetido (R8)")
        ids_vistos.add(rid)
        if not rid.startswith(f"{cid}-R"):
            errores.append(f"{cid}: {rid}: el id del recurso no empieza con {cid}-R (R8)")
        tipo = r.get("tipo")
        if tipo == "resaltado":
            if norm(r.get("fragmento", "")) not in vineta or not norm(r.get("fragmento", "")):
                errores.append(f"{cid}: {rid}: el fragmento del resaltado no está en la viñeta (R9)")
        if tipo == "diagrama":
            cod = r.get("codigo", "")
            if not RX_INICIO_MERMAID.match(cod):
                errores.append(f"{cid}: {rid}: el diagrama no empieza con flowchart o graph (R10)")
            else:
                ids, sin_comillas = nodos_mermaid(cod)
                if len(ids) > MAX_NODOS:
                    errores.append(f"{cid}: {rid}: el diagrama tiene {len(ids)} nodos (máx. {MAX_NODOS}) (R10)")
                if sin_comillas:
                    errores.append(f"{cid}: {rid}: texto de nodo sin comillas: {sin_comillas[0][:40]!r} (R10)")
                ok, msg = compila_mermaid(cod)
                if not ok:
                    errores.append(f"{cid}: {rid}: mermaid no compila: {msg} (R10)")
        if tipo == "imagen":
            arch = r.get("archivo", "")
            base = os.path.splitext(os.path.basename(arch))[0]
            if base != rid:
                errores.append(f"{cid}: {rid}: el archivo de la imagen debe llamarse {rid}.<ext> (R11)")
            ruta = os.path.join(dir_assets, arch)
            if not arch or not os.path.isfile(ruta):
                errores.append(f"{cid}: {rid}: no existe el archivo {arch} (R11)")
            elif sha256(ruta) != r.get("sha256"):
                errores.append(f"{cid}: {rid}: el sha256 de {arch} no coincide (R11)")
        textos = textos_recurso(r)
        if len(correcta) >= 6 and any(correcta in norm(t) for t in textos):
            avisos.append(f"{cid}: {rid}: el recurso contiene el texto completo de la opción correcta (R12)")
        if any(RX_LETRA.search(t) for t in textos):
            avisos.append(f"{cid}: {rid}: el recurso menciona una letra de opción (R14)")
    if c.get("tipo") == "indice":
        faltan = TIPOS - {e for r in recs for e in r.get("para_errores") or []}
        if faltan:
            avisos.append(f"{cid}: los recursos no cubren los tipos de error {sorted(faltan)} (R13)")


def detalla(e):
    """En un recurso que no cumple el oneOf, devuelve los errores de la rama de su tipo
    (la que no falla en "tipo") en lugar del mensaje genérico."""
    if e.validator != "oneOf" or not e.context or "recursos" not in list(e.path):
        return [e]
    por_rama = {}
    for s in e.context:
        por_rama.setdefault(s.relative_schema_path[0], []).append(s)
    for rama, errs in por_rama.items():
        if not any(list(s.path)[-1:] == ["tipo"] for s in errs):
            return errs
    return [e]


def valida(dir_casos, dir_gpc=None, esquema=None, dir_assets=None):
    esquema = esquema or os.path.join(AQUI, "..", "esquema", "caso.schema.json")
    dir_assets = dir_assets or os.path.join(AQUI, "..")
    ids_recursos = set()
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
                for e2 in detalla(e):
                    errores.append(f"{cid}: esquema: {'/'.join(map(str, e2.absolute_path))}: {e2.message[:160]}")
            if cid in casos:
                errores.append(f"{cid}: id repetido")
            casos[cid] = caso
    pags = Paginas(dir_gpc) if dir_gpc else None
    for cid, c in casos.items():
        if c.get("estado") != "borrador":
            errores.append(f"{cid}: estado debe ser 'borrador' (R3)")
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
        valida_recursos(cid, c, errores, avisos, ids_recursos, dir_assets)
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
    ap.add_argument("--assets", help="directorio base de los archivos de imagen (por omisión, la raíz del banco)")
    a = ap.parse_args()
    casos, errores, avisos, sr = valida(a.dir_casos, a.gpc, a.esquema, a.assets)
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
