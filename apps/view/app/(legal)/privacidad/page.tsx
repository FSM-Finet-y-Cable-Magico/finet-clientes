import type { Metadata } from "next";
import DocumentoLegal, {
  type SeccionLegal,
} from "../../_components/legal/DocumentoLegal";
import { Correo, Dato } from "../../_components/legal/Pendiente";
import TablaLegal from "../../_components/legal/TablaLegal";
import {
  COMPANY_ADDRESS,
  COMPANY_LEGAL_NAME,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
  COMPANY_PRIVACY_EMAIL,
  COMPANY_RUT,
  COMPANY_STREET_ADDRESS,
} from "../../_lib/company";
import {
  LEGAL_ACTUALIZACION,
  PLAZOS_DATOS,
  POLITICA_PRIVACIDAD_VERSION,
  PROVEEDORES,
} from "../../_lib/legal";
import { metadataSeccion } from "../../_lib/seo";

export const metadata: Metadata = metadataSeccion({
  path: "/privacidad",
  title: "Política de privacidad",
  description:
    "Cómo Finet trata tus datos personales: qué datos usamos y para qué, cookies, plazos de conservación, con quién los compartimos y cómo ejercer tus derechos.",
});

const domicilio = (
  <>
    <Dato valor={COMPANY_STREET_ADDRESS} />, {COMPANY_ADDRESS.locality},{" "}
    {COMPANY_ADDRESS.region}
  </>
);

