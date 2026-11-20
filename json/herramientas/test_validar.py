"""Pruebas del validador y del constructor de casos. Ejecutar: python3 -m pytest herramientas -q"""
import copy
import json
import os
import sys

import pytest

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
sys.path.insert(0, AQUI)

import construir_casos as cc  # noqa: E402
import validar_casos as vc  # noqa: E402

GPC = os.path.join(RAIZ, "gpc_paginas")


@pytest.fixture
def par():
    with open(os.path.join(RAIZ, "casos", "RZ-PED-027.json"), encoding="utf-8") as fh:
        return json.load(fh)


def corre(tmp_path, casos):
    (tmp_path / "x.json").write_text(json.dumps(casos, ensure_ascii=False), encoding="utf-8")
    _, errores, avisos, _ = vc.valida(str(tmp_path), GPC)
    return errores, avisos


def test_banco_actual_valido():
    _, errores, _, _ = vc.valida(os.path.join(RAIZ, "casos"), GPC)
    assert errores == []


def test_par_valido(tmp_path, par):
    errores, _ = corre(tmp_path, par)
    assert errores == []


def test_indice_sin_cuatro_tipos(tmp_path, par):
    par[0]["rubrica"] = [r for r in par[0]["rubrica"] if r["tipo_error"] != "lectura"]
    errores, _ = corre(tmp_path, par)
    assert any("R2" in e for e in errores)


def test_pagina_equivocada(tmp_path, par):
    par[0]["puntos_clave"][0]["cita_gpc"]["pagina"] = 40
    errores, _ = corre(tmp_path, par)
    assert any("R5" in e and "aparece en p[18]" in e for e in errores)


def test_fragmento_inventado(tmp_path, par):
    par[0]["rubrica"][0]["cita_gpc"]["fragmento"] = "texto que no existe en ninguna guía"
    errores, _ = corre(tmp_path, par)
    assert any("no aparece en la guía" in e for e in errores)


def test_estado_revisado_rechazado(tmp_path, par):
    par[0]["estado"] = "revisado_medico"
    errores, _ = corre(tmp_path, par)
    assert any("R3" in e for e in errores)


def test_variante_copiada(tmp_path, par):
    par[1]["vineta"] = par[0]["vineta"]
    errores, _ = corre(tmp_path, par)
    assert any("R4" in e for e in errores)


def test_variante_huerfana(tmp_path, par):
    errores, _ = corre(tmp_path, [par[1]])
    assert any("R1" in e for e in errores)


def test_sin_respaldo_es_aviso(tmp_path, par):
    par[0]["puntos_clave"][0]["cita_gpc"] = {"estado": "SIN_RESPALDO_GPC", "motivo": "prueba de marcador"}
    errores, avisos = corre(tmp_path, par)
    assert errores == [] and any("SIN_RESPALDO_GPC" in a for a in avisos)


def test_esquema_rechaza_cinco_opciones_incompletas(tmp_path, par):
    del par[0]["opciones"]["E"]
    errores, _ = corre(tmp_path, par)
    assert any("esquema" in e for e in errores)


@pytest.mark.parametrize("destino", list("ABCDE"))
def test_baraja_conserva_respuesta(destino):
    c = {"op": ["a0", "b1", "c2", "d3", "e4"], "rc": "C",
         "rub": [["lectura", "x", ["A", "E"], [], "", "", "s", 1, "f"]]}
    b = cc.baraja(copy.deepcopy(c), "semilla", destino)
    assert b["rc"] == destino and b["op"]["ABCDE".index(destino)] == "c2"
    assert sorted(b["op"]) == sorted(c["op"])
    assert {b["op"]["ABCDE".index(x)] for x in b["rub"][0][2]} == {"a0", "e4"}
    assert cc.baraja(copy.deepcopy(c), "semilla", destino) == b  # determinista
