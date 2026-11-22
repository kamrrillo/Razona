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
- **Los casos V1 de 627 y 776 sí toman partido**, aunque sus recursos no:
  - RZ-PED-627-V1: el pc y la rúbrica citan "> 2 kg" (p23).
  - RZ-PED-776-V1: el distractor y su entrada de la rúbrica se apoyan en el metaanálisis de la p15 (CPAP con surfactante selectivo), que es el lado de la 776 en la contradicción del surfactante.
  - En las dos guías, ningún recurso menciona el peso para la prueba de sudor ni el surfactante profiláctico.
- **Meta de saturación (GPC 044):** 88–92 % en la p15 y 88–95 % en las p17–19. Los casos y los recursos usan 88–95 %.
- **Corte de 35 semanas (GPC 262):** la p19 permite bilirrubina transcutánea con ≥ 35 semanas y la p20 pide la sérica siempre con ≤ 35 semanas. Además, en la p21 la bilirrubina conjugada dice "mayor de 14.7 mg/d", y en la p22 aparece 1.47 mg/dL (probable error de unidades). No afecta a los casos (34 y 39 semanas).
- **Umbrales de glucosa (GPC 442):**
  - La guía da cifras distintas: hipoglucemia con menos de 47 mg/dL (p19), tratar a la asintomática entre 25 y 45 mg/dL (p23), meta de más de 50 mg/dL (p21) y 45 frente a 50 mg/dL según AAP o PES (p20–21).
  - En la p23 dice que 38 mg/dL es común en recién nacidos sanos y aun así recomienda tratar entre 25 y 45 mg/dL. RZ-PED-442-V1 tiene 38 mg/dL y su rúbrica sigue la recomendación.
- **Cuándo aumentar líquidos (GPC 548):** la p20 dice Na > 150 mEq/L, diuresis < 0.5 mL/kg/h y densidad > 1008/1010; la p21 dice Na > 145, diuresis < 1 mL/kg/h y densidad > 1,020. El caso V1 y sus recursos siguen la p21.
- **Meta de saturación (GPC 776):** 90–95 % (p14), 88–95 % (p15, la que usa el V1), 90–92 % (p22) y 93–95 % en DBP establecida (p26). Las dosis de cafeína de la p24 tampoco coinciden entre párrafos.
- **Plazo del C3 bajo (GPC 826):** 8 semanas (p20), 8 a 10 semanas (p23) y 8 a 12 semanas para la biopsia (p19). Los casos y los recursos usan 8 semanas. En la p21 la evidencia dice que los calcioantagonistas favorecen la retención hídrica, y aun así la recomendación los indica.
- **Esquemas de vacunación (GPC 829):**
  - La guía da esquemas distintos para la embarazada no vacunada: 5 dosis (p26), 2 a 3 dosis (p27), 3 dosis (Cuadro 1, p43) y, en zona de alto riesgo, Td o TT desde la semana 20 y Tdap si es posible (algoritmo 2, p41).
  - Refuerzo: cada 10 años, o cada 5 en zona de alto riesgo (Cuadro 1), frente a cada 10 años (p26).
  - Los recursos usan el Cuadro 1 y las p25–27, como el pc y la rúbrica.
- **Otras inconsistencias internas de las guías** (detalle en `reportes/notas_subagentes/`):
  - 244 (p28): recomendación A de evitar antiepilépticos junto a una C para iniciarlos con factores de riesgo.
  - 269: periodo periconcepcional definido de dos formas (p13 y p14); probable "100 mg de harina" por 100 g (p13).
  - 395 (p28): inmunoglobulina tardía con aneurisma (después de 10 días se recomienda; después de 15 días sin fiebre ni reactantes elevados, no).
  - 475: duración de la bronquitis bacteriana persistente de 2–6 semanas (p14–15) frente a 2–4 semanas (p15).
  - 497: dosis distintas de midazolam (p19 y p75), ketamina (p18) y fenilefrina (p26 y p75), y una descripción farmacológica errónea de la dexmedetomidina (p20).
  - 625 (p21): en el 2.º trimestre, entre 9 y 10 mm la dilatación no cae en ninguna categoría.
  - 632: técnica de compresión de dos dedos (p43) frente a dos pulgares (p49).
  - 643: el algoritmo (p30) y el texto (p15) difieren en la primera línea de tratamiento y en la dieta durante la desimpactación.
  - 715: "infusión continua cada 6 a 8 horas" (p30) frente a "dividir en 3-4 dosis ... en infusión continua" (p31).
  - 724: la cafeína profiláctica tiene beneficio en la p21 y no se recomienda en la p22 (el caso V1 sigue la p22).
  - 725: 200,000 UI cada 6 meses (p17) frente a cada 4 a 6 meses (tabla de la p18).
  - 362 (p44): BCG con "34 SDG y > 2000 g" en la evidencia frente a "2000 g o > 34 SDG" en la recomendación.
