import HowItWorks from '../../components/public/HowItWorks';
import InformationalCarousel from '../../components/public/PublicCarousel';
import PublicHero from '../../components/public/PublicHero';
import MunicipalNewsSection from '../../components/public/MunicipalNewsSection';
import PublicSalitasSection from '../../components/public/PublicSalitasSection';
import SapsNewsSection from '../../components/public/SapsNewsSection';

// Página principal pública.
// Cada sección obtiene sus propios datos y administra sus estados de forma independiente.
export default function PublicHomePage() {
  return (
    <>
      <PublicHero />

      <InformationalCarousel />

      <HowItWorks />

      <PublicSalitasSection />

      <SapsNewsSection />

      <MunicipalNewsSection />
    </>
  );
}