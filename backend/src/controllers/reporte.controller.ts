import { 
  getTurnoScope, 
  assertTurnoScope 
} from "../services/turno-access.service.js";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { reporteQuerySchema } from
  "../validators/reporte.validator.js";

import {
  getReporteResumen,
  getReporteEspecialidades,
} from "../services/reporte.service.js";

import {
  getReporteProfesionales,
} from "../services/reporte-profesional.service.js";

import { reporteExportQuerySchema } from
  "../validators/reporte.validator.js";

import { exportReporte } from
  "../services/reporte-export.service.js";

// Devuelve las métricas generales.
export const getReporteResumenController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters =
      reporteQuerySchema.parse(req.query);

    const reporte =
      await getReporteResumen(filters, await reportScope(req, filters.id_salita));

    res.status(200).json({
      ok: true,
      reporte,
    });
  } catch (error) {
    next(error);
  }
};

// Devuelve la demanda por especialidad.
export const getReporteEspecialidadesController =
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const filters =
        reporteQuerySchema.parse(req.query);

      const reporte =
        await getReporteEspecialidades(filters, await reportScope(req, filters.id_salita));

      res.status(200).json({
        ok: true,
        total: reporte.length,
        reporte,
      });
    } catch (error) {
      next(error);
    }
  };

// Devuelve métricas por profesional.
export const getReporteProfesionalesController =
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const filters =
        reporteQuerySchema.parse(req.query);

      const reporte =
        await getReporteProfesionales(filters, await reportScope(req, filters.id_salita));

      res.status(200).json({
        ok: true,
        total: reporte.length,
        reporte,
      });
    } catch (error) {
      next(error);
    }
  };

// Descarga el reporte en el formato elegido.
export const exportReporteController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters =
      reporteExportQuerySchema.parse(
        req.query,
      );

    const file =
      await exportReporte(filters, await reportScope(req, filters.id_salita));

    const filename =
      `reporte-${filters.tipo}-${filters.fecha_desde}-${filters.fecha_hasta}.${file.extension}`;

    // Indica el tipo de archivo.
    res.setHeader(
      "Content-Type",
      file.contentType,
    );

    // Fuerza la descarga.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(file.buffer);
  } catch (error) {
    next(error);
  }
};
async function reportScope(req: Request, salita?: string) {
 const scope = await getTurnoScope(req.user!);
 if (salita) assertTurnoScope(scope, salita);
 return scope;
}
