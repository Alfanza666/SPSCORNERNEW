import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * PreOrder redirect page.
 * Backward-compatible: redirects old /kiosk/preorder URLs to the
 * integrated Pre-Order tab in the main Catalog page.
 */
export default function PreOrder() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/kiosk?tab=preorder', { replace: true });
  }, [navigate]);

  return null;
}
