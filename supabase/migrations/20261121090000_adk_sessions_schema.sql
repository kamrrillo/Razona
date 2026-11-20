-- Esquema privado para las sesiones de Google ADK del agente de Python (DatabaseSessionService).
-- ADK crea sus tablas aquí al primer uso. No se expone por la Data API de Supabase (solo `public`)
-- y anon/authenticated no tienen permisos: solo el agente lo usa, desde el servidor.
create schema if not exists adk;
revoke all on schema adk from public;
revoke all on schema adk from anon, authenticated;
