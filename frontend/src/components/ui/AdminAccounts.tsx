import type {
  AccountDisplay,
} from '../../types/account-display.types';

import type {
  Salita,
} from '../../types/salita.types';

import AccountSummary from './AccountSummary';

interface AdminAccountsProps {
  salitas: Salita[];
  loading: boolean;
}

// Muestra las cuentas de administradores asociadas a las salitas.
export default function AdminAccounts({
  salitas,
  loading,
}: AdminAccountsProps) {
  // Agrupa cada cuenta con todas las salitas que administra.
  const accounts = new Map<
    string,
    {
      account: AccountDisplay;
      salitas: Set<string>;
    }
  >();

  for (const salita of salitas) {
    for (
      const relation
      of salita.administradores ?? []
    ) {
      const account =
        relation.cuenta;

      if (
        !account ||
        account.rol.codigo !==
          'ADMIN_SALITA'
      ) {
        continue;
      }

      const row =
        accounts.get(
          account.id_usuario
        ) ?? {
          account,
          salitas:
            new Set<string>(),
        };

      row.salitas.add(
        salita.nombre
      );

      accounts.set(
        account.id_usuario,
        row
      );
    }
  }

  return (
    <section
      className="mt-4 border-top pt-4"
      aria-labelledby="admin-accounts-title"
    >
      <h2
        id="admin-accounts-title"
        className="h5"
      >
        Administradores de salita
      </h2>

      {loading ? (
        <p className="text-muted">
          Cargando cuentas…
        </p>
      ) : accounts.size === 0 ? (
        <p className="text-muted">
          No hay cuentas de administradores
          asociadas a las salitas disponibles.
        </p>
      ) : (
        <div className="row g-3">
          {[...accounts.values()].map(
            ({
              account,
              salitas: names,
            }) => (
              <div
                className="col-12 col-lg-6"
                key={
                  account.id_usuario
                }
              >
                <div className="border rounded p-3 h-100 text-break">
                  <AccountSummary
                    account={account}
                  />

                  <div className="small mt-2">
                    Email:{' '}
                    {account.email}
                  </div>

                  <div className="small text-muted">
                    Administrador de
                    salita ·{' '}
                    {account.activo
                      ? 'Activo'
                      : 'Inactivo'}
                  </div>

                  <div className="small text-muted">
                    {[...names].join(
                      ', '
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}