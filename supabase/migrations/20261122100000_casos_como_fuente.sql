-- Razona · fase 2 del banco de casos: los intentos, sesiones y respuestas de examen
-- apuntan a casos_clinicos (el banco) en lugar de items (contenido de ejemplo).
--
-- NOT VALID: las filas existentes que apuntan a ítems de ejemplo no se revisan ni se
-- borran (historial anterior); toda fila NUEVA debe apuntar a un caso del banco.
-- Volver a sembrar a Ana (`pnpm seed:demo`) reemplaza su historial por uno del banco.
-- La tabla `items` queda sin uso y se elimina en la fase 3.

alter table public.attempts drop constraint attempts_item_id_fkey;
alter table public.attempts
  add constraint attempts_item_id_fkey
  foreign key (item_id) references public.casos_clinicos (id) not valid;

alter table public.exam_answers drop constraint exam_answers_item_id_fkey;
alter table public.exam_answers
  add constraint exam_answers_item_id_fkey
  foreign key (item_id) references public.casos_clinicos (id) not valid;

alter table public.study_sessions drop constraint study_sessions_item_id_fkey;
alter table public.study_sessions
  add constraint study_sessions_item_id_fkey
  foreign key (item_id) references public.casos_clinicos (id) not valid;
