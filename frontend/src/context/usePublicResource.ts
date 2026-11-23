import {
  useEffect,
  useState,
} from 'react';

import {
  authError,
} from '../utils/auth-errors';

// Carga un recurso público y administra sus estados
// de datos, error, carga y reintento.
export function usePublicResource<T>(
  loader: () => Promise<T>
) {
  const [
    data,
    setData,
  ] = useState<T>();

  const [
    error,
    setError,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    attempt,
    setAttempt,
  ] = useState(0);

  // Ejecuta la carga inicial y cada nuevo intento.
  // Ignora respuestas antiguas al desmontar el componente
  // o al cambiar la función de carga.
  useEffect(
    () => {
      let active = true;

      setLoading(true);
      setError('');
      setData(undefined);

      loader()
        .then(
          (value) => {
            if (active) {
              setData(
                value
              );
            }
          }
        )
        .catch(
          (cause) => {
            if (active) {
              setError(
                authError(
                  cause
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

      // Evita actualizar el estado con una respuesta obsoleta.
      return () => {
        active = false;
      };
    },
    [
      loader,
      attempt,
    ]
  );

  // Incrementar attempt fuerza una nueva ejecución del efecto.
  const retry = () => {
    setAttempt(
      (value) =>
        value + 1
    );
  };

  return {
    data,
    error,
    loading,
    retry,
  };
}