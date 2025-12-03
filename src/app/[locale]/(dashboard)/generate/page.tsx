'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Upload,
  Sparkles,
  X,
  Download,
  RefreshCw,
  ImageIcon,
  Coins,
  AlertCircle,
  Check
} from 'lucide-react';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type OutputFormat = 'png' | 'jpeg' | 'webp';
type Resolution = '1K' | '2K' | '4K';
type AspectRatio = '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';

interface GenerationResult {
  imageUrl: string;
  generationTime: number;
}

// Aspect ratio configurations with visual dimensions
const ASPECT_RATIOS: { value: AspectRatio; label: string; width: number; height: number }[] = [
  { value: '21:9', label: '21:9', width: 42, height: 18 },
  { value: '16:9', label: '16:9', width: 40, height: 22.5 },
  { value: '3:2', label: '3:2', width: 36, height: 24 },
  { value: '4:3', label: '4:3', width: 36, height: 27 },
  { value: '5:4', label: '5:4', width: 35, height: 28 },
  { value: '1:1', label: '1:1', width: 32, height: 32 },
  { value: '4:5', label: '4:5', width: 28, height: 35 },
  { value: '3:4', label: '3:4', width: 27, height: 36 },
  { value: '2:3', label: '2:3', width: 24, height: 36 },
  { value: '9:16', label: '9:16', width: 22.5, height: 40 },
];

const RESOLUTIONS: { value: Resolution; label: string; description: string }[] = [
  { value: '1K', label: '1K', description: '~1024px' },
  { value: '2K', label: '2K', description: '~2048px' },
  { value: '4K', label: '4K', description: '~4096px' },
];

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