const secciones: SeccionLegal[] = [
  {
    id: "quienes-somos",
    titulo: "Quiénes somos",
    contenido: (
      <TablaLegal
        titulo="Responsable del tratamiento de datos"
        columnas={["Campo", "Dato"]}
        filas={[
          ["Responsable del tratamiento", COMPANY_LEGAL_NAME],
          ["RUT", <Dato key="rut" valor={COMPANY_RUT} />],
          ["Domicilio", domicilio],
          ["Contacto de privacidad", <Correo key="correo" valor={COMPANY_PRIVACY_EMAIL} />],
        ]}
      />
    ),
  },
  {
    id: "marco-legal",
    titulo: "Marco legal",
    contenido: (
      <p>
        Tratamos tus datos conforme a la <strong>Ley N° 19.628</strong>,
        actualmente vigente, y anticipando el estándar de la{" "}
        <strong>Ley N° 21.719</strong>, que entra en plena vigencia el 1 de
        diciembre de 2026. Nos rigen además el secreto de las
        telecomunicaciones del artículo 36 B de la <strong>Ley N° 18.168</strong>,
        la <strong>Ley N° 19.496</strong> sobre protección al consumidor, y los
        artículos 218 ter, 219 y 222 del <strong>Código Procesal Penal</strong>{" "}
        en materia de entrega de antecedentes a la autoridad.
      </p>
    ),
  },
  {
    id: "datos",
    titulo: "Qué datos tratamos",
    contenido: (
      <>
        <p>
          <strong>Identificación y contratación:</strong> nombre, RUT, correo,
          teléfono, dirección de instalación y de facturación. Para clientes
          empresa, además razón social y datos del contacto.
        </p>
        <p>
          <strong>Facturación y pago:</strong> número de cliente, plan, montos,
          estado de pago y documentos emitidos.{" "}
          <strong>No almacenamos números de tarjeta ni claves</strong>; los
          pagos los procesa <Dato valor={PROVEEDORES.pasarelaPago} />.
        </p>
        <p>
          <strong>Técnicos y de red:</strong> identificador del equipo
          instalado (serie, modelo, MAC), IP asignada, fecha y hora de
          conexión, estado y señal del enlace, consumo agregado y reinicios.
        </p>
        <p>
          <strong>
            No inspeccionamos ni guardamos el contenido de tus comunicaciones
            ni tu historial de navegación.
          </strong>
        </p>
        <p>
          <strong>Uso del Portal:</strong> credenciales (la contraseña se
          almacena solo con hash), IP de origen y fecha de inicio y expiración
          de cada sesión, intentos de acceso fallidos (IP y RUT ingresado) y
          registro de los cambios hechos sobre tu cuenta. Si solicitas cambiar
          la clave de tu red WiFi, la nueva clave se guarda cifrada hasta que
          se aplica en tu equipo.
        </p>
        <p>
          <strong>Soporte:</strong> contenido de tickets, correos, mensajes de
          WhatsApp y formularios, y registro de visitas técnicas.
        </p>
        <p>
          <strong>No solicitamos datos sensibles.</strong> Si nos los envías
          por soporte, los eliminamos salvo que sean necesarios para atenderte.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "Para qué los usamos",
    contenido: (
      <>
        <TablaLegal
          titulo="Finalidades del tratamiento y su fundamento"
          columnas={["Finalidad", "Fundamento"]}
          filas={[
            ["Evaluar factibilidad y contratar", "Medidas precontractuales"],
            ["Instalar, operar y mantener el servicio", "Ejecución del contrato"],
            ["Facturar, cobrar y gestionar morosidad", "Contrato y obligación legal"],
            ["Autenticarte en el Portal", "Ejecución del contrato"],
            ["Diagnosticar fallas y gestionar la red", "Interés legítimo en la continuidad del servicio"],
            ["Prevenir fraude y ataques", "Interés legítimo y deber de seguridad"],
            ["Emitir documentos tributarios", "Obligación legal"],
            [
              "Conservar registros de conexión y entregarlos a autoridad competente",
              "Obligación legal (art. 222 CPP)",
            ],
            ["Responder consultas y reclamos", "Contrato y Ley 19.496"],
            ["Comunicaciones comerciales", "Consentimiento revocable"],
          ]}
        />
        <p>
          No tomamos decisiones automatizadas con efectos jurídicos sobre ti ni
          elaboramos perfiles publicitarios.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies y sesión",
    contenido: (
      <>
        <p>
          Usamos únicamente elementos <strong>técnicamente necesarios</strong>.
          No usamos cookies publicitarias ni de terceros con fines de
          seguimiento.
        </p>
        <TablaLegal
          titulo="Cookies y almacenamiento del navegador"
          columnas={["Elemento", "Función", "Duración"]}
          filas={[
            [
              "Cookie de sesión (access_token)",
              "Mantener tu sesión en el Portal y autorizar tus solicitudes",
              "7 días, o hasta que cierres sesión",
            ],
            [
              "Preferencia de tema (almacenamiento local del navegador, no es una cookie)",
              "Recordar si prefieres el modo claro u oscuro",
              "Hasta que la borres desde tu navegador",
            ],
          ]}
        />
        <p>
          El token de sesión es una credencial firmada que contiene tu
          identificador interno de cliente, tu RUT y su fecha de expiración.{" "}
          <strong>No contiene tu contraseña.</strong> Se almacena en una cookie
          con atributos <code>HttpOnly</code>, <code>Secure</code> y{" "}
          <code>SameSite</code>, por lo que no es accesible desde scripts del
          navegador. Al cerrar sesión, la sesión queda invalidada también en
          nuestros servidores.
        </p>
        <p>
          Estos elementos no requieren consentimiento porque sin ellos el
          Portal no funciona. Puedes bloquearlos desde tu navegador,
          entendiendo que no podrás iniciar sesión.
        </p>
      </>
    ),
  },
  {
    id: "conservacion",
    titulo: "Cuánto tiempo los conservamos",
    contenido: (
      <>
        <TablaLegal
          titulo="Plazos de conservación por categoría de datos"
          columnas={["Categoría", "Plazo"]}
          filas={[
            [
              "Contratación y facturación",
              "6 años desde el término del contrato (obligaciones tributarias y prescripción)",
            ],
            [
              "Registro de IP de conexiones",
              "No menos de 1 año (art. 222 CPP); destrucción segura vencido el plazo",
            ],
            ["Registros técnicos de red", <Dato key="red" valor={PLAZOS_DATOS.registrosTecnicosRed} />],
            ["Registros de acceso al Portal", <Dato key="portal" valor={PLAZOS_DATOS.logsPortal} />],
            ["Tickets y soporte", <Dato key="tickets" valor={PLAZOS_DATOS.tickets} />],
            [
              "Solicitudes sin contrato celebrado",
              <Dato key="solicitudes" valor={PLAZOS_DATOS.solicitudesSinContrato} />,
            ],
            ["Contacto para fines comerciales", "Hasta que revoques tu consentimiento"],
          ]}
        />
        <p>
          Vencidos los plazos, eliminamos o anonimizamos los datos, conservando
          solo lo que la ley exige mantener.
        </p>
      </>
    ),
  },
  {
    id: "destinatarios",
    titulo: "Con quién los compartimos",
    contenido: (
      <>
        <p>
          No vendemos ni arrendamos datos personales. Los comunicamos a
          proveedores que actúan por cuenta nuestra bajo obligaciones de
          confidencialidad:
        </p>
        <TablaLegal
          titulo="Proveedores que tratan datos por cuenta nuestra"
          columnas={["Proveedor", "Servicio"]}
          filas={[
            ["Railway", "Alojamiento de la base de datos"],
            ["SmartOLT", "Monitoreo y gestión de los equipos de fibra"],
            [<Dato key="pasarela" valor={PROVEEDORES.pasarelaPago} />, "Procesamiento de pagos"],
            [
              <Dato key="facturacion" valor={PROVEEDORES.facturacionElectronica} />,
              "Emisión de boletas y facturas",
            ],
            [<Dato key="correo" valor={PROVEEDORES.correo} />, "Avisos y notificaciones por correo"],
          ]}
        />
        <p>
          Además, dos herramientas del sitio hacen que tu navegador se conecte
          directamente con servicios de terceros, que reciben tu dirección IP
          como parte de esa conexión:
        </p>
        <TablaLegal
          titulo="Servicios de terceros que usa el sitio"
          columnas={["Servicio", "Cuándo se usa"]}
          filas={[
            ["OpenStreetMap", "Al abrir el mapa de cobertura, para descargar las imágenes del mapa"],
            ["fast.com (Netflix)", "Al ejecutar el test de velocidad, para medir tu conexión"],
          ]}
        />
        <p>
          También los comunicamos a <strong>autoridades competentes</strong>{" "}
          cuando exista orden judicial o requerimiento legal, según la sección
          siguiente.
        </p>
      </>
    ),
  },
  {
    id: "secreto",
    titulo: "Secreto de las telecomunicaciones",
    contenido: (
      <>
        <p>
          El contenido de tus comunicaciones está protegido por la
          Constitución y la Ley General de Telecomunicaciones. Solo entregamos
          información cuando media una resolución judicial o un requerimiento
          legal habilitante dirigido a esta empresa, limitándonos a los datos
          específicamente requeridos y dejando registro interno de cada
          solicitud.
        </p>
        <p>
          Mantenemos a disposición del Ministerio Público, en carácter
          reservado, el listado de nuestros rangos autorizados de direcciones
          IP y el registro de las IP de conexión de nuestros abonados,
          conforme al artículo 222 del Código Procesal Penal.
        </p>
      </>
    ),
  },
  {
    id: "alojamiento",
    titulo: "Dónde se alojan",
    contenido: (
      <p>
        Algunos proveedores alojan datos fuera de Chile (
        <Dato valor={PROVEEDORES.regionAlojamiento} />), exigiéndoles
        contractualmente estándares de seguridad equivalentes a los de la
        legislación chilena.
      </p>
    ),
  },
  {
    id: "seguridad",
    titulo: "Cómo los protegemos",
    contenido: (
      <>
        <ul>
          <li>Cifrado en tránsito con HTTPS/TLS.</li>
          <li>Contraseñas almacenadas solo con hash y sal.</li>
          <li>Autenticación por tokens firmados, con expiración y sesión invalidable.</li>
          <li>Control de acceso por roles y mínimo privilegio.</li>
          <li>Registros de auditoría de los cambios sobre datos personales.</li>
          <li>Respaldos periódicos.</li>
          <li>Separación entre ambientes de desarrollo y producción.</li>
          <li>Acuerdos de confidencialidad con personal y proveedores.</li>
        </ul>
        <p>
          Ningún sistema es invulnerable, pero revisamos estas medidas de forma
          continua.
        </p>
      </>
    ),
  },
  {
    id: "incidentes",
    titulo: "Incidentes de seguridad",
    contenido: (
      <p>
        Si detectamos una vulneración que afecte tus datos, la registramos,
        contenemos y <strong>te notificaremos por correo electrónico</strong>{" "}
        indicando qué ocurrió, qué datos se vieron afectados y qué puedes
        hacer. Además efectuaremos las notificaciones que correspondan a la
        autoridad dentro de los plazos legales.
      </p>
    ),
  },
  {
    id: "derechos",
    titulo: "Tus derechos",
    contenido: (
      <>
        <p>
          Puedes ejercer gratuitamente los derechos de{" "}
          <strong>
            acceso, rectificación, cancelación, oposición, bloqueo y
            portabilidad
          </strong>{" "}
          (esta última exigible desde el 1 de diciembre de 2026).
        </p>
        <p>
          <strong>Cómo:</strong> escribe a <Correo valor={COMPANY_PRIVACY_EMAIL} />{" "}
          desde el correo registrado en tu cuenta, indicando nombre, RUT y el
          derecho que quieres ejercer. Podemos pedirte antecedentes para
          verificar tu identidad. Respondemos en un máximo de{" "}
          <Dato valor={PLAZOS_DATOS.respuestaDerechos} />.
        </p>
        <p>
          Límites: no podemos eliminar datos que la ley nos obliga a conservar
          (registros de conexión, respaldo contable y tributario) ni los
          necesarios para mantener vigente tu contrato.
        </p>
        <p>
          Si no quedas conforme, puedes reclamar ante la autoridad competente
          en protección de datos personales y, en lo que sea materia de
          consumo, ante el SERNAC.
        </p>
      </>
    ),
  },
  {
    id: "menores",
    titulo: "Menores de edad",
    contenido: (
      <p>
        El servicio se contrata solo por mayores de 18 años. No recopilamos
        deliberadamente datos de menores; si detectamos alguno, lo eliminamos.
      </p>
    ),
  },
  {
    id: "cambios",
    titulo: "Cambios y contacto",
    contenido: (
      <p>
        Publicaremos la versión vigente en esta página con su fecha. Si el
        cambio es sustancial, te avisaremos por correo o por el Portal.
        Consultas: <Correo valor={COMPANY_PRIVACY_EMAIL} /> ·{" "}
        <a href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE_DISPLAY}</a> ·{" "}
        {domicilio}.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <DocumentoLegal
      titulo="Política de Privacidad y Tratamiento de Datos Personales"
      encabezado={
        <p>
          {COMPANY_LEGAL_NAME} · Última actualización: {LEGAL_ACTUALIZACION} ·
          Versión {POLITICA_PRIVACIDAD_VERSION}
        </p>
      }
      secciones={secciones}
    />
  );
}
