import type { 
  RequestHandler 
} from "express";

import { 
  configuracionQuerySchema, 
  configuracionClaveParamsSchema, 
  configuracionIdParamsSchema,
  createConfiguracionSchema, 
  updateConfiguracionSchema
} from "../validators/configuracion.validator.js";

import { 
  getConfiguraciones, 
  getConfiguracionesPublicas, 
  getConfiguracion,
  registerConfiguracion,
  editConfiguracion 
} from "../services/configuracion.service.js";

export const listConfiguracionesController: RequestHandler = async (req, res) => {
  const filters = configuracionQuerySchema.parse(req.query);
  
  const configuraciones = await getConfiguraciones(filters, req.user!);
  
  res.json(
    { 
      ok: true, 
      total: configuraciones.length, 
      configuraciones 
    }
  );
};

export const publicConfiguracionesController: RequestHandler = async (req, res) => {
  const configuraciones = await getConfiguracionesPublicas(configuracionQuerySchema.parse(req.query));
  
  res.json(
    { ok: true, 
      total: configuraciones.length, 
      configuraciones 
    }
  );
};

export const getConfiguracionController: RequestHandler = async (req, res) => {
  const { clave } = configuracionClaveParamsSchema.parse(req.params);

  const configuracion = await getConfiguracion(
    clave, 
    configuracionQuerySchema.parse(req.query), req.user!
  );

  res.json({ ok: true, configuracion });
};

export const createConfiguracionController: RequestHandler = async (req, res) => {
  const configuracion = await registerConfiguracion(
    createConfiguracionSchema.parse(req.body), req.user!
  );

  res.status(201).json({ ok: true, configuracion });
};

export const updateConfiguracionController: RequestHandler = async (req, res) => {
  const { id } = configuracionIdParamsSchema.parse(req.params);

  const configuracion = await editConfiguracion(
    id, 
    updateConfiguracionSchema.parse(req.body),
     req.user!
    );
    
  res.json({ ok: true, configuracion });
};
