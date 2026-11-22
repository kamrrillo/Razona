# /// script
# requires-python = ">=3.11"
# dependencies = ["supabase>=2.10", "jsonschema>=4.21"]
# ///
"""Carga el banco de casos (json/casos + json/temas.json) en Supabase.

Uso (desde la raíz del repo):
  uv run json/herramientas/cargar_supabase.py              # Supabase local (.env.local)
  uv run json/herramientas/cargar_supabase.py --env prod   # producción (.env.vercel.local)
  uv run json/herramientas/cargar_supabase.py --dry-run    # solo valida y resume

Qué hace:
  1. Valida los casos con validar_casos.py (esquema + R1–R4, R6; R5 solo si existe
     json/gpc_paginas con el texto de las guías).
  2. Valida json/temas.json: cada síndrome del banco tiene tema y cada tema tiene grupo.
  3. Upsert de grupos → temas → casos índice → variantes (por id; idempotente).
  4. Los casos que ya no están en el banco NO se borran: se marcan como 'retirado'.

Usa la llave secreta (service role): solo en local o en un entorno de confianza.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
JSON_DIR = AQUI.parent
RAIZ = JSON_DIR.parent
sys.path.insert(0, str(AQUI))

from validar_casos import valida  # noqa: E402

ENV_FILES = {"local": RAIZ / ".env.local", "prod": RAIZ / ".env.vercel.local"}


def leer_env(ruta: Path) -> dict[str, str]:
    """Lee un archivo .env sencillo (CLAVE=valor). Las variables del entorno tienen prioridad."""
    valores: dict[str, str] = {}
    if ruta.exists():
        for linea in ruta.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, valor = linea.split("=", 1)
            valores[clave.strip()] = valor.strip().strip('"').strip("'")
    valores.update({k: v for k, v in os.environ.items() if v})
    return valores


def cargar_temas(casos: dict[str, dict]) -> tuple[list[dict], list[dict], list[str]]:
    datos = json.loads((JSON_DIR / "temas.json").read_text(encoding="utf-8"))
    grupos, temas = datos["grupos"], datos["temas"]
    errores: list[str] = []
    ids_grupo = {g["id"] for g in grupos}
    vistos: set[str] = set()
    for t in temas:
        if t["sindrome"] in vistos:
            errores.append(f"temas.json: síndrome repetido {t['sindrome']}")
        vistos.add(t["sindrome"])
        if t["grupo"] not in ids_grupo:
            errores.append(f"temas.json: {t['sindrome']} usa un grupo inexistente ({t['grupo']})")
    en_banco = {c["sindrome"] for c in casos.values()}
    for s in sorted(en_banco - vistos):
        errores.append(f"temas.json: falta el síndrome {s}")
    for s in sorted(vistos - en_banco):
        errores.append(f"temas.json: el síndrome {s} no tiene casos en el banco")
    return grupos, temas, errores


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", choices=sorted(ENV_FILES), default="local")
    ap.add_argument("--dry-run", action="store_true", help="solo valida; no escribe en la base")
    args = ap.parse_args()

    gpc = JSON_DIR / "gpc_paginas"
    casos, errores, _avisos, _ = valida(str(JSON_DIR / "casos"), str(gpc) if gpc.is_dir() else None)
    grupos, temas, errores_temas = cargar_temas(casos)
    errores += errores_temas
    if errores:
        for e in errores:
            print("ERROR", e)
        print(f"No se cargó nada: {len(errores)} errores.")
        return 1

    indices = [c for c in casos.values() if c["tipo"] == "indice"]
    variantes = [c for c in casos.values() if c["tipo"] == "variante"]
    print(f"Banco válido: {len(casos)} casos ({len(indices)} índice, {len(variantes)} variante), "
          f"{len(temas)} temas, {len(grupos)} grupos.")
    if args.dry_run:
        return 0

    env = leer_env(ENV_FILES[args.env])
    url = env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
    llave = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not llave:
        print(f"Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en {ENV_FILES[args.env].name}")
        return 1

    from supabase import create_client

    db = create_client(url, llave)

    db.table("temas_grupos").upsert(
        [{"id": g["id"], "nombre": g["nombre"], "especialidad_id": g["especialidad"], "orden": g["orden"]}
         for g in grupos],
        on_conflict="id",
    ).execute()
    db.table("temas").upsert(
        [{"sindrome": t["sindrome"], "nombre": t["nombre"], "grupo_id": t["grupo"]} for t in temas],
        on_conflict="sindrome",
    ).execute()

    antes = {r["id"]: r["payload"] for r in db.table("casos_clinicos").select("id, payload").execute().data}
    nuevos = [c for c in casos.values() if c["id"] not in antes]
    cambiados = [c for c in casos.values() if c["id"] in antes and antes[c["id"]] != c]

    # Primero los índices: las variantes apuntan a ellos (llave foránea).
    for lote in (indices, variantes):
        db.table("casos_clinicos").upsert(
            [{"id": c["id"], "payload": c} for c in lote], on_conflict="id"
        ).execute()

    retirados = []
    for cid, payload in antes.items():
        if cid not in casos and payload.get("estado") != "retirado":
            db.table("casos_clinicos").update({"payload": {**payload, "estado": "retirado"}}).eq("id", cid).execute()
            retirados.append(cid)

    total = db.table("casos_clinicos").select("id", count="exact", head=True).execute().count
    print(f"Carga en '{args.env}': {len(nuevos)} nuevos, {len(cambiados)} actualizados, "
          f"{len(casos) - len(nuevos) - len(cambiados)} sin cambios, {len(retirados)} retirados. "
          f"Total en la base: {total}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
