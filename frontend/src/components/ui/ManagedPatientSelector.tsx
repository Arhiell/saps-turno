import { useAuth } from '../../context/AuthContext';
import type useManagedPatients from '../../context/useManagedPatients';
import { formatManagedKinship } from '../../utils/kinship';

export default function ManagedPatientSelector({ selection, disabled = false }: {
  selection: ReturnType<typeof useManagedPatients>; disabled?: boolean;
}) {
  const { patient } = useAuth();
  return <div className="patient-section mb-3">
    <label className="form-label w-100">Paciente que recibirá la atención
      <select className="form-select mt-2" value={selection.id} disabled={disabled || selection.loading}
        onChange={event => selection.select(event.target.value)}>
        {patient && <option value={patient.id_paciente}>Para mí — {patient.apellidos}, {patient.nombres}</option>}
        {selection.items.map(row => <option key={row.id_paciente} value={row.id_paciente}>
          {row.apellidos}, {row.nombres} — DNI {row.dni} ({formatManagedKinship(row, patient)})
        </option>)}
        {!selection.selected && selection.id && <option value={selection.id}>Persona no disponible</option>}
      </select>
    </label>
    {selection.loading && <p role="status">Cargando personas a cargo…</p>}
    {selection.error && <div className="alert alert-danger" role="alert">{selection.error}{' '}
      <button className="btn btn-sm btn-outline-danger" disabled={disabled} onClick={selection.retry}>Reintentar</button>
    </div>}
  </div>;
}
