-- Correos reales de los usuarios de prueba, que no van al repo (los pasa
-- crear.sh desde ppt/.local/correo-demo y correo-registro).
-- Cada usuario lleva su variante del mismo correo (nombre+camila@…): llegan
-- todos a la misma casilla y ninguno se repite, porque Mi Perfil no deja poner
-- un correo que ya tiene otro cliente.
SELECT :'correo' <> '' AS hay_correo, :'registro' <> '' AS hay_registro \gset
\if :hay_correo
  UPDATE cliente
     SET email = split_part(:'correo', '@', 1) || '+'
              || translate(lower(split_part(nombre_completo, ' ', 1)), 'áéíóúñ', 'aeioun')
              || '@' || split_part(:'correo', '@', 2);
  UPDATE usuario SET email = split_part(:'correo', '@', 1) || '+soporte@' || split_part(:'correo', '@', 2);
\endif
-- Ignacio, el que se registra en la demo, usa el otro correo tal cual.
\if :hay_registro
  UPDATE cliente SET email = :'registro' WHERE rut = '22456789-8';
\endif
UPDATE prospecto p SET email = c.email FROM cliente c WHERE c.id_cliente = p.id_cliente;