- **Antigüedad:** varias guías son de 2008 a 2014. Los médicos deben valorar si alguna recomendación ya no es vigente antes de usarla en la evaluación. Ejemplos señalados durante la elaboración de los recursos:
  - 495 (p12): introducción tardía de alérgenos.
  - 602: lindano; además, "hervir a 50 °C" (p22).
  - 637: interferón en hepatitis C.
  - 496: criterios de la AAP 2004.
  - 469 (p13): "erradicación para 2020".
  - 029 (p44): jugos de fruta desde los 6 meses.

## Posibles errores en los casos

Estos puntos salieron al escribir los recursos. No se corrigió ningún caso: los médicos deben decidir. Cada guía tiene el detalle en `reportes/notas_subagentes/NNN.md`.

- **248-I:** el lactante tiene vómito, irritabilidad y fontanela tensa. La GPC pide valoración urgente por neurocirugía ante datos de hipertensión intracraneal (p21), pero la opción correcta solo dice "pediatría de segundo o tercer nivel".
- **469-V1:** una adolescente de 16 años recibe triple viral en campaña escolar; el esquema de la GPC da doble viral (SR) a partir de los 11 años (p15).
- **371-I:** el pc presenta la "asfixia con encefalopatía moderada a grave" como requisito, mientras que la GPC pone la encefalopatía como uno de varios criterios alternativos ("al menos uno", p37).
- **366-I:** el diagnóstico se basa en una aspiración con aguja fina que "sugiere" histiocitosis; la GPC pide biopsia con inmunofenotipo CD1a/langerina para el diagnóstico definitivo (p20).
- **258-V1:** la SpO2 de 92 % y el estridor en reposo corresponden a "moderada" en el Cuadro 1 de la GPC, pero el caso se maneja como grave. Conviene que la viñeta sea inequívoca.
- **548-V1:** la rúbrica llama "hipernatremia" a un Na de 148 mEq/L; la GPC la define como > 150 (p28).
- **510-V1:** un varón de 13 años en Tanner 1 cumpliría el criterio de referencia a endocrinología pediátrica (p32), y su velocidad de 4.5 cm/año está justo en el umbral de referencia (p31). El caso no lo menciona.
- **156-I:** la opción correcta (600 mL en 4 horas) cubre solo el déficit; la GPC agrega los líquidos de mantenimiento.
- **829-I:** la respuesta (Td en 2 a 3 dosis) no menciona la Tdap, que la misma GPC indica en todo embarazo (p27, Cuadro 1). Hay que revisar que sea coherente con el V1.
- **473-I:** la SpO2 de 95 % queda justo en el límite de "saturación menor de 95 %" que la GPC usa como hallazgo (p12).
- **733-I:** el inicio a los 9–10 años cae entre los dos rangos que da la GPC para la deficiencia primaria (2 a 7 y 11 a 14 años, p10). Además, la rúbrica cita como edad de inicio de la alergia a la proteína de la leche "1 a 3 meses" (p15), que en la guía es la prevalencia en ese grupo de edad.
- **715-V1:** la GPC no indica la vía de las dosis de estrés de hidrocortisona; el caso las plantea como intravenosas.
- **362-I:** la rúbrica dice que el antecedente "obliga a vacunar en las primeras 12 horas"; la GPC dice que hay que vacunar si en 12 horas no se demuestra que el HBsAg es negativo (matiz de redacción).
- **361-I:** solo 3 de 8 episodios tienen cultivo positivo. La p13 de la GPC pide episodios "comprobados" por estreptococo del grupo A; el Cuadro II de Paradise (p27) acepta datos clínicos o cultivo.
- **334-V1:** la viñeta menciona hemocultivo, que la GPC no recomienda de rutina en la evaluación inicial (p25).
- **137-I:** el distractor "extubar a PPC nasal y dar surfactante solo si falla" coincide con la estrategia que favorece la GPC 776, pero la rúbrica lo clasifica como error de lectura. Hay que revisarlo junto con la contradicción del surfactante.
- **632-I:** la rúbrica cita la p49 para el umbral de frecuencia cardiaca de las compresiones, pero esa página habla de epinefrina. El umbral solo aparece en el algoritmo (imagen, p75).
- **602-V1:** "lavar a 50 °C" parafrasea "hervir a 50 °C" (p22), que se contradice a sí mismo.
- **430-I:** aplica a un niño de 25 kg la dosis fija de nicotinamida de 300 mg/día que da la GPC (p17), sin ajuste por peso.

## Recursos de aprendizaje

