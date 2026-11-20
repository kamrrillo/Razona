# Banco de casos de pediatría — Razona (borrador)

Casos tipo ENARM generados a partir de 55 GPC pediátricas del CENETEC/IMSS: un caso índice y una variante de transferencia por guía, 110 en total. Todos están en estado `borrador` y deben pasar por revisión de un médico aliado. Los pendientes de esa revisión están en `REVISION.md`, y el listado de casos en `indice_banco.csv`.

## Estructura

- `esquema/caso.schema.json`: esquema JSON (draft 2020-12).
- `fuentes/NNN.json`: casos en formato compacto; **se editan aquí**.
- `casos/RZ-PED-NNN.json`: casos completos que genera el constructor; no se editan a mano.
- `herramientas/construir_casos.py`: expande las fuentes y reparte la letra correcta por igual entre A y E.
- `herramientas/validar_casos.py`: valida el esquema y las reglas R1–R6, y comprueba que cada cita exista en su página.
- `herramientas/gpc.py`: consulta el texto de las guías por página (`toc`, `buscar`, `pag`, `seccion`).
- `herramientas/test_validar.py`: pruebas (`python3 -m pytest herramientas -q`).

## Uso

```bash
# 1. Texto de las GPC por página (una vez; requiere poppler-utils)
mkdir -p gpc_paginas
for f in /ruta/a/las/gpc/*GER*.pdf; do
  b=$(basename "$f" .pdf)
  pdftotext -layout "$f" gpc_paginas/$b.txt
  pdftotext "$f" gpc_paginas/$b.raw.txt
done
# 2. Construir y validar
python3 herramientas/construir_casos.py
python3 herramientas/validar_casos.py casos --gpc gpc_paginas
```

## Campos que se agregaron a los que pediste

- `gpc_base` {guia, clave, archivo}: guía de la que sale el caso.
- `pregunta`: la pregunta del reactivo, separada de la viñeta.
- `rubrica[].opciones_asociadas`: opciones que delatan cada error.
- `cita_gpc.fragmento`: texto literal breve de la página citada, para verificar la cita de forma automática.
- `puntos_clave` es una lista de objetos {texto, cita_gpc}, para que también lleven cita.
- `sindrome` contiene el tema de la guía (p. ej. `bronquiolitis_aguda`), porque ya no son solo los dos síndromes originales.

`pagina` es la página del archivo PDF contada desde 1. En las guías revisadas coincide con el número impreso al pie.
