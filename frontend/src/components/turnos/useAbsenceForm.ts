import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getBloqueos, getSalitasConfigurables } from '../../services/configuracion.service';
import { getProfessionals, getProfessionalClinics, getProfessionalSpecialties } from '../../services/profesionales.service';
import { getSpecialties } from '../../services/especialidades.service';
import type { Bloqueo, BloqueoInput } from '../../types/configuracion.types';
import type { Professional, ProfessionalClinic, ProfessionalSpecialty, Specialty } from '../../types/profesional.types';
import type { Salita } from '../../types/salita.types';
import type { AgendaChange } from '../../services/agenda-impacto.service';
import { authError } from '../../utils/auth-errors';

const empty = (): BloqueoInput => ({
  id_salita: '', id_profesional: null, id_especialidad: null, fecha: '',
  hora_inicio: null, hora_fin: null, dia_completo: true, motivo: '', activo: true,
});
export default function useAbsenceForm() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Bloqueo[]>([]);
  const [clinics, setClinics] = useState<Salita[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [relations, setRelations] = useState<{ clinics: ProfessionalClinic[]; specialties: ProfessionalSpecialty[] }>({ clinics: [], specialties: [] });
  const [relationsReady, setRelationsReady] = useState(false);
  const [form, setForm] = useState<BloqueoInput>(empty);
  const [editing, setEditing] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [impact, setImpact] = useState<AgendaChange | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setReady(false); setError('');
    void Promise.all([getBloqueos(), getSalitasConfigurables(user?.rol === 'SUPER_ADMIN'), getProfessionals(), getSpecialties()])
      .then(([r, c, p, s]) => {
        if (active) { setRows(r); setClinics(c); setProfessionals(p.data); setSpecialties(s.data); setReady(true); }
      })
      .catch(cause => { if (active) setError(authError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, user?.rol]);
  useEffect(() => {
    let active = true;
    setRelationsReady(false); setRelations({ clinics: [], specialties: [] });
    if (!form.id_profesional) { setRelationsReady(true); return; }
    void Promise.all([getProfessionalClinics(form.id_profesional), getProfessionalSpecialties(form.id_profesional)])
      .then(([c, s]) => { if (active) { setRelations({ clinics: c.data, specialties: s.data }); setRelationsReady(true); } })
      .catch(cause => { if (active) setError(authError(cause)); });
    return () => { active = false; };
  }, [form.id_profesional, revision]);
  const change = (patch: Partial<BloqueoInput>) => {
    if ('id_profesional' in patch && patch.id_profesional !== form.id_profesional) setRelationsReady(false);
    setForm(value => ({ ...value, ...patch }));
  };
  const reset = () => { setEditing(undefined); setForm(empty()); };
  const edit = (row: Bloqueo) => {
    setEditing(row.id_bloqueo); setError(''); setSuccess('');
    change({ id_salita: row.id_salita, id_profesional: row.id_profesional, id_especialidad: row.id_especialidad,
      fecha: row.fecha, dia_completo: row.dia_completo, hora_inicio: row.hora_inicio?.slice(0, 5) ?? null,
      hora_fin: row.hora_fin?.slice(0, 5) ?? null, motivo: row.motivo, activo: row.activo });
  };
  const review = () => {
    if (impact || !ready || !relationsReady) return;
    setError(''); setSuccess('');
    if (!form.fecha || !form.id_salita || !form.motivo.trim()) { setError('Indicá salita, fecha y motivo.'); return; }
    if (!form.dia_completo && (!form.hora_inicio || !form.hora_fin || form.hora_inicio >= form.hora_fin)) {
      setError('Indicá una franja válida, con inicio anterior al fin.'); return;
    }
    const current = (r: { activo: boolean; fecha_desde: string; fecha_hasta: string | null }) =>
      r.activo && r.fecha_desde <= form.fecha && (!r.fecha_hasta || r.fecha_hasta >= form.fecha);
    if (form.activo && form.id_profesional && (!relations.clinics.some(r => r.id_salita === form.id_salita && current(r)) ||
      (form.id_especialidad && !relations.specialties.some(r => r.id_especialidad === form.id_especialidad && current(r))))) {
      setError('El profesional no tiene asignadas esa salita y especialidad en la fecha seleccionada.'); return;
    }
    const input = { ...form, motivo: form.motivo.trim(), hora_inicio: form.dia_completo ? null : form.hora_inicio,
      hora_fin: form.dia_completo ? null : form.hora_fin };
    if (rows.some(r => r.id_bloqueo !== editing && r.activo && input.activo && r.id_salita === input.id_salita &&
      r.id_profesional === input.id_profesional && r.id_especialidad === input.id_especialidad && r.fecha === input.fecha &&
      r.dia_completo === input.dia_completo && (r.hora_inicio?.slice(0, 5) ?? null) === input.hora_inicio &&
      (r.hora_fin?.slice(0, 5) ?? null) === input.hora_fin)) {
      setError('Ya existe un bloqueo activo con ese alcance y franja.'); return;
    }
    setImpact({ tipo: 'bloqueo', ...(editing ? { id: editing } : {}), datos: input });
  };
  const saved = () => {
    setImpact(null); reset(); setError(''); setSuccess('Cambio de agenda guardado.'); setRevision(v => v + 1);
  };
  const professional = professionals.find(p => p.id_profesional === form.id_profesional);
  const context = [
    clinics.find(c => c.id_salita === form.id_salita)?.nombre,
    form.id_profesional ? professional ? `${professional.persona.apellidos}, ${professional.persona.nombres}` : 'Profesional no disponible' : 'Todos los profesionales',
    form.id_especialidad ? specialties.find(s => s.id_especialidad === form.id_especialidad)?.nombre : 'Todas las especialidades',
  ].filter(Boolean).join(' · ');
  return { user, rows, clinics, professionals, specialties, form, editing, loading, ready, impact, error, success,
    relationsReady, context, change, reset, edit, review, saved, close: () => setImpact(null), reload: () => setRevision(v => v + 1) };
}
