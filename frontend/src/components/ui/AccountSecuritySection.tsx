import AccountUsernameForm from './AccountUsernameForm';
import AccountPasswordForm from './AccountPasswordForm';
import AccountEmailForm from './AccountEmailForm';

// Agrupa las opciones de acceso y seguridad para todos los roles.
export default function AccountSecuritySection() {
  return (
    <>
      <h2 className="h4 mt-4 mb-0">
        Acceso y seguridad
      </h2>

      {/* Formularios para modificar el usuario y la contraseña. */}
      <div className="row g-4 mt-0">
        <div className="col-12 col-lg-6">
          <AccountUsernameForm />
        </div>

        <div className="col-12 col-lg-6">
          <AccountPasswordForm />
        </div>
      </div>

      {/* Formulario para modificar el correo electrónico. */}
      <AccountEmailForm />
    </>
  );
}