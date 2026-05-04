import React from 'react';
import AdminSettings from './AdminSettings';

/**
 * AdminLoyalty — Dedicated route for loyalty program settings.
 * Reuses AdminSettings component. The loyalty panel is rendered
 * inside AdminSettings and is visible only to superadmin role.
 */
export default function AdminLoyalty() {
  return <AdminSettings />;
}
