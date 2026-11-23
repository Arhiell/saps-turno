import { useEffect, useId, useState } from 'react';
import { getZonas } from '../../services/configuracion.service';
import type { Barrio } from '../../types/barrio.types';
import type { Zona } from '../../types/configuracion.types';

interface Props {
  barrios: Barrio[];
  value: string;
  onChange: (idBarrio: string) => void;
  disabled?: boolean;
}

export default function ZonaBarrioSelect({
  barrios,
  value,
  onChange,
  disabled = false,
}: Props) {
  const id = useId();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void getZonas()
      .then((data) => {
        if (active) setZonas(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [revision]);

  // Conserva la zona del barrio guardado al abrir un registro para editar.
  const zone = barrios.find((barrio) => barrio.id_barrio === value)?.id_zona
    ?? selectedZone;
  const availableBarrios = barrios.filter((barrio) => barrio.id_zona === zone);

  return (
    <div className="row g-2">
      <div className="col-sm-6">
        <label className="form-label" htmlFor={`${id}-zona`}>Zona</label>
        <select
          id={`${id}-zona`}
          className="form-select"
          value={zone}
          disabled={disabled || loading || error}
          required
          onChange={(event) => {
            setSelectedZone(event.target.value);
            onChange('');
          }}
        >
          <option value="">{loading ? 'Cargando zonas...' : 'Seleccionar zona'}</option>
          {zonas.map((zona) => (
            <option key={zona.id_zona} value={zona.id_zona}>{zona.nombre}</option>
          ))}
        </select>
      </div>
      <div className="col-sm-6">
        <label className="form-label" htmlFor={`${id}-barrio`}>Barrio</label>
        <select
          id={`${id}-barrio`}
          className="form-select"
          value={value}
          disabled={disabled || loading || error || !zone}
          required
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {!zone ? 'Seleccionar primero una zona'
              : availableBarrios.length ? 'Seleccionar barrio' : 'No hay barrios en esta zona'}
          </option>
          {availableBarrios.map((barrio) => (
            <option key={barrio.id_barrio} value={barrio.id_barrio}>{barrio.nombre}</option>
          ))}
        </select>
      </div>
      {error && (
        <div className="col-12" role="alert">
          No se pudieron cargar las zonas.{' '}
          <button type="button" className="btn btn-link p-0" disabled={disabled}
            onClick={() => setRevision((current) => current + 1)}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
