import type {
  RequestHandler
} from "express";
import { getTurnoScope } from '../services/turno-access.service.js';
import { getPatientById } from '../services/patient-read.service.js';

import {
  updatePatientTutorSchema,
  patientIdParamSchema,
  tutorIdParamSchema,
  patientTutorParamsSchema
} from "../validators/patient-tutor.validator.js";

import {
  getPatientTutors,
  getTutorPatients,
  editPatientTutorRelation,
  finishPatientTutorRelation
} from "../services/patient-tutor.service.js";


/**
 * GET /api/patients/:patientId/tutors
 */
export const listPatientTutorsController: RequestHandler =
  async (req, res, next) => {
    const params =
      patientIdParamSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        success: false,
        message: "UUID de paciente inválido"
      });

      return;
    }

    try {
      const tutors =
        await getPatientTutors(
          params.data.patientId
        );

      res.json({
        success: true,
        data: {
          tutors
        }
      });
    } catch (error) {
      next(error);
    }
  };


/**
 * GET /api/tutors/:tutorId/patients
 */
export const listTutorPatientsController: RequestHandler =
  async (req, res, next) => {
    const params =
      tutorIdParamSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        success: false,
        message: "UUID de tutor inválido"
      });

      return;
    }

    try {
      const patients =
        await getTutorPatients(
          params.data.tutorId
        );

      const scope = await getTurnoScope(req.user!);
      const visible = scope === null ? patients : (await Promise.all(patients.map(async relation => {
        const patient = await getPatientById(relation.id_paciente);
        return scope.includes(patient.id_salita_asignada) ? relation : null;
      }))).filter(relation => relation !== null);

      res.json({
        success: true,
        data: {
          patients: visible
        }
      });
    } catch (error) {
      next(error);
    }
  };


/**
 * PATCH /api/patients/:patientId/tutors/:tutorId
 */
export const updatePatientTutorController: RequestHandler =
  async (req, res, next) => {
    const params =
      patientTutorParamsSchema.safeParse(
        req.params
      );

    const body =
      updatePatientTutorSchema.safeParse(
        req.body
      );

    if (!params.success || !body.success) {
      res.status(400).json({
        success: false,
        message: "Datos de actualización inválidos"
      });

      return;
    }

    try {
      const relation =
        await editPatientTutorRelation(
          params.data.patientId,
          params.data.tutorId,
          body.data,
          req.user!.id_usuario
        );

      res.json({
        success: true,
        data: {
          relation
        }
      });
    } catch (error) {
      next(error);
    }
  };


/**
 * PATCH /api/patients/:patientId/tutors/:tutorId/end
 */
export const finishPatientTutorController: RequestHandler =
  async (req, res, next) => {
    const params =
      patientTutorParamsSchema.safeParse(
        req.params
      );

    if (!params.success) {
      res.status(400).json({
        success: false,
        message: "UUID de paciente o tutor inválido"
      });

      return;
    }

    try {
      const relation =
        await finishPatientTutorRelation(
          params.data.patientId,
          params.data.tutorId,
          req.user!.id_usuario
        );

      res.json({
        success: true,
        message: "Relación paciente-tutor finalizada correctamente",
        data: {
          relation
        }
      });
    } catch (error) {
      next(error);
    }
  };
