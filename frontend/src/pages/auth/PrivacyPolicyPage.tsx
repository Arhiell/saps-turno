import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return <article className="card p-3 p-md-4 mx-auto" style={{ maxWidth: 960 }} aria-labelledby="privacy-policy-title">
    <h1 id="privacy-policy-title" className="h3">Política de privacidad</h1>
    <p className="text-muted">Información sobre tus datos y el almacenamiento del sitio.</p>

    <div className="alert alert-warning" role="note">
      <strong>Versión de prueba.</strong> Este contenido es un borrador informativo pendiente de validación institucional. La política definitiva todavía no fue publicada.
    </div>

    <section aria-labelledby="privacy-data-title">
      <h2 id="privacy-data-title" className="h5">Uso de tus datos</h2>
      <p>CORA utiliza los datos que ingresás para gestionar tu cuenta, tu perfil, tus turnos y los servicios de atención disponibles. Según el trámite, estos pueden incluir datos de identificación, contacto y cobertura de salud.</p>
      <p>La información disponible en el sistema depende del rol y los permisos de cada cuenta. Este aviso no reemplaza la información ni los consentimientos específicos que correspondan a la atención de salud.</p>
    </section>

    <section aria-labelledby="privacy-storage-title">
      <h2 id="privacy-storage-title" className="h5">Almacenamiento en tu navegador y cookies</h2>
      <p>El sitio utiliza almacenamiento local para mantener tu sesión, recordar la lectura del aviso y conservar ajustes de la interfaz. Algunos mensajes temporales se guardan solo durante la sesión de navegación.</p>
      <p>Este almacenamiento no es lo mismo que las cookies. No se identificaron cookies de analítica o publicidad propias en el frontend revisado. El acceso con Google, cuando está disponible, utiliza servicios externos que pueden emplear sus propias cookies y tecnologías.</p>
      <p>Podés gestionar los datos del sitio desde tu navegador. Si los eliminás, podrías cerrar tu sesión y volver a ver el aviso de privacidad.</p>
    </section>

    <section aria-labelledby="privacy-services-title">
      <h2 id="privacy-services-title" className="h5">Servicios externos</h2>
      <p>Algunas funciones utilizan servicios externos, como el acceso con Google y la ayuda del asistente mediante Gemini. El asistente muestra sus propias aclaraciones: no ingreses datos personales ni clínicos en sus consultas.</p>
    </section>

    <section aria-labelledby="privacy-acknowledgement-title">
      <h2 id="privacy-acknowledgement-title" className="h5">Qué significa «Entendido»</h2>
      <p>El botón cierra el aviso y guarda únicamente su versión y la fecha de lectura en este navegador. No habilita publicidad, seguimiento ni tratamientos adicionales de tus datos. Consultar esta página no registra la lectura del aviso.</p>
    </section>

    <section aria-labelledby="privacy-contact-title">
      <h2 id="privacy-contact-title" className="h5">Consultas sobre tus datos</h2>
      <p>La versión definitiva deberá identificar a la entidad responsable, el canal oficial para solicitar acceso, corrección o eliminación de datos, los plazos de conservación y las condiciones de intervención de proveedores externos. Estos datos están pendientes de confirmación.</p>
    </section>

    <div><Link to="/mi-perfil" className="btn btn-outline-success">Ir a mi perfil</Link></div>
  </article>;
}
