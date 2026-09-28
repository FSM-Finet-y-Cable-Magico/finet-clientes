import type { Metadata } from "next";
import Link from "next/link";
import DocumentoLegal, {
  type SeccionLegal,
} from "../../_components/legal/DocumentoLegal";
import { Correo, Dato } from "../../_components/legal/Pendiente";
import TablaLegal from "../../_components/legal/TablaLegal";
import {
  COMPANY_ADDRESS,
  COMPANY_CONTACT_EMAIL,
  COMPANY_LEGAL_NAME,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
  COMPANY_RUT,
  COMPANY_STREET_ADDRESS,
  WHATSAPP_URL,
} from "../../_lib/company";
import {
  CALIDAD_SERVICIO,
  CONDICIONES_CONTRATO,
  LEGAL_ACTUALIZACION,
} from "../../_lib/legal";
import { metadataSeccion } from "../../_lib/seo";

/**
 * RNF-56.1: ISR explícito. El contenido son constantes de `_lib/legal.ts` y
 * `_lib/company.ts`, así que la página nunca depende de la base: esto deja la
 * ruta como ISR, que es lo que pide el requisito, y absorbe un futuro origen
 * de datos sin cambiar nada más. Un día, porque el texto solo cambia con un
 * deploy.
 */
export const revalidate = 86400;

export const metadata: Metadata = metadataSeccion({
  path: "/terminos",
  title: "Términos y condiciones",
  description:
    "Términos de uso del sitio y del servicio de Internet de Finet: planes y precios, neutralidad de red, cómo terminar tu contrato y cómo presentar un reclamo.",
});

const telefono = <a href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE_DISPLAY}</a>;
const whatsapp = (
  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
    WhatsApp
  </a>
);

