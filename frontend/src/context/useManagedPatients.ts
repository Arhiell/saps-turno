import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getManagedPatients, type ManagedPatient } from '../services/managed-patients.service';
import { authError } from '../utils/auth-errors';

export default function useManagedPatients() {
  const { patient, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<ManagedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setItems([]);
    void getManagedPatients().then(rows => { if (active) setItems(rows); })
      .catch(cause => { if (active) setError(authError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id_usuario, revision]);
  const id = params.get('paciente') ?? patient?.id_paciente ?? '';
  const selected = id === patient?.id_paciente ? patient : items.find(row => row.id_paciente === id);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  const select = useCallback((value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.set('paciente', value);
    return next;
  }), [setParams]);

  return { items, selected, id, loading,
    error: error || (!loading && !selected ? 'Esta persona no está disponible entre tus vínculos autorizados.' : ''),
    retry,
    select,
  };
}
