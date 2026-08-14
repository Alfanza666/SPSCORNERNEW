import { useEffect, useState, ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { Upload, Trash2, Eye, EyeOff, Star, StarOff, Image, RefreshCw } from 'lucide-react';
import { appToast } from '../../../components/ui/AppToast';
import SPSLogo from '../../../components/SPSLogo';
import { supabase } from '../../../lib/supabase';

interface MomentsFrame {
  id: string;
  name: string;
  image_url: string;
  source: string;
  is_active: boolean;
  created_at: string;
}

interface MomentsPhoto {
  id: string;
  photo_final: string;
  likes: number;
  is_featured: boolean;
  is_hidden: boolean;
  created_at: string;
  moments_events?: { name: string };
  moments_frames?: { name: string };
}

export default function AdminMoments() {
  const [activeTab, setActiveTab] = useState<'frames' | 'photos'>('frames');
  const [frames, setFrames] = useState<MomentsFrame[]>([]);
  const [photos, setPhotos] = useState<MomentsPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Frame upload form
  const [frameName, setFrameName] = useState('');
  const [frameImage, setFrameImage] = useState<string | null>(null);

  // AI generation
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const [framesRes, photosRes] = await Promise.all([
        fetch('/api/moments/frames/all', { headers }),
        fetch('/api/moments/photos/all', { headers })
      ]);

      const framesData = await framesRes.json();
      const photosData = await photosRes.json();

      if (framesData.success) setFrames(framesData.frames);
      if (photosData.success) setPhotos(photosData.photos);
    } catch (err) {
      console.error('Load error:', err);
    }
    setIsLoading(false);
  };

  // Handle frame image upload
  const handleFrameImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFrameImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload frame
  const handleUploadFrame = async () => {
    if (!frameName || !frameImage) {
      appToast.error('Missing Fields', 'Please provide frame name and image');
      return;
    }

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/moments/frame', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: frameName,
          image_base64: frameImage,
          source: 'admin'
        })
      });

      const data = await res.json();
      if (data.success) {
        appToast.success('Frame Uploaded', 'Frame has been added successfully');
        setFrameName('');
        setFrameImage(null);
        loadData();
      } else {
        appToast.error('Upload Failed', data.error);
      }
    } catch (err) {
      appToast.error('Upload Failed', 'An error occurred');
    }
    setIsUploading(false);
  };

  // Generate frame with AI
  const handleGenerateFrame = async () => {
    if (!aiPrompt) {
      appToast.error('Missing Prompt', 'Please provide a description for the frame');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/moments/frame/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ description: aiPrompt })
      });

      const data = await res.json();
      if (data.success) {
        appToast.success('Prompt Generated', 'AI prompt has been generated. Image generation pending API integration.');
        console.log('Generated prompt:', data.prompt);
      } else {
        appToast.error('Generation Failed', data.error);
      }
    } catch (err) {
      appToast.error('Generation Failed', 'An error occurred');
    }
    setIsGenerating(false);
  };

  // Delete frame
  const handleDeleteFrame = async (id: string) => {
    if (!confirm('Delete this frame?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`/api/moments/frame/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        appToast.success('Frame Deleted', 'Frame has been removed');
        loadData();
      }
    } catch (err) {
      appToast.error('Delete Failed', 'An error occurred');
    }
  };

  // Toggle photo featured
  const handleToggleFeatured = async (id: string, current: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      await fetch(`/api/moments/photo/${id}/featured`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_featured: !current })
      });
      loadData();
    } catch (err) {
      appToast.error('Update Failed', 'An error occurred');
    }
  };

  // Toggle photo hidden
  const handleToggleHidden = async (id: string, current: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      await fetch(`/api/moments/photo/${id}/hide`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_hidden: !current })
      });
      loadData();
    } catch (err) {
      appToast.error('Update Failed', 'An error occurred');
    }
  };

  // Delete photo
  const handleDeletePhoto = async (id: string) => {
    if (!confirm('Delete this photo?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`/api/moments/photo/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        appToast.success('Photo Deleted', 'Photo has been removed');
        loadData();
      }
    } catch (err) {
      appToast.error('Delete Failed', 'An error occurred');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SPSLogo className="w-8 h-8" />
            <h1 className="text-2xl font-bold text-[#0C0A09] font-sans">SPS Corner Moments</h1>
          </div>
          <p className="text-sm text-[#78716C] font-sans">Manage frames and photos for the event</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('frames')}
            className={`px-4 py-2 rounded-xl text-sm font-sans cursor-pointer transition-colors ${
              activeTab === 'frames'
                ? 'bg-[#0C0A09] text-white'
                : 'bg-[#F5F5F4] text-[#78716C] hover:bg-[#E7E5E4]'
            }`}
          >
            Frames ({frames.length})
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-4 py-2 rounded-xl text-sm font-sans cursor-pointer transition-colors ${
              activeTab === 'photos'
                ? 'bg-[#0C0A09] text-white'
                : 'bg-[#F5F5F4] text-[#78716C] hover:bg-[#E7E5E4]'
            }`}
          >
            Photos ({photos.length})
          </button>
          <button
            onClick={loadData}
            className="ml-auto px-3 py-2 rounded-xl bg-[#F5F5F4] text-[#78716C] hover:bg-[#E7E5E4] cursor-pointer transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <div className="w-6 h-6 border-2 border-[#CA8A04] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'frames' ? (
          /* Frames Tab */
          <div className="space-y-6">
            {/* Upload Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E7E5E4]">
              <h2 className="text-lg font-semibold text-[#0C0A09] mb-4 font-sans">Upload Frame</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#78716C] mb-2 font-sans">Frame Name</label>
                  <input
                    type="text"
                    value={frameName}
                    onChange={(e) => setFrameName(e.target.value)}
                    placeholder="e.g., Forward As One"
                    className="w-full px-4 py-3 bg-[#F5F5F4] rounded-xl text-sm text-[#0C0A09] placeholder-[#A8A29E] font-sans focus:outline-none focus:ring-2 focus:ring-[#CA8A04]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#78716C] mb-2 font-sans">Frame Image (PNG transparent)</label>
                  <input
                    type="file"
                    accept="image/png"
                    onChange={handleFrameImageChange}
                    className="w-full px-4 py-3 bg-[#F5F5F4] rounded-xl text-sm text-[#0C0A09] font-sans file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#CA8A04] file:text-[#0C0A09] file:font-semibold file:cursor-pointer"
                  />
                </div>
              </div>
              {frameImage && (
                <div className="mt-4">
                  <img src={frameImage} alt="Preview" className="w-32 h-32 object-contain rounded-xl bg-[#F5F5F4]" />
                </div>
              )}
              <button
                onClick={handleUploadFrame}
                disabled={isUploading || !frameName || !frameImage}
                className="mt-4 px-6 py-3 bg-[#CA8A04] text-[#0C0A09] rounded-xl font-semibold text-sm font-sans cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-[#D4A017]"
              >
                {isUploading ? 'Uploading...' : 'Upload Frame'}
              </button>
            </div>

            {/* AI Generation */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E7E5E4]">
              <h2 className="text-lg font-semibold text-[#0C0A09] mb-4 font-sans">Generate Frame with AI</h2>
              <div>
                <label className="block text-sm text-[#78716C] mb-2 font-sans">Describe the frame you want</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Elegant corporate frame with gold accents and futuristic theme for employee gathering"
                  rows={3}
                  className="w-full px-4 py-3 bg-[#F5F5F4] rounded-xl text-sm text-[#0C0A09] placeholder-[#A8A29E] font-sans resize-none focus:outline-none focus:ring-2 focus:ring-[#CA8A04]"
                />
              </div>
              <button
                onClick={handleGenerateFrame}
                disabled={isGenerating || !aiPrompt}
                className="mt-4 px-6 py-3 bg-[#0C0A09] text-white rounded-xl font-semibold text-sm font-sans cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-[#1C1917]"
              >
                {isGenerating ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>

            {/* Frame List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E7E5E4]">
              <h2 className="text-lg font-semibold text-[#0C0A09] mb-4 font-sans">Existing Frames</h2>
              {frames.length === 0 ? (
                <p className="text-sm text-[#78716C] font-sans">No frames uploaded yet</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {frames.map((frame) => (
                    <div key={frame.id} className="relative group">
                      <div className="aspect-square rounded-xl overflow-hidden bg-[#F5F5F4]">
                        <img src={frame.image_url} alt={frame.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="mt-2 text-xs text-[#78716C] font-sans truncate">{frame.name}</p>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDeleteFrame(frame.id)}
                          className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      {frame.source === 'ai' && (
                        <span className="absolute top-2 left-2 text-[10px] text-[#CA8A04] bg-[#CA8A04]/20 px-2 py-0.5 rounded-full font-sans">
                          AI
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Photos Tab */
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E7E5E4]">
            {photos.length === 0 ? (
              <div className="text-center py-12">
                <Image className="w-12 h-12 mx-auto mb-4 text-[#D6D3D1]" />
                <p className="text-sm text-[#78716C] font-sans">No photos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square rounded-xl overflow-hidden bg-[#F5F5F4]">
                      <img src={photo.photo_final} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-white font-sans">{photo.likes} likes</span>
                          <span className="text-xs text-white/60 font-sans">
                            {new Date(photo.created_at).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleFeatured(photo.id, photo.is_featured)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                              photo.is_featured ? 'bg-[#CA8A04]' : 'bg-white/20'
                            }`}
                          >
                            {photo.is_featured ? (
                              <Star className="w-4 h-4 text-white" />
                            ) : (
                              <StarOff className="w-4 h-4 text-white" />
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleHidden(photo.id, photo.is_hidden)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                              photo.is_hidden ? 'bg-red-500' : 'bg-white/20'
                            }`}
                          >
                            {photo.is_hidden ? (
                              <EyeOff className="w-4 h-4 text-white" />
                            ) : (
                              <Eye className="w-4 h-4 text-white" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {photo.is_featured && (
                      <span className="absolute top-2 left-2 text-[10px] text-[#CA8A04] bg-[#CA8A04]/20 px-2 py-0.5 rounded-full font-sans">
                        Featured
                      </span>
                    )}
                    {photo.is_hidden && (
                      <span className="absolute top-2 right-2 text-[10px] text-red-500 bg-red-500/20 px-2 py-0.5 rounded-full font-sans">
                        Hidden
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
