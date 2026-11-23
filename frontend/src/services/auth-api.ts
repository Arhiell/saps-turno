import axios from 'axios';

import { reportAccessNotice } from '../utils/access-notice';

// Configura la instancia de Axios para las solicitudes de autenticación.
const authApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'http://localhost:3000/api',

  headers: {
    'Content-Type': 'application/json',
  },
});

// Detecta restricciones de acceso y propaga los errores.
authApi.interceptors.response.use(
  (response) => response,

  (error: unknown) => {
    reportAccessNotice(error);

    return Promise.reject(error);
  }
);

export default authApi;