-- Especialidades del demo (catálogo). El contenido clínico vive en content/*.json.
insert into public.specialties (id, name, sort_order) values
  ('medicina-interna', 'Medicina interna', 1),
  ('pediatria', 'Pediatría', 2),
  ('ginecologia-obstetricia', 'Ginecología y obstetricia', 3),
  ('cirugia-general', 'Cirugía general', 4)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;
