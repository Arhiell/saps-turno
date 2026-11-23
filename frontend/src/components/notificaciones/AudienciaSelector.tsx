import {
  useEffect,
  useState,
} from 'react';

import type {
  Audiencia,
  Destinatario,
  OpcionesEnvio,
} from '../../types/notificacion.types';

import {
  buscarDestinatarios,
} from '../../services/notificaciones.service';

import {
  authError,
} from '../../utils/auth-errors';

import {
  roleLabels,
} from '../layout/sidebar-menu';

interface Props {
  value: Audiencia;
  onChange: (
    value: Audiencia
  ) => void;
  opciones: OpcionesEnvio;
  global: boolean;
  individual: boolean;
  onIndividual: (
    value: boolean
  ) => void;
  onNombre: (
    value: string
  ) => void;
}

export default function AudienciaSelector({
  value,
  onChange,
  opciones,
  global,
  individual,
  onIndividual,
  onNombre,
}: Props) {
  const [
    search,
    setSearch,
  ] = useState('');

  const [
    results,
    setResults,
  ] = useState<
    Destinatario[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    total,
    setTotal,
  ] = useState(0);

  // Separa el destinatario individual de los filtros generales.
  const {
    id_usuario: selected,
    ...base
  } = value;

  // Permite detectar cambios en los filtros de audiencia.
  const key =
    JSON.stringify(base);

  // Busca destinatarios cuando se selecciona el modo individual.
  useEffect(() => {
    let active = true;

    setResults([]);
    setError('');
    setTotal(0);
    setLoading(false);

    // Evita buscar hasta que los filtros mínimos estén completos.
    if (
      !individual ||
      search.trim().length < 2 ||
      (
        !global &&
        !value.id_salita
      ) ||
      (
        value.tipo ===
          'ROL' &&
        !value.rol
      )
    ) {
      return;
    }

    setLoading(true);

    // Solo busca con filtros y texto;
    // no descarga el padrón completo.
    const timer =
      window.setTimeout(
        () => {
          void buscarDestinatarios(
            JSON.parse(
              key
            ) as Audiencia,
            search.trim()
          )
            .then(
              (result) => {
                if (active) {
                  setResults(
                    result.usuarios
                  );

                  setTotal(
                    result.cantidad
                  );
                }
              }
            )
            .catch(
              (error) => {
                if (active) {
                  setError(
                    authError(
                      error
                    )
                  );
                }
              }
            )
            .finally(
              () => {
                if (active) {
                  setLoading(
                    false
                  );
                }
              }
            );
        },
        350
      );

    return () => {
      active = false;

      window.clearTimeout(
        timer
      );
    };
  }, [
    key,
    search,
    individual,
    global,
    value.id_salita,
    value.tipo,
    value.rol,
  ]);

  // Actualiza los filtros y limpia la selección individual.
  const change = (
    patch:
      Partial<Audiencia>
  ) => {
    onChange({
      ...base,
      ...patch,
    });

    onNombre('');
    setSearch('');
  };

  return (
    <div className="row g-3">
      <div className="col-12 col-md-6">
        <label
          htmlFor="audiencia-tipo"
          className="form-label"
        >
          Tipo de destinatario
        </label>

        <select
          id="audiencia-tipo"
          className="form-select"
          value={value.tipo}
          onChange={(e) => {
            onChange({
              tipo:
                e.target
                  .value as Audiencia['tipo'],

              ...(value.id_salita
                ? {
                    id_salita:
                      value.id_salita,
                  }
                : {}),
            });

            onNombre('');
            setSearch('');
          }}
        >
          <option value="USUARIOS">
            Usuarios
          </option>

          <option value="PACIENTES">
            Pacientes
          </option>

          <option value="PROFESIONALES">
            Profesionales
          </option>

          <option value="ADMINISTRADORES">
            Administradores
          </option>

          {global && (
            <option value="ROL">
              Usuarios por rol
            </option>
          )}
        </select>
      </div>

      <div className="col-12 col-md-6">
        <label
          htmlFor="audiencia-salita"
          className="form-label"
        >
          Salita
        </label>

        <select
          id="audiencia-salita"
          className="form-select"
          value={
            value.id_salita ??
            ''
          }
          required={!global}
          onChange={(e) => {
            const next = {
              ...base,
            };

            delete next.id_salita;

            if (
              e.target.value
            ) {
              next.id_salita =
                e.target.value;
            }

            onChange(next);
            onNombre('');
            setSearch('');
          }}
        >
          <option value="">
            {global
              ? 'Todas las salitas / alcance global'
              : 'Seleccioná tu salita'}
          </option>

          {opciones.salitas.map(
            (item) => (
              <option
                key={
                  item.id_salita
                }
                value={
                  item.id_salita
                }
              >
                {item.nombre}
              </option>
            )
          )}
        </select>
      </div>

      {value.tipo ===
        'ROL' && (
        <div className="col-12 col-md-6">
          <label
            htmlFor="audiencia-rol"
            className="form-label"
          >
            Rol
          </label>

          <select
            id="audiencia-rol"
            className="form-select"
            required
            value={
              value.rol ?? ''
            }
            onChange={(e) =>
              change({
                rol:
                  e.target.value,
              })
            }
          >
            <option value="">
              Seleccioná un rol
            </option>

            {[
              'SUPER_ADMIN',
              'ADMIN_SALITA',
              'RECEPCION',
              'PROFESIONAL',
              'PACIENTE',
            ].map(
              (rol) => (
                <option
                  key={rol}
                  value={rol}
                >
                  {roleLabels[
                    rol
                  ] ?? rol}
                </option>
              )
            )}
          </select>
        </div>
      )}

      {value.tipo ===
        'PROFESIONALES' && (
        <div className="col-12 col-md-6">
          <label
            htmlFor="audiencia-especialidad"
            className="form-label"
          >
            Especialidad
          </label>

          <select
            id="audiencia-especialidad"
            className="form-select"
            value={
              value.id_especialidad ??
              ''
            }
            onChange={(e) => {
              const next = {
                ...base,
              };

              delete next.id_especialidad;

              if (
                e.target.value
              ) {
                next.id_especialidad =
                  e.target.value;
              }

              onChange(next);
              onNombre('');
              setSearch('');
            }}
          >
            <option value="">
              Todas las especialidades
            </option>

            {opciones.especialidades.map(
              (item) => (
                <option
                  key={
                    item.id_especialidad
                  }
                  value={
                    item.id_especialidad
                  }
                >
                  {item.nombre}
                </option>
              )
            )}
          </select>
        </div>
      )}

      <div className="col-12">
        <label
          htmlFor="audiencia-grupo"
          className="form-label"
        >
          Destinatario / grupo
        </label>

        <select
          id="audiencia-grupo"
          className="form-select"
          value={
            individual
              ? 'uno'
              : 'todos'
          }
          onChange={(e) => {
            onIndividual(
              e.target.value ===
                'uno'
            );

            onChange(base);
            onNombre('');
            setSearch('');
          }}
        >
          <option value="todos">
            Todos los usuarios del grupo seleccionado
          </option>

          <option value="uno">
            Un destinatario específico
          </option>
        </select>
      </div>

      {individual && (
        <div className="col-12">
          <label
            htmlFor="audiencia-buscar"
            className="form-label"
          >
            Buscar por nombre, apellido, DNI, email o usuario
          </label>

          <input
            id="audiencia-buscar"
            type="search"
            className="form-control"
            maxLength={100}
            value={search}
            placeholder="Escribí al menos 2 caracteres"
            onChange={(e) => {
              setSearch(
                e.target.value
              );

              onChange(base);
              onNombre('');
            }}
          />

          {loading && (
            <p role="status">
              Buscando destinatarios…
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="text-danger"
            >
              {error}
            </p>
          )}

          {!loading &&
            search.trim().length >=
              2 &&
            !error && (
              <p className="form-text">
                {total
                  ? `${total} resultados. Se muestran hasta 20; refiná la búsqueda si hace falta.`
                  : 'No se encontraron destinatarios.'}
              </p>
            )}

          <div className="list-group mt-2">
            {results.map(
              (item) => (
                <button
                  key={
                    item.id_usuario
                  }
                  type="button"
                  className={`list-group-item list-group-item-action text-break${
                    selected ===
                    item.id_usuario
                      ? ' active'
                      : ''
                  }`}
                  onClick={() => {
                    onChange({
                      ...base,
                      id_usuario:
                        item.id_usuario,
                    });

                    onNombre(
                      item.nombre
                    );
                  }}
                >
                  <strong>
                    {item.nombre}
                  </strong>

                  <br />

                  <small>
                    {item.email}
                    {' · '}
                    {roleLabels[
                      item.rol
                    ] ?? item.rol}
                  </small>
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}