export default function GeneratePage() {
  const t = useTranslations();
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: userData, loading: userDataLoading, refetch: refetchUserData } = useUserData(authUser?.id);
  const supabase = createClient();

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options state
  const [userPrompt, setUserPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timer for generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setGenerationTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10 MB

    if (!validTypes.includes(file.type)) {
      setError(t('generate.errors.uploadFailed'));
      return false;
    }

    if (file.size > maxSize) {
      setError(t('generate.errors.uploadFailed'));
      return false;
    }

    return true;
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      setUploadedFile(file);
      setUploadedPreview(URL.createObjectURL(file));
      setGenerationResult(null);
    }
  }, [t]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setUploadedFile(file);
      setUploadedPreview(URL.createObjectURL(file));
      setGenerationResult(null);
    }
  }, [t]);

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadedPreview(null);
    setGenerationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile || !authUser) return;

    // Check credits
    if (!userData || userData.credits < 1) {
      setError(t('generate.errors.noCredits'));
      return;
    }

    setIsGenerating(true);
    setGenerationTime(0);
    setError(null);
    setGenerationResult(null);

    try {
      // 1. Upload image to Supabase Storage
      const fileName = `${authUser.id}/${Date.now()}_${uploadedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, uploadedFile);

      if (uploadError) {
        throw new Error(t('generate.errors.uploadFailed'));
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

      // 2. Call generate-image edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            uploadedImageUrl: publicUrlData.publicUrl,
            userPrompt,
            output_format: outputFormat,
            resolution,
            aspect_ratio: aspectRatio,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402) {
          throw new Error(t('generate.errors.noCredits'));
        }
        throw new Error(errorData.error || t('generate.errors.generationFailed'));
      }

      const result = await response.json();
      setGenerationResult({
        imageUrl: result.imageUrl,
        generationTime: result.generationTime,
      });

      // Refresh user data to update credits
      await refetchUserData();

    } catch (err) {
      setError(err instanceof Error ? err.message : t('generate.errors.generationFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generationResult) return;

    try {
      const response = await fetch(generationResult.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draw-to-media-${Date.now()}.${outputFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed');
    }
  };

  const handleNewGeneration = () => {
    setUploadedFile(null);
    setUploadedPreview(null);
    setGenerationResult(null);
    setUserPrompt('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isLoading = authLoading || userDataLoading;
  const credits = userData?.credits ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-sketch-dark border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="card text-center max-w-md">
            <Sparkles className="w-16 h-16 text-sketch-medium mx-auto mb-4" />
            <h1 className="font-display text-2xl text-sketch-dark mb-2">
              {t('auth.login.title')}
            </h1>
            <p className="text-sketch-medium mb-6">
              Bitte melde dich an, um Bilder zu generieren.
            </p>
            <Link href="/login" className="btn-primary inline-block">
              {t('navigation.login')}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-8">
            {t('generate.title')}
          </h1>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-sketch flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 font-medium">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Generation Result */}
              {generationResult ? (
                <div className="card transform rotate-1">
                  <h2 className="font-display text-2xl text-sketch-dark mb-6">
                    {t('generate.result.title')}
                  </h2>

                  <div className="relative aspect-square w-full max-w-2xl mx-auto rounded-sketch-lg overflow-hidden bg-cream-100 border-2 border-sketch-dark shadow-sm p-2">
                    <Image
                      src={generationResult.imageUrl}
                      alt="Generated image"
                      fill
                      className="object-contain rounded-sketch"
                    />
                  </div>

              <div className="mt-6 text-center text-sketch-medium">
                <p>{t('generate.generationTime', { seconds: generationResult.generationTime })}</p>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleDownload}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  {t('generate.result.download')}
                </button>
                <button
                  onClick={handleNewGeneration}
                  className="btn-secondary flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {t('generate.result.newGeneration')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upload Area */}
              <div className="card">
                <h2 className="font-display text-xl text-sketch-dark mb-4">
                  {t('generate.upload.title')}
                </h2>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />

                    {uploadedPreview ? (
                      <div className="relative">
                        <div className="relative aspect-video w-full rounded-sketch-lg overflow-hidden bg-cream-100 border-2 border-sketch-dark p-2">
                          <Image
                            src={uploadedPreview}
                            alt="Uploaded preview"
                            fill
                            className="object-contain rounded-sketch"
                          />
                        </div>
                        <button
                          onClick={handleRemoveFile}
                          className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md border-2 border-sketch-dark hover:bg-cream-50 transition-colors"
                          aria-label="Remove image"
                        >
                          <X className="w-5 h-5 text-sketch-dark" />
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-4 text-sm font-bold text-sketch-medium hover:text-sketch-dark underline decoration-wavy"
                        >
                          {t('generate.upload.change')}
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="file-upload"
                        className={`
                          block border-2 border-dashed rounded-sketch-lg p-8 sm:p-12 text-center cursor-pointer transition-all
                          ${isDragging
                            ? 'border-sketch-dark bg-cream-100 transform scale-[1.02]'
                            : 'border-sketch-light/50 hover:border-sketch-dark/50 hover:bg-cream-50 hover:rotate-1'
                          }
                        `}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleFileDrop}
                  >
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-sketch-dark' : 'text-sketch-light'}`} />
                    <p className="text-lg text-sketch-dark font-medium mb-2">
                      {t('generate.upload.dropzone')}
                    </p>
                    <p className="text-sm text-sketch-light">
                      {t('generate.upload.formats')}
                    </p>
                  </label>
                )}
              </div>

              {/* Options */}
              <div className="card">
                <h2 className="font-display text-xl text-sketch-dark mb-6">
                  {t('generate.options.title')}
                </h2>

                <div className="space-y-8">
                  {/* User Prompt */}
                  <div>
                    <label
                      htmlFor="prompt"
                      className="block text-sm font-medium text-sketch-dark mb-2"
                    >
                      {t('generate.options.prompt.label')}
                    </label>
                    <textarea
                      id="prompt"
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value.slice(0, 500))}
                      placeholder={t('generate.options.prompt.placeholder')}
                      className="input-field min-h-[100px] resize-none"
                      maxLength={500}
                    />
                    <p className="text-xs text-sketch-light mt-1 text-right">
                      {userPrompt.length}/500
                    </p>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="block text-sm font-medium text-sketch-dark mb-3">
                      {t('generate.options.aspectRatio.label')}
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio.value}
                          type="button"
                          onClick={() => setAspectRatio(ratio.value)}
                          className={cn(
                            'relative flex flex-col items-center justify-center p-2 rounded-sketch border-2 transition-all',
                            aspectRatio === ratio.value
                              ? 'border-sketch-dark bg-cream-100 transform -rotate-2'
                              : 'border-sketch-light/30 bg-white/50 hover:border-sketch-dark/50 hover:rotate-1'
                          )}
                        >
                          {/* Visual ratio representation */}
                          <div
                            className={cn(
                              'border-2 rounded-sm mb-1.5 transition-colors',
                              aspectRatio === ratio.value
                                ? 'border-sketch-dark bg-sketch-dark/10'
                                : 'border-sketch-light bg-sketch-light/10'
                            )}
                            style={{
                              width: `${ratio.width}px`,
                              height: `${ratio.height}px`,
                              maxWidth: '100%',
                              maxHeight: '40px',
                              borderRadius: '3px 200px 3px 200px / 200px 3px 200px 3px'
                            }}
                          />
                          <span className={cn(
                            'text-xs font-bold',
                            aspectRatio === ratio.value ? 'text-sketch-dark' : 'text-sketch-medium'
                          )}>
                            {ratio.label}
                          </span>
                          {aspectRatio === ratio.value && (
                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-sketch-dark rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resolution */}
                  <div>
                    <label className="block text-sm font-medium text-sketch-dark mb-3">
                      {t('generate.options.resolution.label')}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {RESOLUTIONS.map((res) => (
                        <button
                          key={res.value}
                          type="button"
                          onClick={() => setResolution(res.value)}
                          className={cn(
                            'relative p-4 rounded-sketch border-2 transition-all text-center',
                            resolution === res.value
                              ? 'border-sketch-dark bg-cream-100 transform rotate-1'
                              : 'border-sketch-light/30 bg-white/50 hover:border-sketch-dark/50 hover:-rotate-1'
                          )}
                        >
                          <span className={cn(
                            'text-lg font-bold block',
                            resolution === res.value ? 'text-sketch-dark' : 'text-sketch-medium'
                          )}>
                            {res.label}
                          </span>
                          <span className={cn(
                            'text-xs font-medium',
                            resolution === res.value ? 'text-sketch-dark/70' : 'text-sketch-light'
                          )}>
                            {res.description}
                          </span>
                          {resolution === res.value && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-sketch-dark rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Output Format */}
                  <div>
                    <label className="block text-sm font-medium text-sketch-dark mb-3">
                      {t('generate.options.format.label')}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {OUTPUT_FORMATS.map((fmt) => (
                        <button
                          key={fmt.value}
                          type="button"
                          onClick={() => setOutputFormat(fmt.value)}
                          className={cn(
                            'relative p-3 rounded-sketch border-2 transition-all text-center font-bold',
                            outputFormat === fmt.value
                              ? 'border-sketch-dark bg-cream-100 text-sketch-dark transform -rotate-1'
                              : 'border-sketch-light/30 bg-white/50 text-sketch-medium hover:border-sketch-dark/50 hover:rotate-1'
                          )}
                        >
                          {fmt.label}
                          {outputFormat === fmt.value && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-sketch-dark rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="card">
                {isGenerating ? (
                  <div className="text-center py-8">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 border-4 border-cream-200 rounded-full" />
                      <div className="absolute inset-0 border-4 border-sketch-dark border-t-transparent rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-sketch-dark" />
                      </div>
                    </div>
                    <p className="text-lg font-medium text-sketch-dark mb-2">
                      {t('generate.generating')}
                    </p>
                    <p className="text-3xl font-display text-sketch-dark">
                      {generationTime}s
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={!uploadedFile || credits < 1}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-5 h-5" />
                    {t('generate.submit')}
                  </button>
                )}

                {credits < 1 && !isGenerating && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 text-sm text-center">
                      {t('generate.errors.noCredits')}{' '}
                      <Link href="/pricing" className="font-semibold underline">
                        {t('profile.credits.buyMore')}
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
