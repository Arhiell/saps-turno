import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import usePrivacyNotice from '../../context/usePrivacyNotice';
import PrivacyNoticeActions, { PrivacyDetails } from './PrivacyNotice';
import '../../styles/privacy.css';

export default function PrivacyBanner() {
  const acknowledgement = usePrivacyNotice();
  const { pathname } = useLocation();
  const hidden = acknowledgement !== null || pathname === '/privacidad';
  const [height, setHeight] = useState(0);
  const banner = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hidden || !banner.current) return;
    const element = banner.current;
    const observer = new ResizeObserver(() => {
      const measuredHeight = element.getBoundingClientRect().height;
      setHeight(measuredHeight);
      document.documentElement.style.setProperty('--cora-privacy-banner-height', `${measuredHeight}px`);
    });
    observer.observe(element);
    const viewport = window.visualViewport;
    const resize = () => {
      element.style.setProperty('--privacy-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty('--privacy-keyboard-offset', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    };
    resize();
    window.addEventListener('resize', resize);
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--cora-privacy-banner-height');
      window.removeEventListener('resize', resize);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
    };
  }, [hidden]);

  if (hidden) return null;

  return <>
    <div className="cora-privacy__space" style={{ height }} aria-hidden="true" />
    <section ref={banner} className="cora-privacy cora-privacy__banner" aria-labelledby="cora-privacy-title">
      <div className="cora-privacy__heading">
        <i className="bi bi-shield-check" aria-hidden="true" />
        <h2 id="cora-privacy-title" className="h5 mb-0">Tu privacidad es importante</h2>
      </div>
      <p className="small mb-2">En CORA utilizamos tus datos personales para gestionar tu cuenta, tus turnos y los servicios de atención disponibles. También usamos almacenamiento en tu navegador para mantener tu sesión y permitir el funcionamiento del sitio. Consultá nuestra política de privacidad para conocer cómo tratamos tu información.</p>
      <PrivacyDetails />
      <div className="mt-3">
        <PrivacyNoticeActions />
      </div>
    </section>
  </>;
}
