import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import DocumentoLegal, {
  type SeccionLegal,
} from "../../../_components/legal/DocumentoLegal";
import { Correo, Dato, Pendiente } from "../../../_components/legal/Pendiente";
import TablaLegal from "../../../_components/legal/TablaLegal";
import { LEGAL_ACTUALIZACION, legalesDe } from "../../../_lib/legal";
import { metadataSeccion } from "../../../_lib/seo";
import { marcaPorSlug, rutaMarca, type Marca } from "../../../_lib/company";

/**
 * RNF-56.1: ISR explícito. El contenido son constantes de `_lib/legal.ts` y
 * `_lib/company.ts`, así que la página nunca depende de la base: esto deja la
 * ruta como ISR, que es lo que pide el requisito, y absorbe un futuro origen
 * de datos sin cambiar nada más. Un día, porque el texto solo cambia con un
 * deploy.
 */
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ marca: string }>;
}): Promise<Metadata> {
  const marca = marcaPorSlug((await params).marca);
  return metadataSeccion({
    path: "/terminos",
    title: "Términos y condiciones",
    description:
      `Términos de uso del sitio y del servicio de Internet de ${marca.nombre}: planes y precios, neutralidad de red, cómo terminar tu contrato y cómo presentar un reclamo.`,
  }, marca);
}

/** "A, B o C": los canales que la empresa tiene, sin los que le faltan. */
function unoDe(...canales: ReactNode[]): ReactNode {
  const hay = canales.filter(Boolean);
  return hay.map((canal, i) => (
    <Fragment key={i}>
      {i === 0 ? "" : i === hay.length - 1 ? " o " : ", "}
      {canal}
    </Fragment>
  ));
}

