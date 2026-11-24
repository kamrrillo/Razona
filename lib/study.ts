/**
 * Estudio (/estudio): cada participante responde estas preguntas, en este orden, y termina.
 * Son las mismas para el modo con IA y el modo sin IA, para poder comparar.
 * Un caso índice por área; todos tienen recursos de aprendizaje.
 */
export const STUDY_CASE_IDS = [
  "RZ-PED-032-I", // Bronquiolitis aguda
  "RZ-PED-156-I", // Diarrea aguda
  "RZ-PED-044-I", // Taquipnea transitoria del recién nacido
  "RZ-PED-271-I", // Síndrome nefrótico primario
  "RZ-PED-244-I", // Primera crisis convulsiva
] as const;

export const STUDY_SIZE = STUDY_CASE_IDS.length;
