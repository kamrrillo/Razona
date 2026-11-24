import { STUDY_SIZE } from "@/lib/study";

/**
 * Acuerdo de confidencialidad y uso de datos del estudio. Describe solo lo que la app guarda
 * de una participante de /estudio (profiles, attempts y study_sessions). Si cambia lo que se
 * recopila, hay que cambiar este texto.
 */
export function StudyAgreement() {
  return (
    <div className="space-y-2 text-sm leading-relaxed" data-testid="study-agreement">
      <p>
        Este estudio lo hace el equipo de Razona (curso de Inteligencia Artificial, PCIC-UNAM).
        Queremos saber si practicar con un tutor de IA ayuda más que practicar sin él. Son{" "}
        {STUDY_SIZE} preguntas.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <span className="font-semibold">Qué guardamos:</span> el nombre que escribas, el modo que
          elijas (con IA o sin IA) y, de cada pregunta, la opción que marcaste, si fue correcta y la
          hora. No pedimos correo, teléfono ni contraseña.
        </li>
        <li>
          <span className="font-semibold">Modo con IA:</span> lo que escribas en el diálogo con el
          tutor se manda al servicio de Google (Gemini) para generar la respuesta. No lo guardamos.
        </li>
        <li>
          <span className="font-semibold">Para qué:</span> solo para este estudio. Los resultados se
          reportan en conjunto, sin nombres.
        </li>
        <li>
          <span className="font-semibold">Quién lo ve:</span> solo el equipo del proyecto. No se
          comparte ni se vende.
        </li>
        <li>
          Puedes dejar de responder cuando quieras. Si quieres que borremos tus datos, pídeselo al
          equipo con el nombre que usaste.
        </li>
        <li>Las preguntas son de práctica y no sustituyen el criterio clínico.</li>
      </ul>
    </div>
  );
}
