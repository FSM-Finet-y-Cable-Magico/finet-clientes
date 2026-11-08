# El portal en la VPS compartida

La VPS de FiNet y Cable Mágico usa Docker rootless. Cada grupo tiene su cuenta y su carpeta, y G2
(Portal) usa los puertos 8200–8299. Los servicios se publican solo en `127.0.0.1` y se entra por túnel
SSH. El acceso lo entrega el equipo; no va en el repo.

| Servicio | Qué es | Puerto en la VPS |
|---|---|---|
| `proxy` | Caddy: `/api/*` → backend y el resto → vista. Un solo origen, por la cookie de sesión. | `127.0.0.1:8200` |
| `mailpit` | Buzón de prueba de los correos del portal | `127.0.0.1:8225` |
| `controller` | Backend (NestJS) | solo interno |
| `chatbot` | Asistente virtual (`finet-chatbot`, otro repo). Solo lo llama el backend. | solo interno |
| `view` | Vista (Next.js). Se compila al arrancar, con el backend ya arriba (sitemap, CU-74). | solo interno |
| `db` | Postgres propio del portal | solo interno |

Los puertos de cada servicio se definen en `deploy/vps/.env` (ver `.env.example`). De ahí sale también
la dirección con la que se llaman entre ellos, así que un puerto se cambia en un solo lugar. El de la base
(5432, en `DATABASE_URL`) y el de SMTP (1025, en `SMTP_PORT`) están en `controller.env`.

## Primera vez

1. **Clonar** el repo en la carpeta del grupo, en la rama `dev`.
2. **Armar la configuración, fuera del repo.**
   - Las claves de otros grupos (G8 y G3), la de fast.com y las `OPENAI_*` del asistente entran por la
     entrada estándar. No se guarda ninguna copia.
   - El resto se genera en el servidor.

   ```sh
   sh deploy/vps/crear-config.sh < claves-externas.env
   ```

   Deja `db.env`, `controller.env`, `view.env` y `chatbot.env` en `/srv/finet/grupo2/config`, con
   permisos 600, y crea `deploy/vps/.env` con los puertos.

   El código del asistente se copia desde un equipo con acceso a su repo privado, para no dejar
   credenciales de GitHub en la VPS. Desde la carpeta de ese repo:
   ```sh
   git archive main | ssh <cuenta>@<vps> 'mkdir -p /srv/finet/grupo2/finet-chatbot && tar -x -C /srv/finet/grupo2/finet-chatbot'
   ```
3. **Construir y migrar.** La migración es solo para esta base propia; en una base compartida, nunca.
   El backend no queda sano hasta que la base tenga las tablas, así que va antes que lo demás:
   ```sh
   docker compose -f deploy/vps/docker-compose.yml build
   docker compose -f deploy/vps/docker-compose.yml up -d db mailpit
   docker compose -f deploy/vps/docker-compose.yml run --rm --no-deps controller pnpm exec prisma migrate deploy
   ```
4. **Levantar todo:**
   ```sh
   docker compose -f deploy/vps/docker-compose.yml up -d
   ```

## Entrar desde tu computador

Abre el túnel y deja esa ventana abierta:

```sh
ssh -N -L 127.0.0.1:18200:127.0.0.1:8200 -L 127.0.0.1:18225:127.0.0.1:8225 <cuenta>@<vps>
```

- **Portal:** `http://localhost:18200`. Usa `localhost` y no `127.0.0.1`: es el origen configurado y el
  que deja guardar la cookie `Secure`.
- **Correos:** `http://localhost:18225`.

## Actualizar

```sh
git pull
docker compose -f deploy/vps/docker-compose.yml up -d --build
```

Si llegaron migraciones nuevas, antes se corre el `migrate deploy` del paso 3.

## Comandos útiles

```sh
docker compose -f deploy/vps/docker-compose.yml ps
docker compose -f deploy/vps/docker-compose.yml logs --tail=100 controller
docker compose -f deploy/vps/docker-compose.yml stop
```
