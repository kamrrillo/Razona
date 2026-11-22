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


# ---------------------------------------------------------------- recursos (R8–R14)
# Usan la guía 032, con un juego mínimo de recursos válidos armado aquí.

S = "4.2.1.3 Tratamiento farmacológico"
REC_032_I = [
    {"n": 1, "tipo": "flashcard", "concepto": "umbral_oxigeno", "para_errores": ["lectura"],
     "mostrar": "despues_de_responder", "frente": "¿Con qué saturación se administra oxígeno en bronquiolitis?",
     "reverso": "Con saturación menor de 90 %.", "cita": [S, 27, "En saturaciones de oxigeno menor de 90% administrar"]},
    {"n": 2, "tipo": "flashcard", "concepto": "antibiotico_sin_utilidad", "para_errores": ["razonamiento"],
     "mostrar": "despues_de_responder", "frente": "¿Los antibióticos son útiles en bronquiolitis?",
     "reverso": "No muestran utilidad.", "cita": [S, 25, "Los antibióticos no muestran utilidad en el manejo de"]},
    {"n": 3, "tipo": "diagrama", "concepto": "manejo_bronquiolitis_leve", "para_errores": ["conocimiento"],
     "mostrar": "despues_de_responder",
     "codigo": 'flowchart TD\n  A["Bronquiolitis leve"] --> B{"¿SpO2 menor de 90 %?"}\n  B -->|"Sí"| C["Oxígeno"]\n  B -->|"No"| D["Domicilio"]',
     "citas": [["4.2.2.1 Tratamiento no farmacológico", 27, "bronquiolitis leve pueden recibir el manejo en su domicilio"]]},
    {"n": 4, "tipo": "resaltado", "concepto": "sin_atopia", "para_errores": ["dato_omitido"],
     "mostrar": "despues_de_responder", "fragmento": "sin antecedentes de atopia en él ni en la familia",
     "motivo": "Sin atopia, la guía no recomienda salbutamol."},
]
REC_032_V1 = [
    {"n": 1, "tipo": "resaltado", "concepto": "dermatitis_atopica", "para_errores": ["dato_omitido"],
     "mostrar": "despues_de_responder", "fragmento": "dermatitis atópica desde los 3 meses",
     "motivo": "La atopia cambia la indicación de broncodilatador."},
]


def fuente(num, sin_rec=False):
    with open(os.path.join(RAIZ, "fuentes", f"{num}.json"), encoding="utf-8") as fh:
        f = json.load(fh)
    if sin_rec:
        for c in f["casos"]:
            c.pop("rec", None)
    return f


@pytest.fixture
def par032():
    f = fuente("032")
    f["casos"][0]["rec"] = copy.deepcopy(REC_032_I)
    f["casos"][1]["rec"] = copy.deepcopy(REC_032_V1)
    return cc.expande(f, [0])[1]


def corre_rec(tmp_path, casos):
    (tmp_path / "x.json").write_text(json.dumps(casos, ensure_ascii=False), encoding="utf-8")
    _, errores, avisos, _ = vc.valida(str(tmp_path), GPC, None, str(tmp_path))
    return errores, avisos


def rec(c, n):
    return next(r for r in c["recursos"] if r["id"].endswith(f"-R{n}"))


def test_construir_expande_rec(par032):
    i, v = par032
    assert i["version"] == "0.2.0" and i["fecha"] == cc.FECHA_REC
    assert [r["id"] for r in i["recursos"]] == [f"RZ-PED-032-I-R{n}" for n in range(1, 5)]
    assert all(r["estado"] == "borrador" for r in i["recursos"])
    assert i["recursos"][0]["cita"]["clave"] == "IMSS-032-08" and i["recursos"][0]["cita"]["pagina"] == 27
    assert i["recursos"][2]["citas"][0]["fragmento"].startswith("bronquiolitis leve")
    assert "n" not in i["recursos"][0]


def test_construir_sin_rec_no_cambia():
    sin = cc.expande(fuente("032", sin_rec=True), [0])[1][0]
    assert sin["version"] == cc.VERSION and sin["fecha"] == cc.FECHA and "recursos" not in sin


def test_construir_rec_no_cambia_barajado(par032):
    sin = cc.expande(fuente("032", sin_rec=True), [0])[1]
    for a, b in zip(sin, par032):
        assert a["opciones"] == b["opciones"] and a["respuesta_correcta"] == b["respuesta_correcta"]


