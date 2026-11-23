import { useState } from 'react';
import { Link } from 'react-router-dom';
import { acknowledgePrivacyNotice } from '../../utils/privacy-notice';

export function PrivacyDetails() {
  return <details className="cora-privacy__details">
    <summary>Detalles de privacidad</summary>
    <div className="cora-privacy__details-content">
      <p>En CORA utilizamos tus datos personales para gestionar tu cuenta, tus turnos y los servicios de atención disponibles.</p>
      <p>Usamos almacenamiento en tu navegador para mantener tu sesión y permitir el funcionamiento del sitio. También recordamos que leíste este aviso.</p>
      <p>«Entendido» solo cierra este aviso y recuerda su lectura en este navegador. No constituye consentimiento para el tratamiento de datos médicos ni habilita usos opcionales.</p>
      <p className="small text-muted mb-0">La política disponible es una versión de prueba pendiente de validación institucional.</p>
    </div>
  </details>;
}

export function PrivacyPolicyLink() {
  return <Link className="btn btn-outline-success" to="/privacidad">Ver política de privacidad</Link>;
}

export default function PrivacyNoticeActions() {
  const [error, setError] = useState('');
  const acknowledge = () => {
    if (acknowledgePrivacyNotice()) setError('');
    else setError('No pudimos recordar la lectura del aviso. Revisá si tu navegador permite el almacenamiento local.');
  };
  return <div>
    {error && <p className="text-danger small" role="alert">{error}</p>}
    <div className="cora-privacy__actions">
      <button type="button" className="btn btn-saps" onClick={acknowledge}>Entendido</button>
      <PrivacyPolicyLink />
    </div>
  </div>;
}
