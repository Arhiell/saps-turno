import {
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import ConfirmationModal from './ConfirmationModal';

import {
  closeAccessNotice,
  getAccessNotice,
  subscribeAccessNotice,
} from '../../utils/access-notice';

import { getAccessToken } from '../../utils/auth-storage';

import api from '../../services/api';

// Muestra las restricciones de acceso y las sanciones del usuario.
export default function AccessNoticeModal() {
  const notice = useSyncExternalStore(
    subscribeAccessNotice,
    getAccessNotice,
    () => null
  );

  // Evita que se ejecuten varias comprobaciones simultáneas.
  const requestInFlight = useRef(false);

  // Comprueba periódicamente si la cuenta tiene restricciones.
  useEffect(() => {
    let active = true;

    const check = async () => {
      if (
        !active ||
        !getAccessToken() ||
        document.visibilityState !== 'visible' ||
        requestInFlight.current
      ) {
        return;
      }

      requestInFlight.current = true;

      try {
        await api.get('/auth/me');
      } catch {
        // El interceptor muestra el bloqueo cuando corresponde.
      } finally {
        requestInFlight.current = false;
      }
    };

    // Comprueba una vez al montar el componente.
    void check();

    // Detecta bloqueos administrativos mientras el usuario permanece conectado.
    const timer = window.setInterval(() => {
      void check();
    }, 60_000);

    // Comprueba nuevamente cuando la ventana recupera el foco.
    // check() evita duplicar una petición si ya hay una en curso.
    window.addEventListener('focus', check);

    // Limpia el intervalo y el evento al desmontar el componente.
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);

  // No muestra el modal si no existen notificaciones.
  if (!notice) {
    return null;
  }

  // Identifica si la restricción corresponde a la cuenta.
  const account = notice.code.startsWith('ACCOUNT_');

  // Cierra el aviso y redirige si existe una restricción de acceso.
  const close = () => {
    closeAccessNotice();

    if (account) {
      window.location.assign('/login');
    }
  };

  // Obtiene la fecha de finalización de la restricción.
  const end = notice.data?.fecha_fin;

  // Formatea la fecha utilizando la zona horaria argentina.
  const endLabel =
    end && Number.isFinite(Date.parse(end))
      ? new Intl.DateTimeFormat('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          dateStyle: 'full',
          timeStyle: 'short',
        }).format(new Date(end))
      : null;

  return (
    <ConfirmationModal
      open
      title={
        account
          ? 'Cuenta bloqueada'
          : 'Suspensión de reservas'
      }
      subtitle={
        account
          ? 'Acceso a la cuenta restringido'
          : 'La restricción alcanza a todas las especialidades'
      }
      message={notice.message}
      detail={
        <>
          {/* Muestra el motivo de la restricción. */}
          {notice.data?.motivo && (
            <p>{notice.data.motivo}</p>
          )}

          {/* Informa cuándo finaliza la restricción. */}
          {endLabel && (
            <p className="mb-0">
              Se habilita automáticamente el {endLabel}
              {' '}(hora argentina).
            </p>
          )}
        </>
      }
      variant="warning"
      icon="bi-shield-exclamation"
      notice={null}
      hideCancel
      confirmText={
        account
          ? 'Volver al inicio de sesión'
          : 'Entendido'
      }
      onClose={close}
      onConfirm={close}
    />
  );
}
