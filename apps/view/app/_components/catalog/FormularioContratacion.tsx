"use client";

import { useRef, useState, type FormEvent } from "react";
import PrimaryButton from "../ui/PrimaryButton";
import CasillaPoliticaPrivacidad from "../legal/CasillaPoliticaPrivacidad";
import type { PlanBackend } from "../../_lib/api";
import { API_URL } from "../../_lib/consts";
import {
  MENSAJE_POLITICA_REQUERIDA,
  POLITICA_PRIVACIDAD_VERSION,
} from "../../_lib/legal";
import { cleanTelefono, formatRut, formatTelefono } from "../../utils/login-schema";
import Link from "next/link";
import { useMarca } from "../../_lib/marca";
import { rutaMarca } from "../../_lib/company";

/**
 * El formato del registro de prospectos de G8 (fotos del 12-11): los mismos
 * textos, letra por letra, porque el prospecto se guarda con estos valores.
 */
const ORIGENES_CONTACTO = [
  "Formulario web",
  "Telefono",
  "Sucursal",
  "Referido",
  "Redes sociales",
  "Terreno",
];

/** Las 16 regiones, en el orden de G8, con sus comunas oficiales. */
const COMUNAS_POR_REGION: Record<string, string[]> = {
  "Tarapacá": ["Alto Hospicio", "Camiña", "Colchane", "Huara", "Iquique", "Pica", "Pozo Almonte"],
  "Antofagasta": ["Antofagasta", "Calama", "María Elena", "Mejillones", "Ollagüe", "San Pedro de Atacama", "Sierra Gorda", "Taltal", "Tocopilla"],
  "Atacama": ["Alto del Carmen", "Caldera", "Chañaral", "Copiapó", "Diego de Almagro", "Freirina", "Huasco", "Tierra Amarilla", "Vallenar"],
  "Coquimbo": ["Andacollo", "Canela", "Combarbalá", "Coquimbo", "Illapel", "La Higuera", "La Serena", "Los Vilos", "Monte Patria", "Ovalle", "Paihuano", "Punitaqui", "Río Hurtado", "Salamanca", "Vicuña"],
  "Valparaíso": ["Algarrobo", "Cabildo", "Calera", "Calle Larga", "Cartagena", "Casablanca", "Catemu", "Concón", "El Quisco", "El Tabo", "Hijuelas", "Isla de Pascua", "Juan Fernández", "La Cruz", "La Ligua", "Limache", "Llaillay", "Los Andes", "Nogales", "Olmué", "Panquehue", "Papudo", "Petorca", "Puchuncaví", "Putaendo", "Quillota", "Quilpué", "Quintero", "Rinconada", "San Antonio", "San Esteban", "San Felipe", "Santa María", "Santo Domingo", "Valparaíso", "Villa Alemana", "Viña del Mar", "Zapallar"],
  "Libertador General Bernardo O'Higgins": ["Chépica", "Chimbarongo", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "La Estrella", "Las Cabras", "Litueche", "Lolol", "Machalí", "Malloa", "Marchigüe", "Mostazal", "Nancagua", "Navidad", "Olivar", "Palmilla", "Paredones", "Peralillo", "Peumo", "Pichidegua", "Pichilemu", "Placilla", "Pumanque", "Quinta de Tilcoco", "Rancagua", "Rengo", "Requínoa", "San Fernando", "San Vicente", "Santa Cruz"],
  "Maule": ["Cauquenes", "Chanco", "Colbún", "Constitución", "Curepto", "Curicó", "Empedrado", "Hualañé", "Licantén", "Linares", "Longaví", "Maule", "Molina", "Parral", "Pelarco", "Pelluhue", "Pencahue", "Rauco", "Retiro", "Río Claro", "Romeral", "Sagrada Familia", "San Clemente", "San Javier", "San Rafael", "Talca", "Teno", "Vichuquén", "Villa Alegre", "Yerbas Buenas"],
  "Biobío": ["Alto Biobío", "Antuco", "Arauco", "Cabrero", "Cañete", "Chiguayante", "Concepción", "Contulmo", "Coronel", "Curanilahue", "Florida", "Hualpén", "Hualqui", "Laja", "Lebu", "Los Álamos", "Los Ángeles", "Lota", "Mulchén", "Nacimiento", "Negrete", "Penco", "Quilaco", "Quilleco", "San Pedro de la Paz", "San Rosendo", "Santa Bárbara", "Santa Juana", "Talcahuano", "Tirúa", "Tomé", "Tucapel", "Yumbel"],
  "La Araucanía": ["Angol", "Carahue", "Cholchol", "Collipulli", "Cunco", "Curacautín", "Curarrehue", "Ercilla", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Lonquimay", "Los Sauces", "Lumaco", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Purén", "Renaico", "Saavedra", "Temuco", "Teodoro Schmidt", "Toltén", "Traiguén", "Victoria", "Vilcún", "Villarrica"],
  "Los Lagos": ["Ancud", "Calbuco", "Castro", "Chaitén", "Chonchi", "Cochamó", "Curaco de Vélez", "Dalcahue", "Fresia", "Frutillar", "Futaleufú", "Hualaihué", "Llanquihue", "Los Muermos", "Maullín", "Osorno", "Palena", "Puerto Montt", "Puerto Octay", "Puerto Varas", "Puqueldón", "Purranque", "Puyehue", "Queilén", "Quellón", "Quemchi", "Quinchao", "Río Negro", "San Juan de la Costa", "San Pablo"],
  "Aysén del General Carlos Ibáñez del Campo": ["Aysén", "Chile Chico", "Cisnes", "Cochrane", "Coyhaique", "Guaitecas", "Lago Verde", "O'Higgins", "Río Ibáñez", "Tortel"],
  "Magallanes y de la Antártica Chilena": ["Antártica", "Cabo de Hornos", "Laguna Blanca", "Natales", "Porvenir", "Primavera", "Punta Arenas", "Río Verde", "San Gregorio", "Timaukel", "Torres del Paine"],
  "Metropolitana de Santiago": ["Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví", "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "María Pinto", "Melipilla", "Ñuñoa", "Padre Hurtado", "Paine", "Pedro Aguirre Cerda", "Peñaflor", "Peñalolén", "Pirque", "Providencia", "Pudahuel", "Puente Alto", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Bernardo", "San Joaquín", "San José de Maipo", "San Miguel", "San Pedro", "San Ramón", "Santiago", "Talagante", "Tiltil", "Vitacura"],
  "Los Ríos": ["Corral", "Futrono", "La Unión", "Lago Ranco", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "Río Bueno", "Valdivia"],
  "Arica y Parinacota": ["Arica", "Camarones", "General Lagos", "Putre"],
  "Ñuble": ["Bulnes", "Chillán", "Chillán Viejo", "Cobquecura", "Coelemu", "Coihueco", "El Carmen", "Ninhue", "Ñiquén", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil", "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Treguaco", "Yungay"],
};

type FormularioContratacionProps = {
  plan: PlanBackend;
};

type FormState = "idle" | "loading" | "success" | "error";

/** El backend responde `{ message, errors?: [{ message }] }`. */
async function mensajeDeError(res: Response): Promise<string> {
  const cuerpo = (await res.json().catch(() => null)) as {
    message?: string;
    errors?: { message?: string }[];
  } | null;
  return (
    cuerpo?.errors?.[0]?.message ??
    cuerpo?.message ??
    `Error del servidor (${res.status})`
  );
}

export default function FormularioContratacion({ plan }: FormularioContratacionProps) {
  const marca = useMarca();
  const [status, setStatus] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const [errorPolitica, setErrorPolitica] = useState("");
  const [rut, setRut] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const casillaRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // CU-75, Excepción 1: sin la casilla no se envía nada.
    if (!aceptaPolitica) {
      setErrorPolitica(MENSAJE_POLITICA_REQUERIDA);
      casillaRef.current?.focus();
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const data = new FormData(e.currentTarget);
    const campo = (nombre: string) => String(data.get(nombre) ?? "").trim();
    // Los nombres del DTO del backend (ContratacionDto), no los del formulario.
    const payload = {
      id_plan: plan.id_plan,
      nombre_completo: campo("nombreCompleto"),
      rut: campo("rut"),
      email: campo("correoElectronico"),
      // Sin espacios y con el +56, igual que el teléfono del perfil.
      telefono: `+56${cleanTelefono(campo("telefonoMovil"))}`,
      direccion_completa: campo("calleNumero"),
      comuna: campo("comuna"),
      region: campo("region"),
      origen_contacto: campo("origenContacto"),
      acepta_politica_privacidad: true,
      version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
    };

    try {
      const res = await fetch(`${API_URL}/contrataciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await mensajeDeError(res));
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "No se pudo enviar la solicitud. Intenta nuevamente."
      );
    }
  };

  if (status === "success") {
    return (
      <div className="grid max-w-xl gap-4 border border-success bg-success-container p-6 rounded-lg" role="alert">
        <h2 className="text-lg font-medium text-on-success-container">
          Solicitud enviada
        </h2>
        <p className="text-sm text-on-success-container">
          Tu solicitud para <strong>{plan.nombre_comercial}</strong> ha sido recibida
          y quedó registrada tu aceptación de la Política de Privacidad. Te
          contactaremos pronto al telefono y correo proporcionados.
        </p>
        <Link
          href={rutaMarca(marca, "/planes")}
          className="text-sm text-primary hover:underline"
        >
          &larr; Volver a planes
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-xl gap-4 border border-border p-6 rounded-lg"
    >
      <label className="grid gap-1" htmlFor="nombreCompleto">
        Nombre completo
        <input
          id="nombreCompleto"
          name="nombreCompleto"
          required
          maxLength={120}
          autoComplete="name"
          placeholder="Nombre y apellidos"
          pattern="[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-]+)+"
          title="Tu nombre y al menos un apellido, con tildes si las llevan. Ej: María José de la Fuente"
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <label className="grid gap-1" htmlFor="rut">
        RUT
        <input
          id="rut"
          name="rut"
          required
          maxLength={12}
          placeholder="12.345.678-9"
          pattern="[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9K]"
          title="RUT con dígito verificador, por ejemplo 12.345.678-9"
          value={rut}
          onChange={(e) => setRut(formatRut(e.target.value))}
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <label className="grid gap-1" htmlFor="correoElectronico">
        Correo electronico
        <input
          id="correoElectronico"
          name="correoElectronico"
          type="email"
          required
          autoComplete="email"
          placeholder="usuario@dominio.cl"
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}"
          title="usuario@dominio.cl"
          value={correo}
          onChange={(e) => setCorreo(e.target.value.toLowerCase().replace(/\s/g, ""))}
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <div className="grid gap-1">
        <label htmlFor="telefonoMovil">Telefono movil</label>
        <div className="flex">
          <span
            aria-hidden
            className="flex items-center rounded-l-md border border-r-0 border-border bg-surface px-3 text-muted"
          >
            +56
          </span>
          <input
            id="telefonoMovil"
            name="telefonoMovil"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            placeholder="9 1234 5678"
            pattern="9 [0-9]{4} [0-9]{4}"
            title="Celular de 9 dígitos que empieza con 9, por ejemplo 9 1234 5678"
            value={telefono}
            onChange={(e) => setTelefono(formatTelefono(e.target.value))}
            className="min-w-0 flex-1 border border-border bg-background p-2 rounded-r-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
          />
        </div>
      </div>

      <div className="grid gap-1">
        <label htmlFor="origenContacto">Origen de contacto</label>
        <select
          id="origenContacto"
          name="origenContacto"
          required
          defaultValue="Formulario web"
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        >
          {ORIGENES_CONTACTO.map((origen) => (
            <option key={origen} value={origen}>
              {origen}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="grid gap-4 border border-border p-4 rounded-md">
        <legend className="px-1 text-sm">Direccion de instalacion</legend>

        <label className="grid gap-1" htmlFor="calleNumero">
          Calle + numero
          <input
            id="calleNumero"
            name="calleNumero"
            required
            placeholder="Nombre Calle N°XXX"
            className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
          />
        </label>

        <div className="grid gap-1">
          <label htmlFor="region">Región</label>
          <select
            id="region"
            name="region"
            required
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setComuna("");
            }}
            className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
          >
            <option value="">Seleccionar región</option>
            {Object.keys(COMUNAS_POR_REGION).map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label htmlFor="comuna">Comuna</label>
          <select
            id="comuna"
            name="comuna"
            required
            disabled={!region}
            value={comuna}
            onChange={(e) => setComuna(e.target.value)}
            className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
          >
            <option value="">
              {region ? "Seleccionar comuna" : "Selecciona primero una región"}
            </option>
            {(COMUNAS_POR_REGION[region] ?? []).map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <CasillaPoliticaPrivacidad
        ref={casillaRef}
        checked={aceptaPolitica}
        error={errorPolitica}
        onChange={(marcada) => {
          setAceptaPolitica(marcada);
          if (marcada) setErrorPolitica("");
        }}
      />

      {status === "error" && (
        <p className="text-sm text-error" role="alert">
          {errorMessage}
        </p>
      )}

      <PrimaryButton
        type="submit"
        variant="conversion"
        disabled={status === "loading"}
        className="w-full"
      >
        {status === "loading" ? "Enviando..." : "Enviar solicitud"}
      </PrimaryButton>
    </form>
  );
}
