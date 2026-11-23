import {
  newWeeklySlot,
  scheduleDays,
  type WeeklySlot,
} from '../../utils/weekly-schedule';

// Permite configurar los días y las franjas horarias de atención.
export default function WeeklyScheduleFields({
  slots,
  onChange,
}: {
  slots: WeeklySlot[];
  onChange: (slots: WeeklySlot[]) => void;
}) {
  return (
    <div className="col-12">
      <fieldset className="border rounded p-3">
        <legend className="float-none w-auto fs-6 px-2">
          Días y horarios de atención
        </legend>

        <p className="small text-muted">
          Seleccioná los días y ajustá sus horarios. Podés agregar
          otra franja para atender por la mañana y por la tarde.
          La duración del turno, el cupo y la vigencia se aplican
          a todas las franjas.
        </p>

        {/* Recorre los días de la semana. */}
        {scheduleDays.map((day, index) => {
          // Obtiene las franjas configuradas para el día.
          const daySlots = slots.filter(
            (slot) => slot.dia_semana === index + 1
          );

          return (
            <div
              key={day}
              className="border-bottom py-2"
            >
              {/* Permite habilitar o deshabilitar el día. */}
              <label className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={daySlots.length > 0}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [
                            ...slots,
                            newWeeklySlot(index + 1),
                          ]
                        : slots.filter(
                            (slot) =>
                              slot.dia_semana !== index + 1
                          )
                    )
                  }
                />

                <span className="form-check-label fw-semibold">
                  {day}
                </span>
              </label>

              {/* Muestra las franjas horarias del día. */}
              {daySlots.map((slot, slotIndex) => (
                <div
                  className="row g-2 align-items-end mb-2"
                  key={slot.key}
                >
                  {/* Permite modificar el inicio y fin de cada franja. */}
                  {(
                    ['hora_inicio', 'hora_fin'] as const
                  ).map((field) => (
                    <label
                      className="col-5 col-md-4 form-label mb-0"
                      key={field}
                    >
                      {field === 'hora_inicio'
                        ? 'Inicio'
                        : 'Fin'}{' '}
                      · franja {slotIndex + 1}

                      <input
                        className="form-control"
                        type="time"
                        required
                        aria-label={`${day}, franja ${
                          slotIndex + 1
                        }, ${
                          field === 'hora_inicio'
                            ? 'inicio'
                            : 'fin'
                        }`}
                        value={slot[field]}
                        onChange={(event) =>
                          onChange(
                            slots.map((item) =>
                              item.key === slot.key
                                ? {
                                    ...item,
                                    [field]: event.target.value,
                                  }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                  ))}

                  {/* Elimina una franja horaria específica. */}
                  <div className="col-auto">
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      aria-label={`Quitar franja ${
                        slotIndex + 1
                      } del ${day}`}
                      onClick={() =>
                        onChange(
                          slots.filter(
                            (item) => item.key !== slot.key
                          )
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}

              {/* Permite agregar otra franja al día habilitado. */}
              {daySlots.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() =>
                    onChange([
                      ...slots,
                      newWeeklySlot(index + 1, true),
                    ])
                  }
                >
                  Agregar otra franja
                </button>
              )}
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}