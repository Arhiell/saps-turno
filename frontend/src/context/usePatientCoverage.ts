import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  getBarrios,
} from '../services/barrios.service';

import {
  getSalitas,
} from '../services/salitas.service';

import {
  getCoberturas,
  getZonas,
} from '../services/configuracion.service';

import type {
  Barrio,
} from '../types/barrio.types';

import type {
  Salita,
} from '../types/salita.types';

import type {
  Cobertura,
  Zona,
} from '../types/configuracion.types';

// ========================================
// SALITAS CON COBERTURA
// ========================================

// Obtiene las salitas activas que poseen
// cobertura vigente para un barrio.
export const coveredClinics = (
  barrio: string,
  clinics: Salita[],
  relations: Cobertura[]
) => {
  // Obtiene la fecha actual usando
  // la zona horaria de Argentina.
  const today = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone:
        'America/Argentina/Buenos_Aires',
    }
  ).format(
    new Date()
  );

  // Filtra únicamente salitas activas
  // con una relación de cobertura vigente.
  return clinics.filter(
    (c) =>
      c.activo &&
      relations.some(
        (r) =>
          r.id_barrio === barrio &&
          r.id_salita === c.id_salita &&
          r.activo &&
          r.fecha_desde <= today &&
          (
            !r.fecha_hasta ||
            r.fecha_hasta >= today
          )
      )
  );
};

// ========================================
// HOOK DE COBERTURA DEL PACIENTE
// ========================================

export default function usePatientCoverage() {
  // Catálogos necesarios para resolver la cobertura.
  const [
    barrios,
    setBarrios,
  ] = useState<Barrio[]>([]);

  const [
    clinics,
    setClinics,
  ] = useState<Salita[]>([]);

  const [
    zones,
    setZones,
  ] = useState<Zona[]>([]);

  const [
    relations,
    setRelations,
  ] = useState<Cobertura[]>([]);

  // Estado de carga.
  const [
    loading,
    setLoading,
  ] = useState(true);

  // Mensaje de error.
  const [
    error,
    setError,
  ] = useState('');

  // Permite volver a ejecutar la consulta.
  const [
    revision,
    setRevision,
  ] = useState(0);

  // ========================================
  // CARGA DE COBERTURA
  // ========================================

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    // Comparte los catálogos existentes;
    // no deduce cobertura por cercanía.
    void Promise.all([
      getBarrios(),
      getSalitas(),
      getZonas(),
      getCoberturas(),
    ])
      .then(
        ([
          b,
          s,
          z,
          r,
        ]) => {
          if (!active) {
            return;
          }

          // Guarda los catálogos obtenidos.
          setBarrios(
            b.data.barrios
          );

          setClinics(
            s.data
          );

          setZones(
            z
          );

          setRelations(
            r
          );
        }
      )
      .catch(() => {
        if (active) {
          setError(
            'No se pudo cargar tu cobertura.'
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    // Evita actualizar el estado
    // después de desmontar el componente.
    return () => {
      active = false;
    };
  }, [revision]);

  // Fuerza una nueva carga de cobertura con referencia estable.
  const retry = useCallback(() => {
    setRevision((v) => v + 1);
  }, []);

  // ========================================
  // DATOS EXPUESTOS POR EL HOOK
  // ========================================

  return {
    barrios,
    clinics,
    zones,
    relations,
    loading,
    error,
    retry,
  };
}