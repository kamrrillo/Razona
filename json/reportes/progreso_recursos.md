# Progreso: recursos de aprendizaje

Formato y reglas en README.md (sección "Recursos de aprendizaje"). Resultados y pendientes médicos en
REVISION.md. Notas por guía en reportes/notas_subagentes/.

## Terminadas, validadas y con commit (54 de 55)
029 032 044 062 109 137 156 230 244 248 258 261 262 269 271 275 334 350 361 362 366 371 395 418 430 442
459 466 467 469 473 475 495 496 497 510 540 548 601 602 625 627 632 637 643 715 724 725 733 734 776 793
826 829

Revisión de imágenes hecha: se quitaron las de 643 (adulto) y 625 (no neonatal). La URL de la 601 coincide
con la que da la API de Commons. reportes/imagenes.csv e indice_banco.csv están regenerados.

## Pendiente: guía 027 (falta 027GER.pdf)
1. Copiar el PDF y generar su texto:
   `pdftotext -layout 027GER.pdf gpc_paginas/027GER.txt` y `pdftotext 027GER.pdf gpc_paginas/027GER.raw.txt`.
2. Comprobar que desaparecen los 13 errores R5 de la 027 y las 5 pruebas que fallan por ella.
3. Escribir el rec de la 027 (índice y variante) con las mismas reglas, y luego construir y validar.
4. Con los 110 casos con recursos, agregar "recursos" a "required" en esquema/caso.schema.json y validar.
5. Actualizar en REVISION.md el conteo de recursos y la tabla de casos sin imagen.
6. Regenerar indice_banco.csv y hacer commit.
