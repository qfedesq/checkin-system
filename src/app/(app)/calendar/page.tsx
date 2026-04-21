import { PageHeader } from "@/components/ui/PageHeader";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <>
      <PageHeader eyebrow="calendario" title="Vacaciones y francos" description="Solicitá vacaciones (empiezan siempre un lunes, 7 o 14 días) o un franco diario. Las solicitudes quedan pendientes hasta que el administrador las valide." />
      <CalendarClient />
    </>
  );
}
