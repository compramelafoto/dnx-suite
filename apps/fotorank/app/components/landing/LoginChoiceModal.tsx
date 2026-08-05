/**
 * @deprecated ETAPA 09B — eliminada la selección de rol pre-login.
 * El acceso es siempre `/login`; el backend resuelve capacidades.
 * Este archivo se mantiene vacío de UI para no romper imports residuales de tests/docs.
 */
export function LoginChoiceModal(_props: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return null;
}