/** Las secciones con los datos de la empresa del sitio. */
function seccionesDe(marca: Marca): SeccionLegal[] {
  const legal = legalesDe(marca);
  const telefono = <a href={`tel:${marca.telefono.tel}`}>{marca.telefono.display}</a>;
  const whatsapp = (
    <a href={marca.whatsappUrl} target="_blank" rel="noopener noreferrer">
      WhatsApp
    </a>
  );
  // Un canal más, si la empresa lo tiene: el correo es opcional (DS 194, art. 5).
  const correo = marca.correoContacto && <Correo valor={marca.correoContacto} />;

  return [
    {
      id: "quienes-somos",
      titulo: "Quiénes somos y qué regulan estos Términos",
      contenido: (
        <p>
          {marca.razonSocial} es un proveedor de servicios de acceso a Internet
          inscrito ante la Subsecretaría de Telecomunicaciones (Subtel). Estos
          Términos regulan el uso de este sitio web y del Portal de Clientes, y
          complementan el contrato de servicio que suscribes al contratar. En
          caso de discrepancia entre ambos, prevalece el contrato de servicio y,
          sobre todo, la norma más favorable al consumidor.
        </p>
      ),
    },
    {
      id: "uso",
      titulo: "Uso del sitio y del Portal de Clientes",
      contenido: (
        <>
          <p>
            El Portal está disponible solo para clientes con servicio
            contratado. Eres responsable de mantener la confidencialidad de tu
            contraseña y de las acciones realizadas desde tu sesión. Si detectas
            un acceso no autorizado, avísanos de inmediato{" "}
            {unoDe(<>por {whatsapp}</>, <>al {telefono}</>, correo && <>a {correo}</>)}.
          </p>
          <p>
            A través del Portal puedes consultar tu plan y el estado de tus
            servicios, revisar tu deuda e iniciar su pago, ver tus tickets de
            soporte, solicitar el cambio de la clave de tu red WiFi, medir la
            velocidad de tu conexión y actualizar tus datos de contacto y tu
            contraseña. Estas funciones dependen de la disponibilidad de la
            plataforma y de los sistemas de gestión de red; podemos suspenderlas
            temporalmente por mantención, avisando cuando sea posible.
          </p>
          <p>
            No está permitido usar el sitio o el Portal para acceder a cuentas
            de terceros, vulnerar medidas de seguridad, automatizar consultas
            masivas o interferir con la operación del servicio.
          </p>
        </>
      ),
    },
    {
      id: "planes",
      titulo: "Planes, precios y cambios de plan",
      contenido: (
        <>
          <p>
            Los planes vigentes, con sus velocidades y precios, se publican y
            mantienen actualizados en <Link href={rutaMarca(marca, "/planes")}>nuestra página de planes</Link>.
            Puedes cambiarte a cualquier otro plan vigente de nuestro catálogo
            sin multas ni recargos por el solo hecho del cambio, solicitándolo
            por cualquiera de nuestros canales de atención.
          </p>
          <p>
            Los precios se expresan en pesos chilenos e incluyen IVA. Cualquier
            modificación de las condiciones contratadas te será informada
            previamente en los términos que exige la ley.
          </p>
        </>
      ),
    },
    {
      id: "neutralidad",
      titulo: "Calidad, velocidad y neutralidad de la red",
      contenido: (
        <>
          <p>
            Cumplimos la Ley N° 20.453 y el Decreto Supremo N° 368 de 2010, que
            consagran la neutralidad de la red.
          </p>
          <p>
            <strong>
              No bloqueamos, interferimos, discriminamos ni restringimos
              arbitrariamente
            </strong>{" "}
            el derecho de nuestros usuarios a utilizar, enviar, recibir u
            ofrecer cualquier contenido, aplicación o servicio legal a través de
            Internet. Tampoco condicionamos la contratación al uso de
            aplicaciones o servicios determinados.
          </p>
          <p>
            Puedes conectar a la red los equipos que estimes, siempre que sean
            legales y no dañen la red ni la calidad del servicio.
          </p>

          <h3 id="gestion-trafico">Gestión de tráfico y administración de red</h3>
          <p>
            Medidas que aplicamos, con sus características y sus efectos en el
            servicio (Decreto 368, art. 5 letra f):{" "}
            <Dato valor={legal.gestionTrafico} />.
          </p>

          <h3 id="control-parental">Control parental</h3>
          <p>
            Ponemos a disposición de quien lo solicite un servicio de control
            parental que bloquea contenidos que atenten contra la ley, la moral o
            las buenas costumbres (Decreto 368, art. 9). Cómo funciona, cómo
            usarlo y su costo: <Dato valor={legal.controlParental} />.
          </p>

          <h3 id="caracteristicas">Características del servicio</h3>
          <TablaLegal
            titulo="Características del servicio"
            columnas={["Parámetro", "Detalle", "Norma"]}
            filas={[
              ["Tecnología de acceso", "Fibra óptica (GPON)", "Ley N° 18.168, art. 24 H letra d"],
              [
                "Velocidades comerciales disponibles",
                <Link key="planes" href={rutaMarca(marca, "/planes")}>
                  Ver planes
                </Link>,
                "Decreto 368, art. 5 letra a",
              ],
              [
                "Velocidad garantizada: porcentaje de la velocidad promedio, en horario de mayor y menor congestión, nacional e internacional",
                <Dato key="garantizada" valor={legal.velocidadGarantizada} />,
                "Ley N° 18.168, art. 24 K",
              ],
              [
                "Límite de descarga",
                <Dato key="descarga" valor={legal.limiteDescarga} />,
                "Decreto 368, art. 5 letra a",
              ],
              [
                "Tasa de agregación o sobreventa (1:XX)",
                <Dato key="sobreventa" valor={legal.sobreventa} />,
                "Decreto 368, art. 5 letra b",
              ],
              [
                "Calidad y disponibilidad del enlace, nacional e internacional",
                <Dato key="enlace" valor={legal.calidadEnlace} />,
                "Decreto 368, art. 5 letra e",
              ],
            ]}
          />

          <h3 id="indicadores">Indicadores medidos</h3>
          <p>
            El Decreto 368 exige a los proveedores de Internet medir
            trimestralmente los indicadores técnicos de calidad de servicio y el
            tiempo de reposición del servicio, entendido como el período entre
            el momento en que un usuario reporta una falla y el momento en que
            el servicio se restablece, y mantener publicada y actualizada esa
            información (arts. 3, 4 y 5). Trimestre medido:{" "}
            <Dato valor={legal.trimestre} />.
          </p>
          <TablaLegal
            titulo="Indicadores de calidad medidos por trimestre"
            columnas={["Indicador", "Resultado", "Norma"]}
            filas={[
              [
                "Tiempo de acceso de usuario (login): percentiles 80 y 95",
                <Dato key="login" valor={legal.tiempoLogin} />,
                "Art. 5 letra c, N° 1",
              ],
              [
                "Velocidad de transmisión de datos conseguida: máxima, mínima, promedio y desviación estándar, de subida y de bajada",
                <Dato key="velocidad" valor={legal.velocidadConseguida} />,
                "Art. 5 letra c, N° 2",
              ],
              [
                "Transmisiones de datos fallidas (%)",
                <Dato key="fallidas" valor={legal.transmisionesFallidas} />,
                "Art. 5 letra c, N° 3",
              ],
              [
                "Accesos de usuario con éxito (%)",
                <Dato key="exitosos" valor={legal.accesosExitosos} />,
                "Art. 5 letra c, N° 4",
              ],
              [
                "Retardo: promedio y desviación estándar, en milisegundos",
                <Dato key="retardo" valor={legal.retardo} />,
                "Art. 5 letra c, N° 5",
              ],
              [
                "Tiempo de reposición del servicio: percentiles 80 y 95",
                <Dato key="reposicion" valor={legal.tiempoReposicion} />,
                "Art. 5 letra d, N° 1",
              ],
              [
                "Fallas reparadas dentro de nuestro tiempo objetivo (%), y ese tiempo",
                <Dato key="objetivo" valor={legal.reparadasEnTiempoObjetivo} />,
                "Art. 5 letra d, N° 2",
              ],
            ]}
          />
        </>
      ),
    },
    {
      id: "termino",
      titulo: "Contratación y término del contrato",
      contenido: (
        <>
          <h3 id="como-contratar">Cómo contratar</h3>
          <p>
            Puedes contratar desde <Link href={rutaMarca(marca, "/planes")}>nuestra web</Link>, por
            teléfono al {telefono}, por {whatsapp} o de forma presencial en{" "}
            {marca.direccion.comuna}. Antes de contratar te informamos el plan,
            el precio total, el plazo de instalación y las condiciones
            aplicables.
          </p>

          <h3 id="como-terminar">Cómo terminar tu contrato</h3>
          <p>
            <strong>
              Puedes poner término a tu contrato en cualquier momento y sin
              expresar causa.
            </strong>{" "}
            Ponemos a tu disposición{" "}
            <strong>los mismos canales que usaste para contratar</strong>: si
            contrataste por la web, puedes terminarlo por la web.
          </p>
          <p>
            Cómo hacerlo:{" "}
            {unoDe(
              <>escríbenos por {whatsapp}</>,
              <>llámanos al {telefono}</>,
              correo && <>escribe a {correo}</>,
            )}
            , indicando tu nombre, RUT y número de cliente. Solo el titular del
            contrato puede solicitarlo.
          </p>
          <p>
            Condiciones que <strong>no</strong> te podemos exigir para dar
            término al contrato: pagar por ejercer este derecho, pagar
            previamente las deudas pendientes, o devolver los equipos como
            requisito previo. Las deudas y la devolución de equipos se gestionan
            por separado, sin bloquear la baja.
          </p>
          <p>
            Plazo: damos término al contrato dentro de{" "}
            <strong>1 día hábil</strong> desde tu solicitud, y te enviamos una
            confirmación por escrito con el número de folio.
          </p>
        </>
      ),
    },
    {
      id: "reclamos",
      titulo: "Reclamos",
      contenido: (
        <>
          <p>
            Puedes reclamar por cobros que no reconoces, por incumplimiento de
            las condiciones contratadas o por la calidad del servicio.
          </p>
          <p>
            <strong>Primera instancia — con nosotros.</strong> Presenta tu
            reclamo{" "}
            {unoDe(<>por teléfono al {telefono}</>, <>por {whatsapp}</>, correo && <>a {correo}</>)}
            . Horario de atención: <Dato valor={marca.horario} />. Te
            entregaremos un <strong>número de folio</strong> como comprobante.
            Conforme al Decreto N° 194 de 2013, tenemos un plazo máximo de{" "}
            <strong>5 días hábiles</strong> para responderte.
          </p>
          <p>
            <strong>Segunda instancia — Subtel.</strong> Si no estás conforme con
            nuestra respuesta, puedes insistir ante la Subsecretaría de
            Telecomunicaciones en{" "}
            <a href="https://tramites.subtel.gob.cl" target="_blank" rel="noopener noreferrer">
              tramites.subtel.gob.cl
            </a>{" "}
            dentro de los 30 días hábiles siguientes a su notificación. Subtel
            resuelve dentro de 15 días hábiles desde que recibe nuestro informe
            (Decreto N° 194, arts. 14 y 16).
          </p>
          <p>
            En materias de consumo también puedes acudir al{" "}
            <strong>SERNAC</strong> (
            <a href="https://www.sernac.cl" target="_blank" rel="noopener noreferrer">
              sernac.cl
            </a>
            ).
          </p>
          <p>
            Puedes leer el{" "}
            <a
              href="https://www.bcn.cl/leychile/navegar?idNorma=1048887"
              target="_blank"
              rel="noopener noreferrer"
            >
              Reglamento de reclamos (Decreto N° 194)
            </a>{" "}
            y el informativo de Subtel con los principales derechos de los
            usuarios:{" "}
            {legal.informativoSubtel ? (
              <a href={legal.informativoSubtel} target="_blank" rel="noopener noreferrer">
                informativo de derechos
              </a>
            ) : (
              <Pendiente />
            )}{" "}
            (art. 33).
          </p>

          <h3 id="atencion-reclamos">Atención telefónica de reclamos</h3>
          <p>
            Mes informado: <Dato valor={legal.mesReclamos} />.
          </p>
          <TablaLegal
            titulo="Indicadores de la línea telefónica de reclamos"
            columnas={["Indicador", "Resultado", "Norma"]}
            filas={[
              [
                "Llamadas que entraron al servicio de reclamos, sobre el total de llamadas (%)",
                <Dato key="atendidas" valor={legal.llamadasAtendidas} />,
                "Decreto N° 194, art. 6 N° 1",
              ],
              [
                "Tiempo de espera hasta ser atendido: promedio y desviación estándar",
                <Dato key="espera" valor={legal.tiempoEspera} />,
                "Decreto N° 194, art. 6 N° 2",
              ],
              [
                "Llamadas en que el usuario cuelga sin ser atendido, sobre las entrantes (%)",
                <Dato key="abandonadas" valor={legal.llamadasAbandonadas} />,
                "Decreto N° 194, art. 6 N° 3",
              ],
            ]}
          />
        </>
      ),
    },
    {
      id: "interrupciones",
      titulo: "Interrupciones del servicio",
      contenido: (
        <p>
          Ante una falla, repondremos el servicio en el menor plazo posible. Si
          el servicio se suspende, interrumpe o altera por una causa que no te
          sea imputable por más de 6 horas en un día, o de 12 horas continuas o
          discontinuas en el mes, lo descontamos de tu tarifa mensual a razón de
          un día por cada 24 horas o fracción superior a 6 horas. Si supera las
          48 horas continuas o discontinuas en el mes y no se debe a fuerza mayor
          o hecho fortuito, además te indemnizamos con el triple de la tarifa
          diaria por cada día. Los descuentos e indemnizaciones se aplican en tu
          cuenta mensual más próxima (Ley N° 18.168, art. 27).
        </p>
      ),
    },
    {
      id: "propiedad-intelectual",
      titulo: "Propiedad intelectual",
      contenido: (
        <p>
          El contenido, marca, diseño y código de este sitio pertenecen a{" "}
          {marca.razonSocial} o a sus licenciantes. No se permite su
          reproducción sin autorización.
        </p>
      ),
    },
    {
      id: "datos-personales",
      titulo: "Datos personales",
      contenido: (
        <p>
          El tratamiento de tus datos se rige por nuestra{" "}
          <Link href={rutaMarca(marca, "/privacidad")}>Política de Privacidad</Link>.
        </p>
      ),
    },
    {
      id: "modificaciones",
      titulo: "Modificaciones y legislación aplicable",
      contenido: (
        <p>
          Podemos actualizar estos Términos; la versión vigente será siempre la
          publicada en esta página con su fecha de actualización. Estos Términos
          se rigen por la ley chilena, sin perjuicio del derecho del consumidor
          a recurrir ante SERNAC o Subtel.
        </p>
      ),
    },
    ];
}

export default async function TerminosPage({
  params,
}: {
  params: Promise<{ marca: string }>;
}) {
  const marca = marcaPorSlug((await params).marca);
  const secciones = seccionesDe(marca);
  return (
    <DocumentoLegal
      titulo="Términos y Condiciones de Uso y Servicio"
      encabezado={
        <p>
          {marca.razonSocial}
          {marca.rut && <> · RUT {marca.rut}</>} ·{" "}
          <Dato valor={marca.direccion.calle} />, {marca.direccion.comuna},{" "}
          {marca.direccion.region} · Última actualización: {LEGAL_ACTUALIZACION}
        </p>
      }
      secciones={secciones}
    />
  );
}
