import { usePublicResource } from '../../context/usePublicResource';
import { getPublicSalitas } from '../../services/public-content.service';

import ResourceState from './ResourceState';

import {
  PublicCarousel,
} from './PublicCarousel';

// Muestra públicamente la información de contacto de las SAPS.
export default function PublicSalitasSection() {
  const resource =
    usePublicResource(
      getPublicSalitas
    );

  return (
    <section
      className="container public-section"
      id="salitas"
    >
      <p className="public-eyebrow">
        CERCA DE VOS
      </p>

      <h2>
        Conocé las SAPS
      </h2>

      <p>
        Consultá los datos de contacto de las salitas. Al completar
        tu perfil, podrás conocer la cobertura que te corresponde.
      </p>

      {/* Estado de carga, error o ausencia de salitas. */}
      <ResourceState
        {...resource}
        empty={
          resource.data
            ?.length === 0
        }
        emptyText="No hay salitas disponibles para mostrar."
      />

      {/* Carrusel con la información pública de cada salita. */}
      <PublicCarousel
        label="Salitas SAPS"
        autoPlay
        slideLabels={
          resource.data?.map(
            (salita) =>
              salita.nombre
          )
        }
        slides={
          resource.data?.map(
            (salita) => (
              <article
                className="card public-salita-card p-4"
                key={
                  salita.id_salita
                }
              >
                <h3 className="h5">
                  <i
                    className="bi bi-hospital me-2"
                    aria-hidden="true"
                  />

                  {salita.nombre}
                </h3>

                <p>
                  <i
                    className="bi bi-geo-alt me-2"
                    aria-hidden="true"
                  />

                  {salita.direccion}
                </p>

                <dl className="mb-0">
                  <dt>
                    Zona
                  </dt>

                  <dd>
                    {salita.zona ??
                      'Sin información publicada'}
                  </dd>

                  <dt>
                    Teléfono
                  </dt>

                  <dd>
                    {salita.telefono ? (
                      <a
                        href={`tel:${salita.telefono.replace(
                          /[^+\d]/g,
                          ''
                        )}`}
                      >
                        {salita.telefono}
                      </a>
                    ) : (
                      'Sin teléfono publicado'
                    )}
                  </dd>

                  <dt>
                    Horario
                  </dt>

                  <dd>
                    {salita.horario_apertura &&
                    salita.horario_cierre
                      ? `${salita.horario_apertura.slice(
                          0,
                          5
                        )} a ${salita.horario_cierre.slice(
                          0,
                          5
                        )}`
                      : 'Consultar en la salita'}
                  </dd>
                </dl>
              </article>
            )
          ) ?? []
        }
      />
    </section>
  );
}