def test_rec_valido(tmp_path, par032):
    errores, avisos = corre_rec(tmp_path, par032)
    assert errores == [] and not any(x in a for a in avisos for x in ("R12", "R13", "R14"))


def test_rec_cita_verificada_r5(tmp_path, par032):
    rec(par032[0], 1)["cita"]["fragmento"] = "texto que no existe en ninguna guía"
    errores, _ = corre_rec(tmp_path, par032)
    assert any("RZ-PED-032-I-R1.cita" in e and "R5" in e for e in errores)


def test_rec_cita_de_diagrama_r5(tmp_path, par032):
    rec(par032[0], 3)["citas"][0]["pagina"] = 5
    errores, _ = corre_rec(tmp_path, par032)
    assert any("RZ-PED-032-I-R3.citas[0]" in e and "R5" in e for e in errores)


def test_r8_id_repetido(tmp_path, par032):
    rec(par032[0], 2)["id"] = "RZ-PED-032-I-R1"
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R8" in e and "repetido" in e for e in errores)


def test_r8_prefijo(tmp_path, par032):
    par032[1]["recursos"][0]["id"] = "RZ-PED-032-I-R9"
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R8" in e and "no empieza" in e for e in errores)


def test_r9_resaltado_fuera_de_vineta(tmp_path, par032):
    rec(par032[0], 4)["fragmento"] = "antecedente de asma en la madre"
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R9" in e for e in errores)


def test_r9_normaliza_como_r5(tmp_path, par032):
    rec(par032[0], 4)["fragmento"] = "SIN ANTECEDENTES de atopia  en el ni en la familia"
    errores, _ = corre_rec(tmp_path, par032)
    assert not any("R9" in e for e in errores)


def test_r10_prefijo(tmp_path, par032):
    rec(par032[0], 3)["codigo"] = 'sequenceDiagram\n  A->>B: "hola"'
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R10" in e and "flowchart" in e for e in errores)


def test_r10_demasiados_nodos(tmp_path, par032):
    lineas = ["flowchart TD"] + [f'  N{i}["paso {i}"] --> N{i + 1}["paso {i + 1}"]' for i in range(13)]
    rec(par032[0], 3)["codigo"] = "\n".join(lineas)
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R10" in e and "nodos" in e for e in errores)


def test_r10_texto_sin_comillas(tmp_path, par032):
    rec(par032[0], 3)["codigo"] = 'flowchart TD\n  A[Bronquiolitis leve] --> B["Domicilio"]'
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R10" in e and "comillas" in e for e in errores)


def test_r10_cuenta_nodos():
    ids, sin = vc.nodos_mermaid('flowchart TD\n  A["x"] --> B{"¿y?"}\n  B -->|"Sí"| C(["z"])\n  B -- "No" --> D\n  C & D --> E')
    assert ids == {"A", "B", "C", "D", "E"} and sin == []


def imagen(rid, archivo, sha):
    return {"id": rid, "tipo": "imagen", "concepto": "foto_x", "para_errores": ["conocimiento"],
            "mostrar": "despues_de_responder", "estado": "borrador", "url_imagen": "https://upload.wikimedia.org/x.png",
            "url_pagina": "https://commons.wikimedia.org/wiki/File:x.png", "fuente": "Wikimedia Commons",
            "autor": "Autor", "licencia": "CC BY 4.0", "descripcion": "Imagen de prueba para el validador.",
            "archivo": archivo, "sha256": sha}


def test_r11_imagen_ok(tmp_path, par032):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "RZ-PED-032-I-R5.png").write_bytes(b"\x89PNGprueba")
    par032[0]["recursos"].append(imagen("RZ-PED-032-I-R5", "assets/RZ-PED-032-I-R5.png",
                                        vc.sha256(str(tmp_path / "assets" / "RZ-PED-032-I-R5.png"))))
    errores, _ = corre_rec(tmp_path, par032)
    assert errores == []


def test_r11_imagen_falta(tmp_path, par032):
    par032[0]["recursos"].append(imagen("RZ-PED-032-I-R5", "assets/RZ-PED-032-I-R5.png", "0" * 64))
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R11" in e and "no existe" in e for e in errores)


def test_r11_sha_distinto(tmp_path, par032):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "RZ-PED-032-I-R5.png").write_bytes(b"\x89PNGprueba")
    par032[0]["recursos"].append(imagen("RZ-PED-032-I-R5", "assets/RZ-PED-032-I-R5.png", "0" * 64))
    errores, _ = corre_rec(tmp_path, par032)
    assert any("R11" in e and "sha256" in e for e in errores)


