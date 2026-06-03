import { useCallback, useState } from 'react';
import { DeactivateAccountPayload, deactivateCurrentAccount } from '../services/accountDeactivation';

interface UseDeactivateAccountOptions {
  onSuccess?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'No se pudo eliminar la cuenta. Intenta de nuevo.';
}

export function useDeactivateAccount(options?: UseDeactivateAccountOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
  }, []);

  const deactivateAccount = useCallback(async (payload: DeactivateAccountPayload): Promise<boolean> => {
    if (loading) return false;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await deactivateCurrentAccount(payload);
      setSuccess(true);
      options?.onSuccess?.();
      return true;
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
      return false;
    } finally {
      setLoading(false);
    }
  }, [loading, options]);

  return {
    loading,
    error,
    success,
    reset,
    setError,
    deactivateAccount,
  };
}