const secciones: SeccionLegal[] = [
  {
    id: "quienes-somos",
    titulo: "Quiénes somos y qué regulan estos Términos",
    contenido: (
      <p>
        {COMPANY_LEGAL_NAME} es un proveedor de servicios de acceso a Internet
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
          un acceso no autorizado, avísanos de inmediato por {whatsapp}, al{" "}
          {telefono} o a <Correo valor={COMPANY_CONTACT_EMAIL} />.
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
          mantienen actualizados en <Link href="/planes">nuestra página de planes</Link>.
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

        <h3 id="gestion-trafico">Gestión de tráfico</h3>
        <p>
          No aplicamos herramientas de administración o gestión de tráfico que
          prioricen, degraden o limiten aplicaciones o servicios específicos.
          Las medidas de seguridad que aplicamos se limitan a{" "}
          <Dato valor={CALIDAD_SERVICIO.medidasSeguridadRed} />, y su único fin
          es preservar la integridad y la seguridad de la red y de sus
          usuarios.
        </p>

        <h3 id="caracteristicas">Características del servicio</h3>
        <TablaLegal
          titulo="Características del servicio"
          columnas={["Parámetro", "Detalle"]}
          filas={[
            ["Tecnología de acceso", "Fibra óptica (GPON)"],
            [
              "Velocidades comerciales disponibles",
              <Link key="planes" href="/planes">
                Ver planes
              </Link>,
            ],
            [
              "Velocidad mínima garantizada",
              <>
                <Dato valor={CALIDAD_SERVICIO.velocidadMinimaGarantizada} /> de
                la velocidad contratada
              </>,
            ],
            [
              "Nivel de agregación o sobreventa del enlace",
              <Dato key="sobreventa" valor={CALIDAD_SERVICIO.sobreventa} />,
            ],
            [
              "Disponibilidad del enlace",
              <Dato key="disponibilidad" valor={CALIDAD_SERVICIO.disponibilidad} />,
            ],
            [
              "Latencia y pérdida de paquetes",
              <Dato key="latencia" valor={CALIDAD_SERVICIO.latenciaYPerdida} />,
            ],
            [
              "Direccionamiento IP",
              <Dato key="ip" valor={CALIDAD_SERVICIO.direccionamientoIp} />,
            ],
          ]}
        />

        <h3 id="indicadores">Indicadores medidos</h3>
        <p>
          El Decreto 368 exige a los proveedores de Internet medir
          trimestralmente el tiempo de reposición del servicio, entendido como
          el período entre el momento en que un usuario reporta una falla y el
          momento en que el servicio se restablece, y mantener publicada y
          actualizada esa información.
        </p>
        <TablaLegal
          titulo="Indicadores de calidad medidos por trimestre"
          columnas={["Trimestre", "Tiempo promedio de reposición", "Disponibilidad del enlace"]}
          filas={[
            [
              <>
                Primera medición:{" "}
                <Dato valor={CALIDAD_SERVICIO.primeraMedicionReposicion} />
              </>,
              "—",
              "—",
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
          Puedes contratar desde <Link href="/planes">nuestra web</Link>, por
          teléfono al {telefono}, por {whatsapp} o de forma presencial en{" "}
          {COMPANY_ADDRESS.locality}. Antes de contratar te informamos el plan,
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
          Cómo hacerlo: escríbenos por {whatsapp}, llámanos al {telefono} o
          escribe a <Correo valor={COMPANY_CONTACT_EMAIL} />, indicando tu
          nombre, RUT y número de cliente. Solo el titular del contrato puede
          solicitarlo.
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
          reclamo por teléfono al {telefono}, por {whatsapp} o a{" "}
          <Correo valor={COMPANY_CONTACT_EMAIL} />. Te entregaremos un{" "}
          <strong>número de folio</strong> como comprobante. Conforme al
          Decreto N° 194 de 2013, tenemos un plazo máximo de{" "}
          <strong>5 días hábiles</strong> para responderte.
        </p>
        <p>
          <strong>Segunda instancia — Subtel.</strong> Si no respondemos dentro
          del plazo o la respuesta no te satisface, puedes insistir ante la
          Subsecretaría de Telecomunicaciones en{" "}
          <a href="https://tramites.subtel.gob.cl" target="_blank" rel="noopener noreferrer">
            tramites.subtel.gob.cl
          </a>
          . Subtel resuelve en un plazo aproximado de 30 días desde que recibe
          los antecedentes.
        </p>
        <p>
          En materias de consumo también puedes acudir al{" "}
          <strong>SERNAC</strong> (
          <a href="https://www.sernac.cl" target="_blank" rel="noopener noreferrer">
            sernac.cl
          </a>
          ).
        </p>
      </>
    ),
  },
  {
    id: "interrupciones",
    titulo: "Interrupciones del servicio",
    contenido: (
      <p>
        Ante una falla, repondremos el servicio en el menor plazo posible. Los
        descuentos o compensaciones por interrupciones se aplican conforme a la
        normativa vigente y a lo pactado en el contrato de servicio. Mecanismo
        de compensación:{" "}
        <Dato valor={CONDICIONES_CONTRATO.mecanismoCompensacion} />.
      </p>
    ),
  },
  {
    id: "propiedad-intelectual",
    titulo: "Propiedad intelectual",
    contenido: (
      <p>
        El contenido, marca, diseño y código de este sitio pertenecen a{" "}
        {COMPANY_LEGAL_NAME} o a sus licenciantes. No se permite su
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
        <Link href="/privacidad">Política de Privacidad</Link>.
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
        se rigen por la ley chilena. Para cualquier controversia son
        competentes los tribunales ordinarios de{" "}
        <Dato valor={CONDICIONES_CONTRATO.comunaTribunales} />, sin perjuicio
        del derecho del consumidor a recurrir ante SERNAC o Subtel.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <DocumentoLegal
      titulo="Términos y Condiciones de Uso y Servicio"
      encabezado={
        <p>
          {COMPANY_LEGAL_NAME} · RUT <Dato valor={COMPANY_RUT} /> ·{" "}
          <Dato valor={COMPANY_STREET_ADDRESS} />, {COMPANY_ADDRESS.locality},{" "}
          {COMPANY_ADDRESS.region} · Última actualización: {LEGAL_ACTUALIZACION}
        </p>
      }
      secciones={secciones}
    />
  );
}
