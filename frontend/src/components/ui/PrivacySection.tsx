import usePrivacyNotice from '../../context/usePrivacyNotice';
import { PrivacyDetails, PrivacyPolicyLink } from './PrivacyNotice';

export default function PrivacySection() {
  const acknowledgement = usePrivacyNotice();

  return <section className="patient-section cora-privacy mt-4" aria-labelledby="profile-privacy-title">
    <div className="cora-privacy__heading">
      <i className="bi bi-shield-check" aria-hidden="true" />
      <h2 id="profile-privacy-title" className="h5 mb-0">Privacidad y datos</h2>
    </div>
    <p className="small">Consultá la información sobre el uso de tus datos y el almacenamiento del sitio.</p>
    <p className="small text-muted">{acknowledgement
      ? `Aviso leído en este navegador: ${new Date(acknowledgement.acknowledgedAt).toLocaleString('es-AR')}.`
      : 'Todavía no se registró la lectura del aviso en este navegador.'}</p>
    <PrivacyDetails />
    <div className="mt-3">
      <PrivacyPolicyLink />
    </div>
  </section>;
}
