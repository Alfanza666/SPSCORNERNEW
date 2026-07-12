// @ts-nocheck
/**
 * Event Workflow V3 — Employee Gathering Service
 * 
 * Modular service for the Employee Gathering workflow:
 *   - Program eligibility preview and frozen snapshot
 *   - Transactional gathering publish
 *   - Registration state guard and draft/autosave
 *   - Server-side pricing with count-only family package
 *   - Idempotent entitlement issuance
 *   - Payment review and proof replacement
 *   - Program/gate-aware scanner with append-only audit
 *   - Doorprize eligibility from actual attendance
 *   - Unified report aggregate
 */

import crypto from "node:crypto";

// ─── Constants ───────────────────────────────────────────────────────────────

const CANONICAL_REGISTRATION_STATES = [
  'not_started', 'draft', 'declined', 'submitted', 'payment_pending',
  'payment_review', 'payment_rejected', 'confirmed', 'locked'
];

const CANONICAL_PAYMENT_STATES = [
  'not_required', 'pending', 'under_review', 'paid', 'failed',
  'expired', 'cancelled', 'refunded'
];

const ENTITLEMENT_CODES = {
  EMPLOYEE_ATTENDANCE: 'employee_attendance',
  EMPLOYEE_MEAL: 'employee_meal',
  FAMILY_ATTENDANCE: 'family_attendance',
  FAMILY_MEAL: 'family_meal',
};