def test_r12_texto_de_opcion_correcta(tmp_path, par032):
    i = par032[0]
    rec(i, 1)["reverso"] = i["opciones"][i["respuesta_correcta"]]
    _, avisos = corre_rec(tmp_path, par032)
    assert any("R12" in a for a in avisos)


def test_r13_tipos_sin_cubrir(tmp_path, par032):
    for r in par032[0]["recursos"]:
        if r["tipo"] != "resaltado":
            r["para_errores"] = ["conocimiento"]
    _, avisos = corre_rec(tmp_path, par032)
    assert any("R13" in a and "lectura" in a and "razonamiento" in a for a in avisos)


@pytest.mark.parametrize("texto", ["Por eso la opción C es la correcta.", "El inciso B describe otra cosa.",
                                   "La respuesta «D» no aplica."])
def test_r14_letra_de_opcion(tmp_path, par032, texto):
    rec(par032[0], 4)["motivo"] = texto + " Sin atopia no hay salbutamol."
    _, avisos = corre_rec(tmp_path, par032)
    assert any("R14" in a for a in avisos)


def test_r14_no_confunde_texto_clinico(tmp_path, par032):
    rec(par032[0], 1)["reverso"] = "Vitamina A y opciones de manejo en domicilio."
    _, avisos = corre_rec(tmp_path, par032)
    assert not any("R14" in a for a in avisos)


def test_esquema_variante_solo_resaltados(tmp_path, par032):
    par032[1]["recursos"].append(dict(rec(par032[0], 1), id="RZ-PED-032-V1-R2"))
    errores, _ = corre_rec(tmp_path, par032)
    assert any("RZ-PED-032-V1: esquema" in e for e in errores)


def test_esquema_indice_sin_diagrama(tmp_path, par032):
    par032[0]["recursos"] = [r for r in par032[0]["recursos"] if r["tipo"] != "diagrama"]
    errores, _ = corre_rec(tmp_path, par032)
    assert any("RZ-PED-032-I: esquema" in e for e in errores)


def test_esquema_reverso_largo(tmp_path, par032):
    rec(par032[0], 1)["reverso"] = " ".join(["palabra"] * 26)
    errores, _ = corre_rec(tmp_path, par032)
    assert any("esquema" in e and "reverso" in e for e in errores)


def test_esquema_resaltado_solo_lectura_u_omision(tmp_path, par032):
    rec(par032[0], 4)["para_errores"] = ["razonamiento"]
    errores, _ = corre_rec(tmp_path, par032)
    assert any("esquema" in e for e in errores)


def test_esquema_campo_ajeno(tmp_path, par032):
    rec(par032[0], 1)["codigo"] = "flowchart TD"
    errores, _ = corre_rec(tmp_path, par032)
    assert any("esquema" in e for e in errores)


@pytest.mark.parametrize("num", ["032", "244"])
def test_poner_rec_conserva_fuente(num):
    import poner_rec as pr
    with open(os.path.join(RAIZ, "fuentes", f"{num}.json"), encoding="utf-8", newline="") as fh:
        texto = fh.read()
    nuevo = pr.pon(texto, {"I": REC_032_I, "V1": REC_032_V1})
    otra = pr.pon(nuevo, {"I": REC_032_I[:2]})          # reemplaza solo el índice
    assert json.loads(otra)["casos"][0]["rec"] == REC_032_I[:2]
    assert json.loads(otra)["casos"][1]["rec"] == REC_032_V1
    assert pr.pon(otra, {"I": [], "V1": []}) .replace("\r\n", "\n").count('"rec"') == 0


@pytest.mark.parametrize("destino", list("ABCDE"))
def test_baraja_conserva_respuesta(destino):
    c = {"op": ["a0", "b1", "c2", "d3", "e4"], "rc": "C",
         "rub": [["lectura", "x", ["A", "E"], [], "", "", "s", 1, "f"]]}
    b = cc.baraja(copy.deepcopy(c), "semilla", destino)
    assert b["rc"] == destino and b["op"]["ABCDE".index(destino)] == "c2"
    assert sorted(b["op"]) == sorted(c["op"])
    assert {b["op"]["ABCDE".index(x)] for x in b["rub"][0][2]} == {"a0", "e4"}
    assert cc.baraja(copy.deepcopy(c), "semilla", destino) == b  # determinista
