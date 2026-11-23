import type { NextFunction, Request, Response } from 'express';

import {
  actualizarConsultaBorrador,
  actualizarEstadoEstudioClinico,
  anularConsultaBorrador,
  consultarAlergiasPaciente,
  consultarAntecedentesPaciente,
  consultarAuditoriaClinica,
  consultarConsultaMedicaPorId,
  consultarHistoriaClinicaPaciente,
  descartarBorradorTemporal,
  firmarConsultaMedica,
  guardarBorradorTemporal,
  informarEstudioClinico,
  listarDerivacionesClinicas,
  obtenerBorradorTemporal,
  rectificarEvolucionClinica,
  registrarConsultaClinica,
  registrarEvolucionClinica,
  resolverDerivacionClinica,
  solicitarDerivacionClinica,
} from '../services/historia-clinica.service.js';
import {
  actualizarConsultaBorradorBodySchema,
  actualizarEstadoEstudioBodySchema,
  anularConsultaBodySchema,
  borradorTemporalQuerySchema,
  consultaIdParamsSchema,
  consultarAlergiasQuerySchema,
  consultarAntecedentesQuerySchema,
  consultarAuditoriaClinicaQuerySchema,
  consultarConsultaQuerySchema,
  consultarHistoriaClinicaQuerySchema,
  derivacionIdParamsSchema,
  estudioIdParamsSchema,
  evolucionIdParamsSchema,
  firmarConsultaBodySchema,
  guardarBorradorTemporalBodySchema,
  informarEstudioBodySchema,
  listarDerivacionesQuerySchema,
  patientIdParamsSchema,
  rectificarEvolucionBodySchema,
  registrarConsultaBodySchema,
  registrarEvolucionBodySchema,
  resolverDerivacionBodySchema,
  solicitarDerivacionBodySchema,
} from '../validators/historia-clinica.validator.js';

export const consultarHistoriaClinicaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idPaciente } = patientIdParamsSchema.parse(req.params);
    const query = consultarHistoriaClinicaQuerySchema.parse(req.query);
    const data = await consultarHistoriaClinicaPaciente(
      req.user!,
      idPaciente,
      query,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const consultarAntecedentesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idPaciente } = patientIdParamsSchema.parse(req.params);
    const query = consultarAntecedentesQuerySchema.parse(req.query);
    const data = await consultarAntecedentesPaciente(
      req.user!,
      idPaciente,
      query,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const consultarAlergiasController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idPaciente } = patientIdParamsSchema.parse(req.params);
    const query = consultarAlergiasQuerySchema.parse(req.query);
    const data = await consultarAlergiasPaciente(
      req.user!,
      idPaciente,
      query,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const consultarConsultaMedicaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idConsulta } = consultaIdParamsSchema.parse(req.params);
    const query = consultarConsultaQuerySchema.parse(req.query);
    const data = await consultarConsultaMedicaPorId(
      req.user!,
      idConsulta,
      query,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const buildConsultaSectionController =
  (section: 'diagnosticos' | 'evoluciones' | 'tratamientos' | 'estudios') =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { idConsulta } = consultaIdParamsSchema.parse(req.params);
      const query = consultarConsultaQuerySchema.parse(req.query);
      const consulta = await consultarConsultaMedicaPorId(
        req.user!,
        idConsulta,
        query,
        req.ip ?? null
      );

      res.status(200).json({
        success: true,
        data: {
          id_consulta: consulta.id_consulta,
          id_paciente: consulta.id_paciente,
          via_acceso: consulta.via_acceso,
          alcance: consulta.alcance,
          id_derivacion: consulta.id_derivacion,
          [section]: consulta[section] ?? [],
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const consultarDiagnosticosConsultaController =
  buildConsultaSectionController('diagnosticos');

export const consultarEvolucionesConsultaController =
  buildConsultaSectionController('evoluciones');

export const consultarTratamientosConsultaController =
  buildConsultaSectionController('tratamientos');

export const consultarEstudiosConsultaController =
  buildConsultaSectionController('estudios');

export const registrarConsultaClinicaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = registrarConsultaBodySchema.parse(req.body);
    const data = await registrarConsultaClinica(
      req.user!,
      body,
      req.ip ?? null
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const actualizarConsultaBorradorController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idConsulta } = consultaIdParamsSchema.parse(req.params);
    const body = actualizarConsultaBorradorBodySchema.parse(req.body);
    const data = await actualizarConsultaBorrador(
      req.user!,
      idConsulta,
      body,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const firmarConsultaMedicaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idConsulta } = consultaIdParamsSchema.parse(req.params);
    const body = firmarConsultaBodySchema.parse(req.body);
    const data = await firmarConsultaMedica(
      req.user!,
      idConsulta,
      body,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const anularConsultaBorradorController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idConsulta } = consultaIdParamsSchema.parse(req.params);
    const body = anularConsultaBodySchema.parse(req.body);
    const data = await anularConsultaBorrador(
      req.user!,
      idConsulta,
      body,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const registrarEvolucionClinicaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idConsulta } = consultaIdParamsSchema.parse(req.params);
    const body = registrarEvolucionBodySchema.parse(req.body);
    const data = await registrarEvolucionClinica(
      req.user!,
      idConsulta,
      body,
      req.ip ?? null
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const rectificarEvolucionClinicaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idEvolucion } = evolucionIdParamsSchema.parse(req.params);
    const body = rectificarEvolucionBodySchema.parse(req.body);
    const data = await rectificarEvolucionClinica(
      req.user!,
      idEvolucion,
      body,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const actualizarEstadoEstudioController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idEstudio } = estudioIdParamsSchema.parse(req.params);
    const body = actualizarEstadoEstudioBodySchema.parse(req.body);
    const data = await actualizarEstadoEstudioClinico(
      req.user!,
      idEstudio,
      body,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const informarEstudioController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idEstudio } = estudioIdParamsSchema.parse(req.params);
    const body = informarEstudioBodySchema.parse(req.body);
    const data = await informarEstudioClinico(
      req.user!,
      idEstudio,
      body,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const listarDerivacionesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = listarDerivacionesQuerySchema.parse(req.query);
    const data = await listarDerivacionesClinicas(req.user!, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const solicitarDerivacionController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = solicitarDerivacionBodySchema.parse(req.body);
    const data = await solicitarDerivacionClinica(
      req.user!,
      body,
      req.ip ?? null
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const resolverDerivacionController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idDerivacion } = derivacionIdParamsSchema.parse(req.params);
    const body = resolverDerivacionBodySchema.parse(req.body);
    const data = await resolverDerivacionClinica(
      req.user!,
      idDerivacion,
      body,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const consultarAuditoriaClinicaController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = consultarAuditoriaClinicaQuerySchema.parse(req.query);
    const data = await consultarAuditoriaClinica(
      req.user!,
      query,
      req.ip ?? null
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const obtenerBorradorTemporalController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = borradorTemporalQuerySchema.parse(req.query);
    const data = await obtenerBorradorTemporal(req.user!, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const guardarBorradorTemporalController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = guardarBorradorTemporalBodySchema.parse(req.body);
    const data = await guardarBorradorTemporal(req.user!, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const descartarBorradorTemporalController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = borradorTemporalQuerySchema.parse(req.query);
    const data = await descartarBorradorTemporal(req.user!, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