const ENTITLEMENT_LIFECYCLE = {
  RESERVED: 'reserved',
  ACTIVE: 'active',
  REDEEMED: 'redeemed',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

const SCAN_RESULTS = {
  SUCCESS: 'success',
  DUPLICATE: 'duplicate',
  REJECTED: 'rejected',
  REVERSED: 'reversed',
};

// ─── Helper Functions ────────────────────────────────────────────────────────

function generateOpaqueToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function validateStateTransition(currentState: string, newState: string): boolean {
  const transitions: Record<string, string[]> = {
    not_started: ['draft'],
    draft: ['declined', 'submitted', 'payment_pending'],
    declined: ['draft'],
    submitted: ['confirmed'],
    payment_pending: ['payment_review', 'draft'],
    payment_review: ['payment_rejected', 'confirmed'],
    payment_rejected: ['payment_review'],
    confirmed: ['locked'],
    locked: ['draft'], // admin reopen only
  };
  return transitions[currentState]?.includes(newState) ?? false;
}

function calculateShirtSurcharge(shirtSize: string, shirtPriceMap: Record<string, number>): number {
  if (!shirtSize || !shirtPriceMap) return 0;
  const size = shirtSize.toUpperCase();
  // S, M, L, XL are free; XXL, XXXL use the price map
  if (['S', 'M', 'L', 'XL'].includes(size)) return 0;
  return shirtPriceMap[size] || 0;
}

function calculateFamilyItems(
  familyCount: number,
  familyPackagePrice: number,
  configVersion: number
): Array<{ item_code: string; item_name: string; item_type: string; beneficiary_type: string; beneficiary_index: number; quantity: number; unit_price: number; }> {
  if (familyCount <= 0 || familyPackagePrice <= 0) return [];
  
  const items = [];
  for (let i = 1; i <= familyCount; i++) {
    // Attendance entry
    items.push({
      item_code: `family_entry_v${configVersion}_${i}`,
      item_name: `Keluarga ${i} - Tiket Masuk`,
      item_type: 'family_entry',
      beneficiary_type: 'family',
      beneficiary_index: i,
      quantity: 1,
      unit_price: familyPackagePrice,
    });
    // Meal entitlement
    items.push({
      item_code: `family_meal_v${configVersion}_${i}`,
      item_name: `Keluarga ${i} - Kupon Makan`,
      item_type: 'family_meal',
      beneficiary_type: 'family',
      beneficiary_index: i,
      quantity: 1,
      unit_price: 0, // Included in package
    });
  }
  return items;
}

// ─── Main Service Class ──────────────────────────────────────────────────────

export class EventWorkflowService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  // ─── Program Eligibility ──────────────────────────────────────────────────

  /**
   * Preview eligibility recipients without writing a snapshot.
   * Resolves NIK, department, and join-date combinations server-side.
   */
  async previewEligibility(programId: string, filters: {
    nik_list?: string[];
    departments?: string[];
    join_date_cutoff?: string;
    include_all_employees?: boolean;
  }): Promise<{ recipients: any[]; count: number; filter_snapshot: any }> {
    const { data: program, error: programError } = await this.supabase
      .from('union_programs')
      .select('is_targeted, target_departments, target_cutoff_date, metadata')
      .eq('id', programId)
      .single();
    if (programError || !program) throw new Error('Program not found');

    const draftFilter = program.metadata?.eligibility_draft || {};
    let manualNiks = (filters.nik_list?.length ? filters.nik_list : draftFilter.niks || [])
      .map((value: unknown) => String(value).trim())
      .filter(Boolean);
    if (manualNiks.length === 0 && program.is_targeted) {
      const { data: existingRows } = await this.supabase
        .from('program_eligibility')
        .select('nik')
        .eq('program_id', programId);
      manualNiks = (existingRows || []).map((row: any) => row.nik).filter(Boolean);
    }
    const departments = (filters.departments?.length
      ? filters.departments
      : draftFilter.departments || program.target_departments || [])
      .map((value: unknown) => String(value).trim())
      .filter(Boolean);
    const cutoff = filters.join_date_cutoff || draftFilter.join_date_cutoff || program.target_cutoff_date || undefined;
    const includeAll = filters.include_all_employees === true
      || draftFilter.include_all_employees === true
      || !program.is_targeted;

    const { data: employees, error } = await this.supabase
      .from('employees')
      .select('id, nik, name, department, tanggal_masuk')
      .not('nik', 'is', null);

    if (error) throw error;

    const nikSet = new Set(manualNiks);
    const departmentSet = new Set(departments);
    const recipients = (employees || []).filter((employee: any) => {
      if (cutoff && (!employee.tanggal_masuk || String(employee.tanggal_masuk) > cutoff)) return false;
      if (includeAll) return true;
      if (nikSet.size === 0 && departmentSet.size === 0) return false;
      return nikSet.has(employee.nik) || departmentSet.has(employee.department);
    });

    const filterSnapshot = {
      nik_list: [...nikSet],
      departments: [...departmentSet],
      join_date_cutoff: cutoff || null,
      include_all_employees: includeAll,
    };

    return {
      recipients: (recipients || []).map(r => ({
        nik: r.nik,
        name: r.name,
        department: r.department,
        join_date: r.tanggal_masuk,
        user_id: r.id,
      })),
      count: (recipients || []).length,
      filter_snapshot: filterSnapshot,
    };
  }

  /**
   * Validate and atomically publish a gathering program.
   */
  async publishGathering(
    programId: string,
    adminId: string,
    formConfigId?: string
  ): Promise<{ success: boolean; config_version: number; published_at: string }> {
    // 1. Fetch program
    const { data: program, error: progError } = await this.supabase
      .from('union_programs')
      .select('*')
      .eq('id', programId)
      .single();

    if (progError || !program) throw new Error('Program not found');
    if (program.program_type !== 'gathering') throw new Error('Program must be type gathering');

    // 2. Validate RSVP deadline
    if (!program.rsvp_deadline) throw new Error('RSVP deadline is required');
    if (new Date(program.rsvp_deadline) <= new Date()) throw new Error('RSVP deadline must be in the future');
    if (program.start_date && new Date(program.rsvp_deadline) > new Date(program.start_date)) {
      throw new Error('RSVP deadline cannot be after the event starts');
    }

    // 3. Validate form config
    if (!formConfigId) {
      const { data: activeConfig } = await this.supabase
        .from('program_workflow_configs')
        .select('id')
        .eq('program_id', programId)
        .eq('is_active', true)
        .single();

      if (!activeConfig) throw new Error('No active form configuration found');
      formConfigId = activeConfig.id;
    }

    // 4. Resolve the current draft target server-side, then freeze it in the
    // same database transaction as the config-version publication.
    const preview = await this.previewEligibility(programId, {});
    const recipients = preview.recipients;
    if (recipients.length === 0) throw new Error('Eligibility snapshot contains no recipients');
    const eligibilitySnapshot = {
      recipients,
      count: recipients.length,
      generated_at: new Date().toISOString(),
    };

    // 5. Publish atomically using RPC
    const { data: result, error: publishError } = await this.supabase
      .rpc('publish_gathering', {
        p_program_id: programId,
        p_config_version: program.config_version,
        p_eligibility_snapshot: eligibilitySnapshot,
        p_eligibility_source_filter: preview.filter_snapshot,
        p_admin_id: adminId,
      });

    if (publishError) throw publishError;
    if (!result?.success) throw new Error('Publication failed');

    return {
      success: true,
      config_version: result.config_version,
      published_at: result.published_at,
    };
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Get or create a draft registration for an employee.
   */
  async getOrCreateRegistration(
    programId: string,
    userId: string,
    nik: string,
    answers: Record<string, any> = {}
  ): Promise<any> {
    // Check existing registration
    const { data: existing } = await this.supabase
      .from('program_registrations')
      .select('*')
      .eq('program_id', programId)
      .eq('nik', nik)
      .single();

    if (existing) {
      // Check if state allows editing
      if (['confirmed', 'locked'].includes(existing.registration_status)) {
        throw new Error(`Cannot edit registration in state: ${existing.registration_status}`);
      }
      return existing;
    }

    // Check RSVP deadline
    const { data: program } = await this.supabase
      .from('union_programs')
      .select('rsvp_deadline, config_version')
      .eq('id', programId)
      .single();

    if (!program) throw new Error('Program not found');
    if (program.rsvp_deadline && new Date(program.rsvp_deadline) <= new Date()) {
      throw new Error('RSVP deadline has passed');
    }

    // Create new draft
    const { data: registration, error } = await this.supabase
      .from('program_registrations')
      .insert({
        program_id: programId,
        user_id: userId,
        nik,
        registration_status: 'draft',
        attendance_status: 'unknown',
        workflow_version: program.config_version,
        answers_snapshot: answers,
      })
      .select()
      .single();

    if (error) throw error;
    return registration;
  }

  /**
   * Submit RSVP with server-side price calculation.
   */
  async submitRSVP(
    programId: string,
    userId: string,
    nik: string,
    attendanceStatus: 'attending' | 'declined',
    answers: Record<string, any>
  ): Promise<any> {
    // Get or create registration
    const registration = await this.getOrCreateRegistration(programId, userId, nik, answers);

    // Validate state transition
    const newState = attendanceStatus === 'declined' ? 'declined' : 'submitted';
    if (!validateStateTransition(registration.registration_status, newState)) {
      throw new Error(`Invalid state transition: ${registration.registration_status} → ${newState}`);
    }

    // Get program config
    const { data: program } = await this.supabase
      .from('union_programs')
      .select('*')
      .eq('id', programId)
      .single();

    // Calculate pricing server-side
    let totalAmount = 0;
    const items: any[] = [];

    if (attendanceStatus === 'attending') {
      // Employee base entitlements (free)
      items.push({
        item_code: `employee_attendance_v${program.config_version}`,
        item_name: 'Tiket Masuk Karyawan',
        item_type: 'other',
        beneficiary_type: 'employee',
        beneficiary_index: null,
        quantity: 1,
        unit_price: 0,
      });
      items.push({
        item_code: `employee_meal_v${program.config_version}`,
        item_name: 'Kupon Makan Karyawan',
        item_type: 'other',
        beneficiary_type: 'employee',
        beneficiary_index: null,
        quantity: 1,
        unit_price: 0,
      });

      // Shirt surcharge
      const shirtSize = answers.shirt_size || answers.shirtSize;
      const shirtSurcharge = calculateShirtSurcharge(shirtSize, program.shirt_price_map || {});
      if (shirtSurcharge > 0) {
        items.push({
          item_code: `shirt_${shirtSize?.toLowerCase()}_v${program.config_version}`,
          item_name: `Surcharge Ukuran ${shirtSize}`,
          item_type: 'shirt_surcharge',
          beneficiary_type: 'employee',
          beneficiary_index: null,
          quantity: 1,
          unit_price: shirtSurcharge,
        });
        totalAmount += shirtSurcharge;
      }

      // Family packages
      const familyCount = parseInt(answers.family_count || answers.familyCount || '0');
      if (familyCount > 0) {
        const familyItems = calculateFamilyItems(
          familyCount,
          program.family_package_price,
          program.config_version
        );
        items.push(...familyItems);
        totalAmount += familyCount * program.family_package_price;
      }
    }

    // Determine payment status
    let paymentStatus = 'not_required';
    if (totalAmount > 0) {
      paymentStatus = 'pending';
    }

    // Update registration
    const { data: updated, error: updateError } = await this.supabase
      .from('program_registrations')
      .update({
        registration_status: newState,
        attendance_status: attendanceStatus,
        shirt_size: answers.shirt_size || answers.shirtSize || null,
        is_camping: answers.camping === 'yes' || answers.camping === true,
        family_count: parseInt(answers.family_count || answers.familyCount || '0'),
        subtotal_amount: totalAmount,
        total_amount: totalAmount,
        payment_status: paymentStatus,
        answers_snapshot: answers,
        pricing_snapshot: {
          config_version: program.config_version,
          family_package_price: program.family_package_price,
          shirt_price_map: program.shirt_price_map,
          items,
        },
        submitted_at: new Date().toISOString(),
      })
      .eq('id', registration.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Issue base entitlements immediately if attending
    if (attendanceStatus === 'attending') {
      await this.issueBaseEntitlements(updated, items);
    }

    return {
      registration: updated,
      items,
      total_amount: totalAmount,
      payment_status: paymentStatus,
    };
  }

  /**
   * Issue base employee entitlements immediately on attending RSVP.
   */
  private async issueBaseEntitlements(registration: any, items: any[]): Promise<void> {
    for (const item of items) {
      if (item.unit_price > 0) continue; // Skip paid items

      const couponCode = `${item.beneficiary_type}_${item.item_code}_${generateOpaqueToken()}`;

      await this.supabase
        .from('program_coupons')
        .insert({
          program_id: registration.program_id,
          program_registration_id: registration.id,
          user_id: registration.user_id,
          nik: registration.nik,
          name: registration.attendee_name || 'Karyawan',
          coupon_code: couponCode,
          gate_type: item.item_type.includes('meal') ? 'meal' : 'attendance',
          status: 'active',
          beneficiary_type: item.beneficiary_type,
          beneficiary_index: item.beneficiary_index,
          entitlement_code: item.item_code.includes('meal')
            ? ENTITLEMENT_CODES.EMPLOYEE_MEAL
            : ENTITLEMENT_CODES.EMPLOYEE_ATTENDANCE,
          entitlement_metadata: {
            config_version: registration.workflow_version,
            issued_at: new Date().toISOString(),
          },
        });
    }
  }

  // ─── Payment ──────────────────────────────────────────────────────────────

  /**
   * Upload payment proof with state validation.
   */
  async uploadPaymentProof(
    registrationId: string,
    proofUrl: string,
    userId: string
  ): Promise<any> {
    const { data: registration, error: regError } = await this.supabase
      .from('program_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) throw new Error('Registration not found');
    if (registration.user_id !== userId) throw new Error('Unauthorized');

    // Validate state
    const validStates = ['payment_pending', 'payment_rejected'];
    if (!validStates.includes(registration.registration_status)) {
      throw new Error(`Cannot upload proof in state: ${registration.registration_status}`);
    }

    // Create or update payment record
    const { data: existingPayment } = await this.supabase
      .from('program_registration_payments')
      .select('id')
      .eq('registration_id', registrationId)
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingPayment) {
      // Replace rejected proof
      await this.supabase
        .from('program_registration_payments')
        .update({
          proof_url: proofUrl,
          status: 'pending',
          proof_metadata: {
            replaced_at: new Date().toISOString(),
            previous_status: 'rejected',
          },
        })
        .eq('id', existingPayment.id);
    } else {
      // Create new payment record
      await this.supabase
        .from('program_registration_payments')
        .insert({
          registration_id: registrationId,
          payment_method: 'manual_transfer',
          provider: 'manual',
          expected_amount: registration.total_amount,
          status: 'pending',
          proof_url: proofUrl,
          idempotency_key: `proof_${registrationId}_${Date.now()}`,
        });
    }

    // Update registration status
    await this.supabase
      .from('program_registrations')
      .update({
        registration_status: 'payment_review',
        payment_status: 'under_review',
      })
      .eq('id', registrationId);

    return { success: true };
  }

  /**
   * Approve or reject payment (admin).
   */
  async reviewPayment(
    paymentId: string,
    action: 'approve' | 'reject',
    adminId: string,
    reason?: string
  ): Promise<any> {
    const { data: payment, error: payError } = await this.supabase
      .from('program_registration_payments')
      .select('*, program_registrations(*)')
      .eq('id', paymentId)
      .single();

    if (payError || !payment) throw new Error('Payment not found');
    if (payment.status !== 'pending' && payment.status !== 'under_review') {
      throw new Error(`Payment cannot be reviewed in status: ${payment.status}`);
    }

    const newPaymentStatus = action === 'approve' ? 'paid' : 'rejected';
    const newRegistrationStatus = action === 'approve' ? 'confirmed' : 'payment_rejected';

    // Update payment
    await this.supabase
      .from('program_registration_payments')
      .update({
        status: newPaymentStatus,
        verified_by: adminId,
        verified_at: new Date().toISOString(),
        paid_at: action === 'approve' ? new Date().toISOString() : null,
        provider_payload: {
          ...payment.provider_payload,
          review_action: action,
          review_reason: reason,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        },
      })
      .eq('id', paymentId);

    // Update registration
    await this.supabase
      .from('program_registrations')
      .update({
        registration_status: newRegistrationStatus,
        payment_status: newPaymentStatus,
        confirmed_at: action === 'approve' ? new Date().toISOString() : null,
      })
      .eq('id', payment.program_registration_id);

    // If approved, issue family entitlements
    if (action === 'approve' && payment.program_registrations?.family_count > 0) {
      await this.issueFamilyEntitlements(payment.program_registrations);
    }

    return { success: true, payment_status: newPaymentStatus };
  }

  /**
   * Issue family entitlements after payment approval.
   */
  private async issueFamilyEntitlements(registration: any): Promise<void> {
    const familyCount = registration.family_count;
    if (familyCount <= 0) return;

    for (let i = 1; i <= familyCount; i++) {
      const attendanceCode = `family_attendance_${i}_${generateOpaqueToken()}`;
      const mealCode = `family_meal_${i}_${generateOpaqueToken()}`;

      // Attendance entitlement
      await this.supabase
        .from('program_coupons')
        .insert({
          program_id: registration.program_id,
          program_registration_id: registration.id,
          user_id: registration.user_id,
          nik: registration.nik,
          name: `Keluarga ${i}`,
          coupon_code: attendanceCode,
          gate_type: 'attendance_family',
          status: 'active',
          beneficiary_type: 'family',
          beneficiary_index: i,
          entitlement_code: ENTITLEMENT_CODES.FAMILY_ATTENDANCE,
          entitlement_metadata: {
            config_version: registration.workflow_version,
            issued_at: new Date().toISOString(),
            payment_approved: true,
          },
        });

      // Meal entitlement
      await this.supabase
        .from('program_coupons')
        .insert({
          program_id: registration.program_id,
          program_registration_id: registration.id,
          user_id: registration.user_id,
          nik: registration.nik,
          name: `Keluarga ${i}`,
          coupon_code: mealCode,
          gate_type: 'meal_family',
          status: 'active',
          beneficiary_type: 'family',
          beneficiary_index: i,
          entitlement_code: ENTITLEMENT_CODES.FAMILY_MEAL,
          entitlement_metadata: {
            config_version: registration.workflow_version,
            issued_at: new Date().toISOString(),
            payment_approved: true,
          },
        });
    }
  }

  // ─── Scanner ──────────────────────────────────────────────────────────────

  /**
   * Scan an entitlement with program/gate awareness.
   */
  async scanEntitlement(
    programId: string,
    gate: string,
    scannedCode: string,
    scannerUserId: string
  ): Promise<{
    scan_result: string;
    failure_reason?: string;
    redemption_id?: string;
    entitlement_code?: string;
    beneficiary_type?: string;
  }> {
    // Use the RPC function for atomic scan
    const { data: result, error } = await this.supabase
      .rpc('scan_entitlement_v2', {
        p_program_id: programId,
        p_gate: gate,
        p_scanned_code: scannedCode,
        p_scanner_user_id: scannerUserId,
      });

    if (error) throw error;
    return result;
  }

  /**
   * Manual attendance override with required reason.
   */
  async attendanceOverride(
    programId: string,
    nik: string,
    reason: string,
    adminId: string
  ): Promise<{ success: boolean; registration_id?: string; doorprize_eligible?: boolean }> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Override reason is required');
    }

    const { data: result, error } = await this.supabase
      .rpc('attendance_override', {
        p_program_id: programId,
        p_nik: nik,
        p_reason: reason,
        p_admin_id: adminId,
      });

    if (error) throw error;
    return result;
  }

  // ─── Doorprize ────────────────────────────────────────────────────────────

  /**
   * Get doorprize eligible participants (actual attendance only).
   */
  async getDoorprizeEligible(programId: string): Promise<any[]> {
    const { data: registrations, error } = await this.supabase
      .from('program_registrations')
      .select('id, nik, attendee_name, doorprize_eligible_at')
      .eq('program_id', programId)
      .eq('doorprize_eligible', true)
      .order('doorprize_eligible_at', { ascending: true });

    if (error) throw error;
    return registrations || [];
  }

  // ─── Reporting ────────────────────────────────────────────────────────────

  /**
   * Get unified report aggregate for dashboard/Excel/PDF.
   */
  async getWorkflowReport(programId: string): Promise<any> {
    const { data: report, error } = await this.supabase
      .from('program_workflow_report')
      .select('*')
      .eq('program_id', programId)
      .single();

    if (error) throw error;
    return report;
  }

  /**
   * Get detailed RSVP list with filters.
   */
  async getRSVPList(
    programId: string,
    filters: {
      status?: string;
      payment_status?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('program_registrations')
      .select('*', { count: 'exact' })
      .eq('program_id', programId);

    if (filters.status) {
      query = query.eq('attendance_status', filters.status);
    }
    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Get scan audit log for a program.
   */
  async getScanAudit(
    programId: string,
    filters: {
      gate?: string;
      scan_result?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: any[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 100;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('program_coupon_redemptions')
      .select('*', { count: 'exact' })
      .eq('program_id', programId);

    if (filters.gate) {
      query = query.eq('gate', filters.gate);
    }
    if (filters.scan_result) {
      query = query.eq('scan_result', filters.scan_result);
    }

    const { data, count, error } = await query
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
    };
  }
}
