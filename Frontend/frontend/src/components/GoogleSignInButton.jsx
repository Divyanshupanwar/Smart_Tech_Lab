import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginWithGoogle } from '../authSlice';
import axiosClient from '../utils/axiosClient';

const GOOGLE_SCRIPT_ID = 'google-identity-services';

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
  if (existingScript) {
    if (existingScript.dataset.loaded === 'true') {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = "432964047367-9pocqp2hemqq9uo7es7fk5q3n7nd4364.apps.googleusercontent.com";
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

function GoogleSignInButton() {
  const dispatch = useDispatch();
  const buttonRef = useRef(null);
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [configLoading, setConfigLoading] = useState(!import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (clientId) {
      setConfigLoading(false);
      return undefined;
    }

    axiosClient.get('/user/public-auth-config')
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }

        setClientId(data?.googleClientId || '');
      })
      .catch(() => {
        if (isMounted) {
          setLocalError('Unable to load Google sign-in configuration.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setConfigLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    let isMounted = true;

    if (!clientId || !buttonRef.current) {
      return undefined;
    }

    loadGoogleScript()
      .then(() => {
        if (!isMounted || !window.google?.accounts?.id || !buttonRef.current) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response?.credential) {
              if (isMounted) {
                setLocalError('Google sign-in did not return a valid credential.');
              }
              return;
            }

            const result = await dispatch(loginWithGoogle({ credential: response.credential }));
            if (loginWithGoogle.rejected.match(result) && isMounted) {
              setLocalError(result.payload || 'Google sign-in failed.');
            } else if (isMounted) {
              setLocalError('');
            }
          }
        });

        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: Math.min(buttonRef.current.offsetWidth || 360, 360)
        });
      })
      .catch(() => {
        if (isMounted) {
          setLocalError('Google sign-in is unavailable right now.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clientId, dispatch]);

  if (configLoading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
        Loading Google sign-in...
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
        Google sign-in is not configured on the server yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={buttonRef} className="flex justify-center" />
      {localError && <p className="text-center text-xs font-medium text-red-500">{localError}</p>}
    </div>
  );
}

export default GoogleSignInButton;
