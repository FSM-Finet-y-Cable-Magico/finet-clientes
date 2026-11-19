# Demo local (rama `ppt`)

Levanta el portal completo en un solo equipo para presentarlo y ensayarlo: el
sitio, la API, el chatbot, el correo y los simuladores de los otros grupos. Todo
corre contra la base local `finet_ppt`. Nada toca la VPS ni la base compartida:
antes de arrancar cada servicio, `levantar.sh` revisa que todas sus URL apunten
a este equipo (salvo fast.com, el LLM del chatbot y, si existe
`ppt/.local/smtp-real.env`, el Gmail de cada empresa).

| Servicio | Puerto | Qué es |
|---|---|---|
| Sitio | 3000 | `apps/view` (Next.js); Cable Mágico en `/cable-magico` |
| API | 4000 | `apps/controller` (NestJS), con prefijo `/api` |
| Chatbot | 3001 | `Finet-Chatbot-2`, con el LLM de `ppt/.local/llm.env` |
| Mailpit | 1025 y 8025 | recibe todo lo que manda el portal; se lee en <http://localhost:8025> |
| G8 simulado | 4900 | saldo de facturas y registro de pagos, contra la base local |
| G3 simulado | 4901 | cambio de clave WiFi |

El pago usa Webpay en su **ambiente de integración**, que necesita internet.

## Dónde corre

- **Linux:** directo.
- **macOS:** ver [`MACOS.md`](MACOS.md).
- **Windows:** dentro de WSL2 (ver más abajo). Los scripts son de bash y usan
  herramientas de Linux; Git Bash no alcanza.

## Primera vez

```bash
ppt/preparar.sh     # herramientas, .env, dependencias, chatbot, Mailpit y base
ppt/levantar.sh     # la primera vez compila el sitio: unos minutos
```

Antes hacen falta, además de las herramientas (`preparar.sh` dice cuáles faltan):

- El repositorio del chatbot en `../Finet-Chatbot-2` (o `CHATBOT_DIR` apuntando a
  donde esté).
- La llave del LLM en `ppt/.local/llm.env` (plantilla: `ppt/llm.env.example`).

## Scripts

| Script | Para qué |
|---|---|
| `preparar.sh` | Deja el equipo listo; se puede repetir. |
| `levantar.sh` | Levanta todo y muestra las direcciones y los usuarios de prueba. |
| `detener.sh` | Baja los servicios. La base queda como está. |
| `verificar.sh` | Todo responde, la base es la local y ningún proceso apunta fuera del equipo. |
| `base/crear.sh` | Crea `finet_ppt`, aplica las migraciones y carga `base/datos.sql`. |
| `base/reiniciar.sh` | Borra la base y la vuelve a crear, con fechas de hoy (con la demo detenida). |
| `rearmar-pagos.sh` | Repone las facturas pagadas en un ensayo, sin reiniciar nada. `--correos` vacía también Mailpit. |
| `desbloquear.sh` | Borra los intentos fallidos de inicio de sesión (RF-05). |
| `vencer-sesiones.sh` | Vence las sesiones del portal, como si hubieran pasado los 15 minutos (CU-12). |
| `disparar-avisos.sh` | Manda ahora el recordatorio de pago (CU-67) y el aviso de corte (CU-68). |
| `aceptar-prospecto.sh <RUT>` | Hace lo que haría G8: convierte en cliente a quien pidió un plan en «Contratar». |
| `probar-todo.sh` | Prueba de punta a punta (Playwright), en las dos empresas y en celular. Deja la base de cero. |

## Datos de la demo

`base/datos.sql` carga clientes, planes, contratos, facturas, pagos y tickets
ficticios; todas las cuentas usan la contraseña `Demo2026`. Las fechas son
relativas al día en que se carga, así que siempre hay facturas vencidas, dos que
vencen en 3 días y una que venció ayer. `levantar.sh` imprime la lista de
usuarios. Para la demostración técnica, ver [`DEMO-TECNICA.md`](DEMO-TECNICA.md).

La semilla la comparten el equipo y `probar-todo.sh` (que espera, por ejemplo, el
saldo de $39.980 de Camila): para ensayar sin ensuciarla, usar `rearmar-pagos.sh`
en vez de cambiarla.

## Qué queda en `ppt/.local/` (no va a git)

| Archivo | Qué es |
|---|---|
| `llm.env` | Llave del LLM del chatbot (obligatoria). |
| `secretos.env`, `g3-privada.pem`, `g3-publica.pem` | Se crean solos la primera vez. Nunca se comparten. |
| `bin/mailpit` | Lo baja `preparar.sh`. |
| `smtp-real.env` | Opcional: cuentas Gmail reales; con él los correos salen de verdad. Nunca se comparte. |
| `correo-demo`, `correo-registro`, `ip-vps` | Opcionales: correos reales de los usuarios de prueba y la IP de la VPS (para comprobar que no hay conexiones con ella). |
| `logs/`, `pids/`, `vista.huella` | Logs de cada servicio, sus procesos y la huella que decide si hay que recompilar el sitio. |

## Variables útiles

- `CHATBOT_DIR`: dónde está `Finet-Chatbot-2`.
- `PPT_CORREO=mailpit`: aunque exista `smtp-real.env`, manda todo a Mailpit.
- `PPT_SIN_BLOQUEO_IP` (por defecto `1`) y `PPT_MULTIPLICADOR_LIMITES` (por defecto
  `20`): en la demo todos los usuarios salen del mismo equipo, así que no hay
  bloqueo por IP y los límites por ruta se multiplican. Para mostrar el CU-05 o el
  CU-83 como en `main`: `PPT_SIN_BLOQUEO_IP=0 PPT_MULTIPLICADOR_LIMITES=1 ppt/levantar.sh`.

## Windows (WSL2)

1. Instalar Ubuntu en WSL2 (`wsl --install -d Ubuntu`) y activar systemd en
   `/etc/wsl.conf` (`[boot]` con `systemd=true`), para que PostgreSQL arranque solo.
2. Dentro de Ubuntu: `git`, `curl`, `openssl`, `python3`, `perl`, `lsof` y
   `postgresql`; Node 20 o más (el equipo usa 24) y `pnpm`.
3. Dejar la clave de PostgreSQL como la espera `apps/controller/.env.example`:
   `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres'"`.
4. Clonar los dos repositorios **dentro del disco de Linux** (`~/`), no en
   `/mnt/c`: es mucho más rápido y evita los finales de línea de Windows.
5. Seguir con «Primera vez». El navegador de Windows entra a `localhost` sin
   configurar nada.

WSL apaga la instancia cuando no queda ningún proceso abierto en una sesión, y
con ella los servicios. Mientras se use la demo, dejar abierta una terminal con
`wsl -d Ubuntu -- sleep infinity`.

Los `.sh` se guardan siempre con LF (`.gitattributes`): con CRLF el shebang queda
como `bash\r` y no corren.
