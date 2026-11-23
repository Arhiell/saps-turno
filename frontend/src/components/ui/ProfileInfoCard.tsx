import type { ReactNode } from 'react';

// Define una tarjeta para mostrar información del perfil.
export default function ProfileInfoCard({
  title,
  fields,
}: {
  title: string;
  fields: Record<string, ReactNode>;
}) {
  return (
    <section className="patient-section h-100">
      {/* Muestra el título de la sección. */}
      <h2 className="h5 mb-3">
        {title}
      </h2>

      {/* Muestra los campos y sus valores correspondientes. */}
      <dl className="row mb-0">
        {Object.entries(fields).map(([label, value]) => (
          <div
            className="col-12 col-sm-6"
            key={label}
          >
            <dt>
              {label}
            </dt>

            <dd>
              {value || 'Sin informar'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}