/**
 * Gemini AI Client — SERVER-SIDE ONLY
 * File ini hanya boleh diimport dari server.ts, bukan dari komponen React/frontend.
 * Frontend tidak memiliki akses ke GEMINI_API_KEY.
 * Di Vite (browser), gunakan import.meta.env.VITE_*
 */

// Guard: Hanya berfungsi di environment Node.js (server)
// Di browser, export null agar tidak crash jika tidak sengaja diimport
let ai: any = null;

if (typeof process !== 'undefined' && process?.env) {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });
  } catch {
    // Silently fail in browser environment
  }
}

export { ai };
