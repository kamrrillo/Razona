# Pendientes de revisión humana — banco de pediatría

Estado: los 110 casos (55 índice + 55 variantes) están en `borrador`. Ninguno está marcado como `revisado_medico`.

## Resultado de la validación automática

- Esquema y reglas R1–R6: sin errores.
- 684 citas a GPC. Cada una tiene un fragmento literal que se encontró en la página indicada del PDF. No hubo ninguna `SIN_RESPALDO_GPC`.
- La letra correcta está repartida por igual: 22 casos para cada letra, de A a E.
- Todo distractor tiene al menos una entrada en la rúbrica. Cada caso índice cubre los 4 tipos de error.
- Longitud de las opciones (R7): ninguna correcta mide más de 1.5 veces el distractor más largo. En 22 casos mide entre 1.25 y 1.5 veces, y en 56 de 110 es la opción más larga. Conviene igualar longitudes durante la revisión.

**Lo que la validación no comprueba:** que el fragmento citado respalde la afirmación, que la viñeta sea clínicamente verosímil y que haya una sola respuesta defendible. Eso lo tienen que revisar los médicos.

## Decisiones y supuestos que deben confirmarse

1. **Nivel:** los casos están escritos para aspirantes al ENARM, como se pidió, aunque en el mensaje se mencionó evaluar a residentes.
2. **Formato:** 5 opciones (A–E), según las reglas del proyecto. Hay que confirmar que coincide con el formato vigente del ENARM.
3. **Clave de la GPC 027:** el PDF dice "S-027-08". Se usó IMSS-027-08; hay que verificarla en el catálogo del CENETEC.
4. **Guías excluidas:** 731GER (enfermedad de Paget ósea, de adultos). 109GE es un duplicado de 109GER.
5. **Campo `sindrome`:** ahora guarda el tema de cada guía y ya no solo los dos síndromes originales.
6. **Páginas:** `pagina` es la página del PDF, que en estas guías coincide con el número impreso.

## Contradicciones entre guías o dentro de una guía

- **Surfactante:** la GPC 137 (2008) recomienda surfactante profiláctico en menores de 30 semanas intubados en sala o sin esteroides prenatales. La GPC 776 (2015) cita un metaanálisis en el que el profiláctico tuvo más riesgo de DBP o muerte que CPAP con surfactante selectivo. RZ-PED-137-I sigue a la GPC 137 con un paciente ya intubado; hay que decidir si se conserva.
- **Prueba de sudor (GPC 627):** la página 23 pide un peso mayor de 2 kg y la página 26 mayor de 3 kg. La variante usa 3.4 kg para cumplir ambas.
- **Antigüedad:** varias guías son de 2008 a 2014. Los médicos deben valorar si alguna recomendación ya no es vigente antes de usarla en la evaluación.

## Variantes que no evalúan exactamente el mismo concepto que su índice

Los médicos deben decidir si estas variantes sirven como transferencia:

- **602:** el índice evalúa el tratamiento con permetrina; la variante, las medidas con ropa y objetos.
- **715:** el índice evalúa la crisis suprarrenal; la variante, la dosis de estrés sin crisis.
- **776:** el índice evalúa la definición de DBP; la variante, su prevención en sala de partos.
- **793:** el índice evalúa la referencia urgente por leucocoria; la variante, el tamizaje antes del alta.
- **829:** el índice evalúa la embarazada no vacunada; la variante, la Tdap en cada embarazo.
- **637:** el índice evalúa la hepatitis B; la variante, la hepatitis C con tratamiento antiviral.

## Implicaciones para el diseño del estudio

- **Piloto cruzado:** estaba diseñado con 2 síndromes (Razona en uno y retroalimentación estática en el otro). Con 55 temas hay que redefinir cómo se reparten entre condiciones y cuántos casos de transferencia resuelve cada alumno.
- **Justificaciones de evaluación (240 o 300):** falta decidir qué casos se usan y cuántas justificaciones corresponden a cada uno.