Cada caso tiene recursos que se muestran después de responder: flashcards, un diagrama, resaltados de la viñeta, tablas e imágenes. Están en estado `borrador` y necesitan la misma revisión médica que los casos. El formato y las reglas R8–R14 están en el README.

### Conteo

| Tipo | Índice | Variante | Total |
|---|---|---|---|
| flashcard | 162 | — | 162 |
| diagrama | 54 | — | 54 |
| resaltado | 152 | 151 | 303 |
| tabla | 24 | — | 24 |
| imagen | 16 | — | 16 |
| **total** | **408** | **151** | **559** |

Cubre 54 guías (108 casos). La 027 no tiene recursos porque falta su PDF.

### Imágenes

Son 16, todas de Wikimedia Commons. Se revisaron visualmente después de descargarlas. Ninguna tiene licencia no comercial (NC) ni desconocida, y ninguna muestra la cara de un paciente. El origen y la licencia de cada una están en `reportes/imagenes.csv`.

| Caso | Contenido | Licencia |
|---|---|---|
| 032-I | Micrografía electrónica del VSR (CDC) | Dominio público |
| 062-I | Faringoamigdalitis estreptocócica, niño de 8 años | CC BY-SA 3.0 |
| 109-I | Manchas de Koplik | CC BY-SA 4.0 |
| 137-I | Radiografía de tórax de prematuro con SDR | CC0 |
| 258-I | Signo del campanario en laringotraqueítis | CC BY-SA 3.0 |
| 334-I | Signo del pulgar en epiglotitis (la descripción aclara que la GPC no pide esta radiografía) | CC0 |
| 366-I | Biopsia ósea de histiocitosis de células de Langerhans | CC BY 2.0 |
| 395-I | Eritema palmar en Kawasaki | CC BY 2.0 |
| 430-I | Pelagra en el dorso de las manos (CDC) | Dominio público |
| 459-I | Radiografía de manos con raquitismo | CC BY-SA 3.0 |
| 466-I | Exantema de escarlatina, niño de 8 años | CC BY-SA 4.0 |
| 495-I | Habones de urticaria | CC BY-SA 4.0 |
| 496-I | Otoscopia de otitis media aguda | CC BY 4.0 |
| 497-I | Esquema de tetralogía de Fallot (rótulos en inglés) | Dominio público |
| 601-I | Radiografía lateral con espondilólisis L5/S1 | CC BY-SA 3.0 |
| 602-I | Liendre adherida al pelo, al microscopio | CC BY 4.0 |

Pendientes para el médico:

- **430-I:** el archivo de Commons se llama "Alcoholic_pellagra", así que probablemente es de un adulto.
- **459-I:** la lesión metafisaria solo se ve en el borde inferior de la imagen.
- **466-I:** el exantema se distingue poco en piel oscura; la descripción lo dice.
- **Imágenes que se quitaron en la revisión:**
  - 643-I: radiografía de un adulto con impactación fecal.
  - 625-I: ultrasonido de hidronefrosis sin indicación de que el paciente fuera neonato.
  
  En Commons no había alternativas pediátricas.

### Casos índice sin imagen (38) y por qué

- **Mostraba la cara, los ojos o los genitales del paciente:**
  - Ictericia: 262.
  - Edema palpebral: 271.
  - Periné neonatal: 275.
  - Genitales: 467, 715.
  - Manchas de Bitot y xeroftalmía: 725.
  - Leucocoria: 793.
  - Prematuros y lactantes: 724, 734.
  - Lactancia: 029.
  - Otras: 371, 632.
- **Ninguna imagen aportaba a la decisión o tenía respaldo en la GPC:** 230, 244, 261, 269, 350, 361, 362, 418, 442, 469, 473, 475, 510, 540, 548, 637, 733.
- **No había una adecuada en Commons:**
  - 044 (taquipnea transitoria), 248 (hidrocefalia), 627 (prueba de sudor) y 826 (hematuria glomerular).
  - 625 y 643: se quitaron en la revisión.
- **Commons limitó las peticiones (HTTP 429):**
  - 156: no se consiguió.
  - 829: la tinción de Gram de *C. tetani* no se pudo descargar.
- **Habría reforzado un distractor:** 776 (la GPC dice que la DBP no requiere radiografía).

### Diagramas

50 de los 54 diagramas combinan recomendaciones de varias páginas de la misma guía, con hasta 4 citas por diagrama. Ningún diagrama mezcla guías. El médico debe confirmar que la secuencia que arma cada diagrama es la que la guía pretende, sobre todo en 244, 395, 442 y 724, donde la guía tiene recomendaciones en tensión.

### Avisos R12–R14

No quedan pendientes: ningún recurso menciona letras de opción ni copia la opción correcta, y todos los índices cubren los 4 tipos de error.

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
