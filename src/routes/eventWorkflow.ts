// @ts-nocheck
/**
 * Event Workflow V3 — Admin and Portal Routes
 * 
 * V2 endpoints for Employee Gathering workflow:
 *   - Admin: eligibility preview, publish, scan, doorprize, reports
 *   - Portal: registration status, entitlements
 */

import { EventWorkflowService } from "../services/eventWorkflow.js";
import { createProgramWorkflowConfig } from "../utils/programWorkflowConfig.js";

export function registerEventWorkflowRoutes(app: any, { supabase, sendNotification }: any) {
  const workflowService = new EventWorkflowService(supabase);

  // ─── Helper: Auth + Admin check ──────────────────────────────────────────

  async function requireAdmin(req: any, res: any): Promise<{ userId: string; profile: any } | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    const { data: profile } = await supabase.from("profiles").select("role, id").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
      res.status(403).json({ error: "Forbidden: Admin only" });
      return null;
    }
    return { userId: user.id, profile };
  }

  async function requireAuth(req: any, res: any): Promise<{ userId: string } | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return { userId: user.id };
  }

  async function buildProgramWorkflowDraft(programId: string, formId: string, actorId: string) {
    const { data: program, error: programError } = await supabase
      .from('union_programs')
      .select('id, program_type, dynamic_form_id, family_package_price, shirt_price_map')
      .eq('id', programId)
      .single();
    if (programError || !program) throw Object.assign(new Error('Program not found'), { status: 404 });

    const { data: form, error: formError } = await supabase
      .from('dynamic_forms')
      .select('id, title, description, fields, is_active')
      .eq('id', formId)
      .single();
    if (formError || !form) throw Object.assign(new Error('Form not found'), { status: 404 });
    if (!form.is_active) {
      throw Object.assign(new Error('Publish the form before synchronizing it to a program'), { status: 409 });
    }

    let metadata: any = {};
    try { metadata = JSON.parse(form.description || '{}'); } catch { metadata = { text: form.description || '' }; }
    const synchronizedFields = (form.fields || []).map((field: any) => {
      if (program.program_type === 'gathering' && (field.system_key === 'family_count' || field.id === 'family_count')) {
        return field.unit_price === undefined
          ? { ...field, unit_price: Math.max(0, Number(program.family_package_price || 0)) }
          : field;
      }
      if (program.program_type === 'gathering' && (field.system_key === 'shirt_size' || field.id === 'shirt_size')) {
        return {
          ...field,
          options: (field.options || []).map((option: any) => ({
            ...option,
            price: option.price === undefined
              ? Math.max(0, Number(program.shirt_price_map?.[String(option.value).toUpperCase()] || 0))
              : option.price,
          })),
        };
      }
      return field;
    });

    const formConfig = {
      id: form.id,
      title: form.title,
      description: metadata.text ?? form.description ?? '',
      fields: synchronizedFields,
      experience_version: metadata.experience_version === 2 ? 2 : 1,
      outcomes: metadata.outcomes || [],
      program_automation: metadata.program_automation || undefined,
      welcome_screen: metadata.welcome_screen || undefined,
    };
    const workflowConfig = createProgramWorkflowConfig(formConfig as any, programId, formId, actorId);
    if (!workflowConfig) {
      throw Object.assign(new Error('Form must contain a valid attendance field binding'), { status: 422 });
    }
    return { program, workflowConfig, synchronizedFields };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/admin/programs/:programId/link-form-v2", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const formId = req.body?.form_id || null;
      let workflowConfig: any = {};
      let synchronizedFields: any[] = [];

      if (formId) {
        ({ workflowConfig, synchronizedFields } = await buildProgramWorkflowDraft(programId, formId, admin.userId));
      }

      const { data, error } = await supabase.rpc('link_program_form_v2', {
        p_program_id: programId,
        p_form_id: formId,
        p_config: workflowConfig,
        p_form_fields: synchronizedFields,
        p_actor_id: admin.userId,
      });
      if (error) throw error;
      return res.json(data);
    } catch (error: any) {
      console.error('Link program form error:', error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  /**
   * PATCH /api/admin/programs/:programId/rsvp-deadline
   * Update the live deadline without mutating versioned workflow/eligibility.
   */
  app.patch('/api/admin/programs/:programId/rsvp-deadline', async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const deadline = req.body?.deadline;
      const expectedDeadline = req.body?.expectedDeadline ?? req.body?.expected_deadline ?? null;
      const reason = String(req.body?.reason || '').trim();
      const parsedDeadline = new Date(deadline);
      if (!deadline || Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ error: 'Deadline RSVP tidak valid.' });
      }
      if (reason.length < 3 || reason.length > 500) {
        return res.status(400).json({ error: 'Alasan perubahan deadline wajib diisi (3-500 karakter).' });
      }

      const { data, error } = await supabase.rpc('update_program_rsvp_deadline', {
        p_program_id: programId,
        p_new_deadline: parsedDeadline.toISOString(),
        p_expected_deadline: expectedDeadline || null,
        p_reason: reason,
        p_actor_id: admin.userId,
      });
      if (error) {
        const concurrent = error.code === '40001' || String(error.message || '').includes('another administrator');
        return res.status(concurrent ? 409 : 422).json({ error: error.message });
      }
      return res.json(data);
    } catch (error: any) {
      console.error('RSVP deadline update error:', error);
      return res.status(500).json({ error: error.message || 'Deadline RSVP belum dapat diperbarui.' });
    }
  });

  /**
   * POST /api/admin/programs/:programId/workflow/reconcile
   * Snapshot current linked-form rules for future submissions. Historical
   * registrations stay pinned to their original workflow_config_id.
   */
  app.post('/api/admin/programs/:programId/workflow/reconcile', async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 5 || reason.length > 500) {
        return res.status(400).json({ error: 'Alasan sinkronisasi workflow wajib diisi (5-500 karakter).' });
      }
      const { data: program, error: programError } = await supabase
        .from('union_programs')
        .select('dynamic_form_id')
        .eq('id', programId)
        .single();
      if (programError || !program?.dynamic_form_id) {
        return res.status(404).json({ error: 'Program atau formulir terkait tidak ditemukan.' });
      }

      const { workflowConfig } = await buildProgramWorkflowDraft(
        programId,
        program.dynamic_form_id,
        admin.userId,
      );
      const { data, error } = await supabase.rpc('reconcile_program_workflow_v2', {
        p_program_id: programId,
        p_config: workflowConfig,
        p_reason: reason,
        p_actor_id: admin.userId,
      });
      if (error) return res.status(422).json({ error: error.message });
      return res.json(data);
    } catch (error: any) {
      console.error('Workflow reconciliation error:', error);
      return res.status(error.status || 500).json({ error: error.message || 'Workflow belum dapat disinkronkan.' });
    }
  });

  /**
   * POST /api/admin/programs/:programId/eligibility/preview
   * Preview recipients without writing a snapshot.
   */
  app.post("/api/admin/programs/:programId/eligibility/preview", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const filters = req.body || {};

      const result = await workflowService.previewEligibility(programId, filters);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Eligibility preview error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/admin/programs/:programId/publish-v2
   * Validate and atomically publish form/config/snapshot.
   */
  app.post("/api/admin/programs/:programId/publish-v2", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const { form_config_id } = req.body;

      const result = await workflowService.publishGathering(programId, admin.userId, form_config_id);
      res.json(result);
    } catch (error: any) {
      console.error("Publish gathering error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/admin/programs/:programId/eligibility/reconcile
   * Audited post-publication correction of eligibility snapshot.
   */
  app.post("/api/admin/programs/:programId/eligibility/reconcile", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const { reason, changes } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: "reason is required for reconciliation" });
      }

      if (!changes || !Array.isArray(changes)) {
        return res.status(400).json({ error: "changes array is required" });
      }

      // Get current program
      const { data: program, error: progError } = await supabase
        .from('union_programs')
        .select('eligibility_snapshot, config_version')
        .eq('id', programId)
        .single();

      if (progError || !program) {
        return res.status(404).json({ error: "Program not found" });
      }

      // Apply changes to snapshot
      const currentRecipients = program.eligibility_snapshot?.recipients || [];
      let updatedRecipients = [...currentRecipients];

      for (const change of changes) {
        if (change.action === 'add' && change.nik) {
          // Add new recipient
          if (!updatedRecipients.find((r: any) => r.nik === change.nik)) {
            updatedRecipients.push({
              nik: change.nik,
              name: change.name || '',
              department: change.department || '',
              join_date: change.join_date || null,
              user_id: change.user_id || null,
              reconciled_at: new Date().toISOString(),
              reconciled_by: admin.userId,
            });
          }
        } else if (change.action === 'remove' && change.nik) {
          // Remove recipient
          updatedRecipients = updatedRecipients.filter((r: any) => r.nik !== change.nik);
        }
      }

      // Update snapshot with audit trail
      const updatedSnapshot = {
        ...program.eligibility_snapshot,
        recipients: updatedRecipients,
        last_reconciliation: {
          at: new Date().toISOString(),
          by: admin.userId,
          reason,
          changes_count: changes.length,
        },
      };

      const { error: updateError } = await supabase
        .from('union_programs')
        .update({ eligibility_snapshot: updatedSnapshot })
        .eq('id', programId);

      if (updateError) throw updateError;

      // Create audit record in program_coupon_redemptions
      await supabase
        .from('program_coupon_redemptions')
        .insert({
          program_id: programId,
          scanned_code: 'RECONCILE',
          gate: 'admin',
          scan_result: 'success',
          failure_reason: `Eligibility reconciliation: ${reason}`,
          scanner_user_id: admin.userId,
          scanned_at: new Date().toISOString(),
          metadata: {
            reconciliation: true,
            reason,
            changes,
            previous_count: currentRecipients.length,
            new_count: updatedRecipients.length,
          },
        });

      res.json({
        success: true,
        previous_count: currentRecipients.length,
        new_count: updatedRecipients.length,
        reason,
      });
    } catch (error: any) {
      console.error("Eligibility reconcile error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/admin/program-entitlements/scan
   * Gate/program-aware scan with append-only audit.
   */
  app.post("/api/admin/program-entitlements/scan", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId, gate, scanned_code } = req.body;

      if (!programId || !gate || !scanned_code) {
        return res.status(400).json({ error: "programId, gate, and scanned_code are required" });
      }

      const result = await workflowService.scanEntitlement(programId, gate, scanned_code, admin.userId);

      // Send notification on success
      if (result.scan_result === 'success' && result.beneficiary_type === 'employee') {
        // Optionally notify admin of successful scan
      }

      res.json(result);
    } catch (error: any) {
      console.error("Scan entitlement error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/admin/programs/:programId/attendance-override
   * Manual attendance override with required reason.
   */
  app.post("/api/admin/programs/:programId/attendance-override", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const { nik, reason } = req.body;

      if (!nik || !reason) {
        return res.status(400).json({ error: "nik and reason are required" });
      }

      const result = await workflowService.attendanceOverride(programId, nik, reason, admin.userId);
      res.json(result);
    } catch (error: any) {
      console.error("Attendance override error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/admin/programs/:programId/doorprize-eligible
   * Get doorprize eligible participants (actual attendance only).
   */
  app.get("/api/admin/programs/:programId/doorprize-eligible", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const participants = await workflowService.getDoorprizeEligible(programId);
      res.json({ success: true, participants });
    } catch (error: any) {
      console.error("Doorprize eligible error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/admin/programs/:programId/workflow-report
   * Get unified report aggregate for dashboard.
   */
  app.get("/api/admin/programs/:programId/workflow-report", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const report = await workflowService.getWorkflowReport(programId);
      res.json({ success: true, report });
    } catch (error: any) {
      console.error("Workflow report error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/admin/programs/:programId/workflow-report.xlsx
   * Export report as Excel workbook.
   */
  app.get("/api/admin/programs/:programId/workflow-report.xlsx", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;

      // Get report data
      const report = await workflowService.getWorkflowReport(programId);
      const rsvpData = await workflowService.getRSVPList(programId, { limit: 1000 });
      const scanData = await workflowService.getScanAudit(programId, { limit: 1000 });

      // Dynamic import for xlsx (only on server)
      const XLSX = await import('xlsx');

      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['Program', report.program_name],
        ['Type', report.program_type],
        ['Config Version', report.config_version],
        ['RSVP Deadline', report.rsvp_deadline],
        ['Published At', report.published_at],
        [],
        ['Attending', report.attending_count],
        ['Declined', report.declined_count],
        ['Unanswered', report.unanswered_count],
        ['Total Registrations', report.total_registrations],
        [],
        ['Shirt Count', report.shirt_count],
        ['Camping Count', report.camping_count],
        ['Total Family Members', report.total_family_members],
        [],
        ['Paid', report.paid_count],
        ['Pending Payment', report.pending_payment_count],
        ['Failed Payment', report.failed_payment_count],
        ['Total Billed', report.total_billed],
        ['Total Paid', report.total_paid],
        [],
        ['Doorprize Eligible', report.doorprize_eligible_count],
        ['Scan Success', report.scan_success_count],
        ['Scan Duplicate', report.scan_duplicate_count],
        ['Scan Rejected', report.scan_rejected_count],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // RSVP sheet
      const rsvpDataRows = rsvpData.data.map((r: any) => ({
        NIK: r.nik,
        Name: r.attendee_name,
        Status: r.attendance_status,
        'Registration Status': r.registration_status,
        'Shirt Size': r.shirt_size,
        Camping: r.is_camping ? 'Yes' : 'No',
        'Family Count': r.family_count,
        'Total Amount': r.total_amount,
        'Payment Status': r.payment_status,
        'Submitted At': r.submitted_at,
      }));
      const rsvpSheet = XLSX.utils.json_to_sheet(rsvpDataRows);
      XLSX.utils.book_append_sheet(wb, rsvpSheet, 'RSVP');

      // Scans sheet
      const scanDataRows = scanData.data.map((s: any) => ({
        'Scanned Code': s.scanned_code,
        Gate: s.gate,
        Result: s.scan_result,
        Reason: s.failure_reason,
        'Scanned At': s.scanned_at,
        Scanner: s.scanner_user_id,
      }));
      const scanSheet = XLSX.utils.json_to_sheet(scanDataRows);
      XLSX.utils.book_append_sheet(wb, scanSheet, 'Scans');

      // Generate buffer
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report-${programId.slice(0, 8)}.xlsx"`);
      res.send(buf);
    } catch (error: any) {
      console.error("Excel export error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/admin/programs/:programId/workflow-report.pdf
   * Export report as branded PDF.
   */
  app.get("/api/admin/programs/:programId/workflow-report.pdf", async (req: any, res: any) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const { programId } = req.params;
      const report = await workflowService.getWorkflowReport(programId);

      // Dynamic import for pdfkit (only on server)
      let PDFDocument: any;
      try {
        PDFDocument = (await import('pdfkit')).default;
      } catch {
        return res.status(501).json({ error: "PDF export not available" });
      }
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${programId.slice(0, 8)}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(20).text('SPS Corner', { align: 'center' });
      doc.fontSize(14).text('Employee Gathering Report', { align: 'center' });
      doc.moveDown();

      // Program Info
      doc.fontSize(12).text(`Program: ${report.program_name}`);
      doc.text(`Type: ${report.program_type}`);
      doc.text(`Config Version: ${report.config_version}`);
      doc.text(`RSVP Deadline: ${report.rsvp_deadline || 'N/A'}`);
      doc.text(`Published: ${report.published_at || 'N/A'}`);
      doc.moveDown();

      // Summary
      doc.fontSize(14).text('Summary', { underline: true });
      doc.fontSize(11);
      doc.text(`Attending: ${report.attending_count}`);
      doc.text(`Declined: ${report.declined_count}`);
      doc.text(`Unanswered: ${report.unanswered_count}`);
      doc.text(`Total Registrations: ${report.total_registrations}`);
      doc.moveDown();

      doc.text(`Total Family Members: ${report.total_family_members}`);
      doc.text(`Total Billed: Rp ${Number(report.total_billed).toLocaleString('id-ID')}`);
      doc.text(`Total Paid: Rp ${Number(report.total_paid).toLocaleString('id-ID')}`);
      doc.moveDown();

      doc.text(`Doorprize Eligible: ${report.doorprize_eligible_count}`);
      doc.text(`Scan Success: ${report.scan_success_count}`);
      doc.moveDown();

      // Footer
      doc.fontSize(9).text(`Generated at: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });

      doc.end();
    } catch (error: any) {
      console.error("PDF export error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTAL ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/portal/programs/:programId/workflow-v2
   * Get sanitized program/config/eligibility/deadline/status for employee.
   */
  app.get("/api/portal/programs/:programId/workflow-v2", async (req: any, res: any) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;

      const { programId } = req.params;

      // Get program with V3 fields
      const { data: program, error: progError } = await supabase
        .from('union_programs')
        .select('id, name, program_type, rsvp_deadline, registration_enabled, benefit_enabled, family_package_price, shirt_price_map, camping_enabled, doorprize_enabled, payment_methods, payment_accounts, qris_image_url, config_version, published_at, eligibility_source_filter')
        .eq('id', programId)
        .single();

      if (progError || !program) {
        return res.status(404).json({ error: "Program not found" });
      }

      // Get active form config
      const { data: formConfig } = await supabase
        .from('program_workflow_configs')
        .select('id, dynamic_form_id, field_bindings, pricing_rules, entitlement_rules')
        .eq('program_id', programId)
        .eq('is_active', true)
        .single();

      // Get employee's NIK
      const { data: profile } = await supabase
        .from('profiles')
        .select('nik')
        .eq('id', auth.userId)
        .single();

      // Check eligibility
      let isEligible = false;
      if (profile?.nik && program.eligibility_source_filter) {
        const { data: eligibility } = await supabase
          .from('program_eligibility')
          .select('id')
          .eq('program_id', programId)
          .eq('nik', profile.nik)
          .eq('config_version', program.config_version)
          .limit(1);

        isEligible = eligibility && eligibility.length > 0;
      }

      // Get registration status
      const { data: registration } = await supabase
        .from('program_registrations')
        .select('registration_status, attendance_status, payment_status, total_amount')
        .eq('program_id', programId)
        .eq('nik', profile?.nik)
        .single();

      res.json({
        success: true,
        program,
        form_config: formConfig,
        is_eligible: isEligible,
        registration_status: registration?.registration_status || 'not_started',
        attendance_status: registration?.attendance_status || 'unknown',
        payment_status: registration?.payment_status || 'not_required',
        total_amount: registration?.total_amount || 0,
      });
    } catch (error: any) {
      console.error("Portal workflow-v2 error:", error);
      res.status(500).json({ error: error.message });
    }
  });

}
