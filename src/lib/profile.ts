import "server-only";
import type { EmployeeProfile } from "@prisma/client";

// La libreta sanitaria se crea con placeholder 2099-12-31 hasta que se carga la real.
const HEALTH_PLACEHOLDER_YEAR = 2099;

/**
 * Un perfil está "completo" cuando el empleado cargó los datos que le corresponden
 * (los de identidad los pone el admin). Se usa para:
 *  - mandar al usuario nuevo directo a /profile hasta que complete;
 *  - permitir que esa PRIMERA carga se escriba directo, sin pasar por aprobación
 *    (las ediciones posteriores sí requieren aprobación del admin).
 */
export function isEmployeeProfileComplete(p: EmployeeProfile | null | undefined): boolean {
  if (!p) return false;
  const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;
  const healthSet = !!p.healthCardExpiry && p.healthCardExpiry.getFullYear() < HEALTH_PLACEHOLDER_YEAR;
  const foodSet = !!p.foodCourseExpiry && p.foodCourseExpiry.getFullYear() < HEALTH_PLACEHOLDER_YEAR;
  const licenseOk = p.category !== "DRIVER" || !!p.professionalLicenseExpiry;
  return (
    filled(p.phone) &&
    filled(p.address) &&
    filled(p.addressNumber) &&
    filled(p.neighborhood) &&
    filled(p.city) &&
    filled(p.postalCode) &&
    filled(p.emergencyContact) &&
    filled(p.emergencyPhone) &&
    filled(p.shirtSize) &&
    filled(p.hoodieSize) &&
    filled(p.jacketSize) &&
    filled(p.pantsSize) &&
    filled(p.shoeSize) &&
    filled(p.faceImageBlobUrl) &&
    filled(p.signatureBlobUrl) &&
    filled(p.dniFrontBlobUrl) &&
    filled(p.dniBackBlobUrl) &&
    healthSet &&
    foodSet &&
    licenseOk
  );
}
