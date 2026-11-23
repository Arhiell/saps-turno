import type {
  AccountDisplay,
} from '../../types/account-display.types';

interface AccountSummaryProps {
  account?: AccountDisplay | null;
}

// Muestra un resumen de la cuenta asociada.
export default function AccountSummary({
  account,
}: AccountSummaryProps) {
  if (!account) {
    return null;
  }

  return (
    <div className="small mt-1 text-break">
      {account.persona && <div className="fw-semibold">
        {account.persona.nombres} {account.persona.apellidos}
      </div>}
      <div>
        Nombre de usuario:{' '}
        <span className="fw-semibold">
          {account.nombre_usuario}
        </span>
      </div>

      <span
        className={`badge ${
          account.email_verificado
            ? 'text-bg-success'
            : 'text-bg-secondary'
        } me-1`}
      >
        {account.email_verificado
          ? 'Verificado'
          : 'No verificado'}
      </span>

      {!account.activo && (
        <span className="badge text-bg-secondary">
          Cuenta inactiva
        </span>
      )}
    </div>
  );
}
