// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerMomentsRoutes(app, { supabase, sendNotification, groq }) {
  // Auth helper
  async function requireUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(" ")[1];
    if (!token) return null;
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return null;
      return user.id;
    } catch {
      return null;
    }
  }

  async function requireAdmin(req) {
    const userId = await requireUser(req);
    if (!userId) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (!profile || !["admin", "superadmin"].includes(profile.role)) return null;
    return userId;
  }

  // ─────────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────────

  // Get active event (public)
  app.get("/api/moments/event", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("moments_events")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      res.json({ success: true, event: data });
    } catch (error) {
      console.error("[Moments] Get event error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get all events (admin)
  app.get("/api/moments/events", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { data, error } = await supabase
        .from("moments_events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ success: true, events: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Create event (admin)
  app.post("/api/moments/event", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { name, subtitle } = req.body;
      if (!name) return res.status(400).json({ success: false, error: "Name required" });
      const { data, error } = await supabase
        .from("moments_events")
        .insert({ name, subtitle })
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, event: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Update event (admin)
  app.put("/api/moments/event/:id", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { id } = req.params;
      const { name, subtitle, is_active } = req.body;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (subtitle !== undefined) updateData.subtitle = subtitle;
      if (is_active !== undefined) updateData.is_active = is_active;
      const { data, error } = await supabase
        .from("moments_events")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, event: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // FRAMES
  // ─────────────────────────────────────────────────────────────────────

  // Get frames for active event (public)
  app.get("/api/moments/frames", async (req, res) => {
    try {
      const { data: event } = await supabase
        .from("moments_events")
        .select("id")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (!event) return res.json({ success: true, frames: [] });
      const { data, error } = await supabase
        .from("moments_frames")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      res.json({ success: true, frames: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get all frames (admin)
  app.get("/api/moments/frames/all", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { data, error } = await supabase
        .from("moments_frames")
        .select("*, moments_events(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ success: true, frames: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Upload frame (admin)
  app.post("/api/moments/frame", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { name, image_base64, event_id, source, prompt_used } = req.body;
      if (!name || !image_base64) {
        return res.status(400).json({ success: false, error: "Name and image required" });
      }

      // Get active event if not specified
      let targetEventId = event_id;
      if (!targetEventId) {
        const { data: event } = await supabase
          .from("moments_events")
          .select("id")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        targetEventId = event?.id;
      }

      // Upload image to storage
      const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `frames/${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
      const { error: uploadError } = await supabase.storage
        .from("moments")
        .upload(fileName, buffer, { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("moments").getPublicUrl(fileName);

      // Insert frame record
      const { data, error } = await supabase
        .from("moments_frames")
        .insert({
          event_id: targetEventId,
          name,
          image_url: publicUrl,
          source: source || "admin",
          prompt_used: prompt_used || null
        })
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, frame: data });
    } catch (error) {
      console.error("[Moments] Upload frame error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Delete frame (admin)
  app.delete("/api/moments/frame/:id", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { id } = req.params;
      const { error } = await supabase
        .from("moments_frames")
        .delete()
        .eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Generate frame with AI (admin)
  app.post("/api/moments/frame/generate", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { description, event_id } = req.body;
      if (!description) return res.status(400).json({ success: false, error: "Description required" });

      // Generate detailed prompt with Groq
      const promptResponse = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a professional frame designer for corporate events. Generate a detailed image generation prompt for creating a transparent PNG frame overlay. The frame should be elegant, modern, and suitable for corporate events. Requirements:
- Frame should be transparent in the center (for photos)
- Frame border should be decorative but not too thick
- Minimum 75% of area should be transparent
- Style: Premium, Corporate, Modern
- Colors: Navy, Gold, White
- Output ONLY the prompt, nothing else`
          },
          {
            role: "user",
            content: description
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      const generatedPrompt = promptResponse.choices?.[0]?.message?.content;
      if (!generatedPrompt) throw new Error("Failed to generate prompt");

      // TODO: Call image generation API here (Gemini/DALL-E/etc)
      // For now, return the prompt for manual generation
      res.json({
        success: true,
        prompt: generatedPrompt,
        message: "Prompt generated. Image generation API integration pending."
      });
    } catch (error) {
      console.error("[Moments] Generate frame error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // PHOTOS
  // ─────────────────────────────────────────────────────────────────────

  // Save photo (public - no auth required)
  app.post("/api/moments/photo", async (req, res) => {
    try {
      const { event_id, frame_id, photo_raw_base64, photo_final_base64, device_info } = req.body;
      if (!photo_raw_base64 || !photo_final_base64) {
        return res.status(400).json({ success: false, error: "Photos required" });
      }

      // Get active event if not specified
      let targetEventId = event_id;
      if (!targetEventId) {
        const { data: event } = await supabase
          .from("moments_events")
          .select("id")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        targetEventId = event?.id;
      }

      // Upload raw photo
      const rawBase64 = photo_raw_base64.replace(/^data:image\/\w+;base64,/, "");
      const rawBuffer = Buffer.from(rawBase64, "base64");
      const rawFileName = `photos/raw_${Date.now()}.jpg`;
      await supabase.storage.from("moments").upload(rawFileName, rawBuffer, { contentType: "image/jpeg" });
      const { data: { publicUrl: rawUrl } } = supabase.storage.from("moments").getPublicUrl(rawFileName);

      // Upload final photo (with frame + watermark)
      const finalBase64 = photo_final_base64.replace(/^data:image\/\w+;base64,/, "");
      const finalBuffer = Buffer.from(finalBase64, "base64");
      const finalFileName = `photos/final_${Date.now()}.jpg`;
      await supabase.storage.from("moments").upload(finalFileName, finalBuffer, { contentType: "image/jpeg" });
      const { data: { publicUrl: finalUrl } } = supabase.storage.from("moments").getPublicUrl(finalFileName);

      // Get user_id if authenticated (optional)
      const userId = await requireUser(req);

      // Insert photo record
      const { data, error } = await supabase
        .from("moments_photos")
        .insert({
          event_id: targetEventId,
          frame_id: frame_id || null,
          user_id: userId || null,
          photo_raw: rawUrl,
          photo_final: finalUrl,
          device_info: device_info || {}
        })
        .select()
        .single();
      if (error) throw error;

      res.json({ success: true, photo: data });
    } catch (error) {
      console.error("[Moments] Save photo error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get photos for gallery (authenticated)
  app.get("/api/moments/photos", async (req, res) => {
    try {
      const userId = await requireUser(req);
      if (!userId) return res.status(401).json({ success: false, error: "Login required" });

      const { event_id, limit = 50, offset = 0, featured } = req.query;
      let query = supabase
        .from("moments_photos")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (event_id) query = query.eq("event_id", event_id);
      if (featured === "true") query = query.eq("is_featured", true);

      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, photos: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get all photos for admin
  app.get("/api/moments/photos/all", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });

      const { event_id, limit = 100, offset = 0 } = req.query;
      let query = supabase
        .from("moments_photos")
        .select("*, moments_events(name), moments_frames(name)")
        .order("created_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (event_id) query = query.eq("event_id", event_id);

      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, photos: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Like photo (public)
  app.post("/api/moments/photo/:id/like", async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase.rpc("increment_moments_photo_likes", { photo_id: id });
      if (error) {
        // Fallback: manual increment
        const { data: photo } = await supabase
          .from("moments_photos")
          .select("likes")
          .eq("id", id)
          .single();
        if (!photo) return res.status(404).json({ success: false, error: "Photo not found" });
        await supabase
          .from("moments_photos")
          .update({ likes: (photo.likes || 0) + 1 })
          .eq("id", id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: Toggle featured
  app.put("/api/moments/photo/:id/featured", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { id } = req.params;
      const { is_featured } = req.body;
      const { data, error } = await supabase
        .from("moments_photos")
        .update({ is_featured })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, photo: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: Hide photo
  app.put("/api/moments/photo/:id/hide", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { id } = req.params;
      const { is_hidden } = req.body;
      const { data, error } = await supabase
        .from("moments_photos")
        .update({ is_hidden })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, photo: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: Delete photo
  app.delete("/api/moments/photo/:id", async (req, res) => {
    try {
      const adminId = await requireAdmin(req);
      if (!adminId) return res.status(403).json({ success: false, error: "Admin only" });
      const { id } = req.params;
      const { error } = await supabase
        .from("moments_photos")
        .delete()
        .eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Realtime subscription for live gallery
  app.get("/api/moments/photos/stream", async (req, res) => {
    try {
      const userId = await requireUser(req);
      if (!userId) return res.status(401).json({ success: false, error: "Login required" });

      const { event_id } = req.query;
      let query = supabase
        .from("moments_photos")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(1);

      if (event_id) query = query.eq("event_id", event_id);

      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, photos: data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
