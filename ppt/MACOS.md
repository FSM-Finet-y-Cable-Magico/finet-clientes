# Demo local en macOS

La demo de la rama `ppt` corre igual en macOS (12 o posterior, Apple Silicon o
Intel) y en Linux. Todo es local: base `finet_ppt`, correo en Mailpit y G8 y G3
simulados. Nada toca la VPS ni la base compartida.

## Una sola vez

**1. Herramientas.** Con [Homebrew](https://brew.sh):

```bash
xcode-select --install          # git, python3, perl, curl y openssl, si no los tienes
brew install node pnpm postgresql@17
brew services start postgresql@17
```

Node 20 o más (el equipo usa 24).

**2. El usuario de PostgreSQL que espera la demo.** Homebrew solo crea el tuyo,
sin clave, y la demo entra como `postgres` / `postgres` (la `DATABASE_URL` de
`apps/controller/.env`):

```bash
psql postgres -c "CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres'"
```

Si `psql` no aparece en tu terminal, está en `$(brew --prefix postgresql@17)/bin`.
Los scripts de `ppt/` lo buscan solos.

**3. Los dos repositorios, lado a lado** (la demo busca el chatbot en
`../Finet-Chatbot-2`; si lo dejas en otro lado, exporta `CHATBOT_DIR`):

```
~/Dev/finet-clientes     ← en la rama ppt
~/Dev/Finet-Chatbot-2
```

**4. La llave del LLM del chatbot.** No va al repo: copia `ppt/.local/llm.env`
desde el otro PC (por AirDrop o con tu gestor de contraseñas, no por correo ni
por chat), o créalo desde `ppt/llm.env.example` y pon tu `OPENAI_API_KEY`
(se saca en <https://console.groq.com/keys>).

**5. Dejar todo listo:**

```bash
cd ~/Dev/finet-clientes
ppt/preparar.sh
```

Revisa las herramientas, crea los `.env`, instala las dependencias de los dos
repos, compila el chatbot, baja Mailpit (verificado con su sha256) y crea la
base con los datos de la demo. Si falta algo, lo dice y se vuelve a correr: lo
que ya está hecho se salta.

## Cada vez que se use

```bash
ppt/levantar.sh      # la primera vez compila el sitio: unos minutos
ppt/verificar.sh     # opcional: todo responde, la base es la local y nada sale del equipo
ppt/detener.sh       # al terminar
```

Mientras se presenta, `caffeinate -dis` en otra terminal evita que el Mac se
duerma.

## Datos para la demostración técnica

Todas las cuentas usan la contraseña `Demo2026`. El sitio está en
<http://localhost:3000> y los correos en <http://localhost:8025>.

| Para | Dato |
|---|---|
| Iniciar sesión y pagar | Camila Rojas, RUT `16.234.567-2` |
| Facturas que se pueden pagar | #2 (9/2026, vencida) y #3 (10/2026), de $19.990 cada una |
| RUT del chatbot (el de la sesión) | `16.234.567-2` |
| RUT válido pero inexistente | `12.345.678-5` |

El pago dentro de Webpay (ambiente de integración) se hace a mano. Cada pago
aprobado deja la factura como Pagada; entre un ensayo y el siguiente:

```bash
ppt/rearmar-pagos.sh             # repone las facturas
ppt/rearmar-pagos.sh --correos   # y además vacía Mailpit
```

Para dejar la base de cero, con fechas de hoy: `ppt/base/reiniciar.sh` (con la
demo detenida).

## Si algo falla

- **«Permission denied» al correr un script.** Si el clon perdió el permiso de
  ejecución: `chmod +x ppt/*.sh ppt/base/*.sh`.
- **«El puerto N ya está en uso».** Mira quién lo tiene:
  `lsof -nP -iTCP:3000 -sTCP:LISTEN`. Si es la demo anterior, `ppt/detener.sh`.
- **macOS pregunta si `node` o `mailpit` pueden recibir conexiones.** La demo
  solo usa este equipo: cualquiera de las dos respuestas sirve.
- **«"mailpit" no se puede abrir porque no se puede verificar al desarrollador».**
  `xattr -d com.apple.quarantine ppt/.local/bin/mailpit`
- **El chatbot no responde o dice que no puede.** Revisa que `ppt/.local/llm.env`
  tenga la llave y mira `ppt/.local/logs/chatbot.log`.
- **Cuenta bloqueada por intentos fallidos.** `ppt/desbloquear.sh`.

## Qué cambia respecto de Linux

macOS no trae `ss`, `setsid`, `timeout`, `sha1sum` ni `/proc`, y su bash es el
3.2. Los scripts usan lo que haya en cada sistema (`lsof`, `perl`, `shasum`,
`ps`): en Linux se comportan como antes. Las funciones están en `ppt/lib.sh`.
