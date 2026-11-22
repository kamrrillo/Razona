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
- `herramientas/cargar_supabase.py`: valida y carga el banco en Supabase (ver abajo).
- `temas.json`: catálogo de temas (nombre legible y área de cada `sindrome`). Cada síndrome del banco debe aparecer aquí.
- `letras.json`: letra correcta fija de cada caso. La asigna el constructor la primera vez y no cambia (no editar a mano).
- `revisiones.json`: estado de revisión médica por caso; el constructor lo aplica a `casos/`.
- `herramientas/poner_rec.py`: inserta o reemplaza `rec` en una fuente sin reformatear el resto y comprueba que nada más cambie.
- `herramientas/descargar_imagenes.py`: descarga las imágenes de los recursos a `assets/`, verifica o escribe su sha256 y genera `reportes/imagenes.csv`.
- `herramientas/indice_banco.py`: regenera `indice_banco.csv` (incluye la columna `n_recursos`).
- `assets/`: imágenes de los recursos (`<id del recurso>.<ext>`).
- `reportes/`: `imagenes.csv` (origen y licencia de cada imagen) y `progreso_recursos.md`.

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
# 3. Imágenes de los recursos e índice
python3 herramientas/descargar_imagenes.py          # --actualizar escribe el sha256 en la fuente
python3 herramientas/indice_banco.py
```

`construir_casos.py --solo NNN --salida DIR` construye solo una guía en otro directorio (la letra correcta sale de `letras.json`, así que no cambia). En Windows, usar `python3 -X utf8` para que la consola acepte los caracteres de las guías.

## Recursos de aprendizaje (`rec`)

Cada caso de `fuentes/NNN.json` puede llevar `rec`, una lista de recursos que se muestran después de que el alumno responde y complementan la explicación del tutor. El constructor los expande a `recursos`, con id `<id del caso>-R<n>` y estado `borrador`. Los casos con recursos pasan a la versión `0.2.0`.

Campos comunes: `n` (consecutivo dentro del caso), `tipo`, `concepto` (snake_case), `para_errores` (lectura, dato_omitido, razonamiento, conocimiento) y `mostrar` (`despues_de_responder`). Las citas usan el formato compacto `[seccion, pagina, fragmento]`, igual que en `pc` y `rub`.

| tipo | campos propios | límites |
|---|---|---|
| flashcard | frente, reverso, cita | reverso de 25 palabras como máximo; un concepto por tarjeta |
| diagrama | codigo, citas | Mermaid `flowchart TD`; hasta 12 nodos; texto de nodos entre comillas; de 1 a 4 citas |
| resaltado | fragmento, motivo | fragmento literal de la viñeta del caso; solo errores de lectura o dato_omitido |
| tabla | columnas, filas, cita | solo para un diferencial o una clasificación |
| imagen | url_imagen, url_pagina, fuente, autor, licencia, descripcion, archivo, sha256 | archivo `assets/<id>.<ext>`; licencia según la página o `desconocida` |

Cantidades, que el esquema hace cumplir: en el **índice**, de 2 a 3 flashcards, 1 diagrama, de 1 a 3 resaltados, hasta 2 imágenes y hasta 1 tabla, y entre todos deben cubrir los 4 tipos de error. En la **variante**, de 1 a 3 resaltados de su propia viñeta.

Ningún recurso menciona letras de opciones, porque el constructor las baraja, ni copia el texto completo de la opción correcta.

### Reglas del validador para recursos

Las citas de los recursos también pasan por R5.

- **R8** (error): los ids de recurso son únicos y empiezan con `<id del caso>-R`.
- **R9** (error): el fragmento de cada resaltado está en la viñeta de su caso. Se compara con la misma normalización que R5.
- **R10** (error): el diagrama empieza con `flowchart` o `graph`, tiene 12 nodos como máximo y el texto de los nodos va entre comillas. Si está instalado mermaid-cli (`mmdc`), además debe compilar.
- **R11** (error): el archivo de la imagen existe, se llama `<id>.<ext>` y su sha256 coincide.
- **R12** (aviso): un recurso contiene el texto completo de la opción correcta.
- **R13** (aviso): los recursos de un índice no cubren los 4 tipos de error.
- **R14** (aviso): un recurso menciona una letra de opción.

## Campos que se agregaron a los que pediste

- `gpc_base` {guia, clave, archivo}: guía de la que sale el caso.
- `pregunta`: la pregunta del reactivo, separada de la viñeta.
- `rubrica[].opciones_asociadas`: opciones que delatan cada error.
- `cita_gpc.fragmento`: texto literal breve de la página citada, para verificar la cita de forma automática.
- `puntos_clave` es una lista de objetos {texto, cita_gpc}, para que también lleven cita.
- `sindrome` contiene el tema de la guía (p. ej. `bronquiolitis_aguda`), porque ya no son solo los dos síndromes originales.

`pagina` es la página del archivo PDF contada desde 1. En las guías revisadas coincide con el número impreso al pie.

## Cargar en Supabase

Desde la raíz del repo (requiere [uv](https://docs.astral.sh/uv/) y las migraciones aplicadas):

```bash
pnpm content:load                 # Supabase local (.env.local)
pnpm content:load:prod            # producción (.env.vercel.local)
uv run json/herramientas/cargar_supabase.py --dry-run   # solo valida
```

La carga es idempotente: actualiza solo lo que cambió y marca como `retirado` (no borra) un caso que ya no está en el banco. En la base, cada caso vive en `casos_clinicos.payload` tal cual; la vista `v_casos_app` lo traduce al formato que usan la app web y el agente.

## Agregar temas nuevos

1. Texto de la GPC por página en `gpc_paginas/` (ver *Uso*).
2. Escribe `fuentes/NNN.json` (formato compacto: índice + variante).
3. Agrega el tema a `temas.json` (nombre y área; si es un área nueva, agrégala en `grupos`).
4. `python3 herramientas/construir_casos.py`: genera `casos/RZ-PED-NNN.json` y le asigna a cada caso nuevo la letra menos usada en `letras.json`. Las letras de los casos existentes no cambian.
5. `python3 herramientas/validar_casos.py casos --gpc gpc_paginas`.
6. `python3 herramientas/construir_casos.py --check` confirma que `casos/` está al día con `fuentes/`.
7. `pnpm content:load` (local) o `pnpm content:load:prod` (producción) valida y carga los casos nuevos; los existentes que no cambiaron no se tocan.

## Revisión médica

Registra cada revisión en `revisiones.json` y reconstruye; el estado pasa a `casos/` y a la base en la siguiente carga:

```json
"RZ-PED-032-I": { "estado": "revisado_medico", "revisor": "Dra. Nombre", "fecha": "2026-11-25", "notas": "" }
```

Estados: `en_revision`, `revisado_medico` (exige revisor y fecha) y `retirado`. Un caso que no aparece queda en `borrador`. El validador (R3) rechaza un caso cuyo estado no coincida con este archivo.
