import React from 'react';
import AdminSettings from './AdminSettings';

/**
 * AdminPayments — Dedicated route for payment method settings.
 * Reuses AdminSettings component and scrolls to the payment section.
 * Superadmin-only panel is rendered inside AdminSettings based on role.
 */
export default function AdminPayments() {
  return <AdminSettings />;
}
