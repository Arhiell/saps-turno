import type { 
  RequestHandler 
} from "express";

import { 
  reporteAgendaQuerySchema, 
  reporteAgendaExportSchema 
} from "../validators/reporte.validator.js";

import { 
  getAgendaDiaria 
} from "../services/reporte-agenda-diaria.service.js";

import { 
  agendaSecciones, 
  agendaHtml 
} from "../services/reporte-agenda-presentacion.js";

import { 
  generateReporteFile 
} from "../services/reporte-export.service.js";

export const getAgendaDiariaController: RequestHandler = async (req, res) => {
  const filters = reporteAgendaQuerySchema.parse(req.query);

  const agenda = await getAgendaDiaria(filters, req.user!);
  
  res.setHeader("Cache-Control", "no-store");
  
  res.json({ ok: true, ...agenda });
};

export const exportAgendaDiariaController: RequestHandler = async (req, res) => {
  const filters = reporteAgendaExportSchema.parse(req.query);
  
  // Exportar aplica exactamente la misma autorización y selección que consultar.
  const agenda = await getAgendaDiaria(filters, req.user!);
  
  const file = await generateReporteFile(agendaSecciones(
    agenda.listas, 
    agenda.fecha,
    filters.fecha_hasta,
    agenda.contexto
  ), 
  "SAPS TURNO", filters.formato
);

  const suffix = filters.id_profesional ? `-${filters.id_profesional}` : "-todos";
 
  res.setHeader("Cache-Control", "no-store");
 
  res.setHeader(
    "Content-Disposition", 
    `attachment; filename="agenda-diaria-${filters.fecha_desde ?? agenda.fecha}-${filters.fecha_hasta ?? agenda.fecha}${suffix}.${file.extension}"`
  );

  res.type(file.contentType).send(file.buffer);
};

export const printAgendaDiariaController: RequestHandler = async (req, res) => {
 
  const filters = reporteAgendaQuerySchema.parse(req.query);
  
  const agenda = await getAgendaDiaria(filters, req.user!);
 
  res.setHeader("Cache-Control", "no-store");
 
  res.type("html").send(
    agendaHtml(agendaSecciones(
      agenda.listas, 
      agenda.fecha,
      filters.fecha_hasta,
      agenda.contexto)
    )
  );
};
