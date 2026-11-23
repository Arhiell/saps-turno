import AppRoutes from './routes/AppRoutes';
import AccessNoticeModal from './components/ui/AccessNoticeModal';
import { AgendaLiveToasts } from './components/ui/AgendaLiveToast';

function App() {
  return (
    <>
      <AppRoutes />
      <AccessNoticeModal />
      <AgendaLiveToasts />
    </>
  );
}

export default App;
