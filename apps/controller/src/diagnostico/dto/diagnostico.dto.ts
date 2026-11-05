/**
 * CU-34 / CU-35: servidores contra los que el navegador mide la velocidad.
 *
 * No se devuelve el ISP ni la ubicacion que trae la respuesta de fast.com: como
 * la consulta sale desde nuestro servidor, esos datos describen al servidor y no
 * al cliente. Mostrarlos en el portal seria informar mal.
 */
export interface ServidoresMedicionDto {
  /** URLs de los CDN de Netflix. Vencen una hora despues de emitidas. */
  targets: string[];
}
