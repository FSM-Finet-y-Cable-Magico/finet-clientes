# El portal en la VPS compartida

La VPS de FiNet y Cable Mágico usa Docker rootless. Cada grupo tiene su cuenta y su carpeta, y G2
(Portal) usa los puertos 8200–8299. Los servicios se publican solo en `127.0.0.1` y se entra por túnel
SSH. El acceso lo entrega el equipo; no va en el repo.

| Servicio | Qué es | Puerto en la VPS |
|---|---|---|
| `proxy` | Caddy: `/api/*` → backend y el resto → vista. Un solo origen por sitio, por la cookie de sesión. | `127.0.0.1:8200` |
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

- **Finet:** `http://finet.localhost:18200`
- **Cable Mágico:** `http://cablemagico.localhost:18200`

Es el mismo túnel y el mismo puerto: el navegador resuelve solo cualquier `*.localhost` a tu máquina,
sin tocar el archivo `hosts`, y lo trata como origen seguro (deja guardar la cookie `Secure`). La vista
sabe de qué empresa es el sitio por ese nombre. Entrar por `localhost:18200` o `127.0.0.1` a secas
muestra Finet, pero la sesión y los enlaces de los correos van a `finet.localhost`.
- **Correos:** `http://localhost:18225`.

## Un host por empresa

Las dos empresas salen del mismo `proxy` y de los mismos contenedores. La vista reconoce de cuál es
el sitio por el host con que se entra, que tiene que ser el de una de estas URLs:

| Variable | Archivo | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `view.env` | URL del sitio de Finet |
| `NEXT_PUBLIC_SITE_URL_CABLE_MAGICO` | `view.env` | URL del sitio de Cable Mágico |
| `NEXT_PUBLIC_API_URL=/api` | `view.env` | El navegador llama al backend por el host en que está, así la sesión queda en ese host |
| `FRONTEND_URL_CABLE_MAGICO` | `controller.env` | La misma URL de Cable Mágico: adonde van sus correos y su vuelta de Webpay |
| `CORS_ORIGIN` | `controller.env` | Las dos URLs, separadas por coma |
| `NEXT_PUBLIC_SELECTOR_EMPRESA` | `view.env` | `false` esconde el selector Finet / Cable Mágico de la barra |

- Un host que no es ninguno de los dos muestra Finet. Un enlace viejo con `/cable-magico/...` lleva al
  host de Cable Mágico.
- Sin `NEXT_PUBLIC_SITE_URL_CABLE_MAGICO` y `FRONTEND_URL_CABLE_MAGICO`, Cable Mágico vuelve a vivir
  en el host de Finet, bajo `/cable-magico`.
- Cuando existan los dominios, se cambian esas URLs por las reales, se pone
  `NEXT_PUBLIC_SELECTOR_EMPRESA=false` (el selector es para la demostración) y se levanta de nuevo:
  no hay que tocar código. Las `NEXT_PUBLIC_*` se leen al compilar la vista, que compila al arrancar.

`crear-config.sh` ya escribe todo esto. En una instalación anterior al 11-11 (con
`http://localhost:18200`) se cambia a mano:

```sh
cd /srv/finet/grupo2/config
sed -i 's|http://localhost:18200|http://finet.localhost:18200|g' controller.env view.env chatbot.env
sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=/api|' view.env
echo 'NEXT_PUBLIC_SITE_URL_CABLE_MAGICO=http://cablemagico.localhost:18200' >> view.env
echo 'FRONTEND_URL_CABLE_MAGICO=http://cablemagico.localhost:18200' >> controller.env
sed -i 's|^CORS_ORIGIN=.*|&,http://cablemagico.localhost:18200|' controller.env
```

Las sesiones abiertas con el host anterior se pierden: hay que volver a entrar.

## Actualizar

```sh
git pull
docker compose -f deploy/vps/docker-compose.yml up -d --build
```

Si llegaron migraciones nuevas, antes se corre el `migrate deploy` del paso 3.

El asistente va primero: el backend le manda la empresa del sitio (`companyId`) y un `finet-chatbot`
anterior a eso rechaza el mensaje. Antes de actualizar el backend, copia la versión del asistente que
lo acepta (paso 2) y levántala con `up -d --build chatbot`.

## Comandos útiles

```sh
docker compose -f deploy/vps/docker-compose.yml ps
docker compose -f deploy/vps/docker-compose.yml logs --tail=100 controller
docker compose -f deploy/vps/docker-compose.yml stop
```
