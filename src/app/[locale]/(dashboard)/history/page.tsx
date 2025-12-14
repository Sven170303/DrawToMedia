'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  ImageIcon,
  Download,
  Trash2,
  Clock,
  FileText,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles
} from 'lucide-react';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import type { Generation } from '@/types/database';

const ITEMS_PER_PAGE = 20;

export default function HistoryPage() {
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    if (user) {
      fetchGenerations();
    }
  }, [user, currentPage]);

  const fetchGenerations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get total count
      const { count } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setTotalCount(count || 0);

      // Get paginated data
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setGenerations((prev) => prev.filter((g) => g.id !== id));
      setTotalCount((prev) => prev - 1);
      setDeleteConfirm(null);

      if (selectedGeneration?.id === id) {
        setSelectedGeneration(null);
      }
    } catch (error) {
      console.error('Error deleting generation:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (generation: Generation) => {
    try {
      const response = await fetch(generation.generated_image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draw-to-media-${generation.id}.${generation.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-sketch-dark border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="card text-center max-w-md">
            <ImageIcon className="w-16 h-16 text-sketch-medium mx-auto mb-4" />
            <h1 className="font-display text-2xl text-sketch-dark mb-2">
              {t('auth.login.title')}
            </h1>
            <p className="text-sketch-medium mb-6">
              Bitte melde dich an, um deinen Verlauf zu sehen.
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
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-8">
            {t('history.title')}
          </h1>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-sketch-dark" />
            </div>
          ) : generations.length === 0 ? (
            <div className="card text-center py-16">
              <ImageIcon className="w-20 h-20 text-sketch-light mx-auto mb-6" />
              <h2 className="font-display text-2xl text-sketch-dark mb-2">
                {t('history.empty')}
              </h2>
              <p className="text-sketch-medium mb-6">
                Starte jetzt mit deiner ersten Generierung!
              </p>
              <Link href="/generate" className="btn-primary inline-flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {t('history.startGenerating')}
              </Link>
            </div>
          ) : (
            <>
              {/* Grid of generations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {generations.map((generation) => (
                  <div
                    key={generation.id}
                    className="card p-0 overflow-hidden group transform hover:scale-[1.02] transition-transform duration-300"
                  >
                    {/* Image */}
                    <div
                      className="relative aspect-square cursor-pointer"
                      onClick={() => setSelectedGeneration(generation)}
                    >
                      <Image
                        src={generation.generated_image_url}
                        alt="Generated image"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-sketch-dark/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-sketch-medium mb-2">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(generation.created_at)}</span>
                      </div>

                      {generation.user_prompt && (
                        <p className="text-sm text-sketch-dark line-clamp-2 mb-3 font-medium italic">
                          "{generation.user_prompt}"
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-xs font-bold text-sketch-light uppercase tracking-wider">
                        <span>{generation.resolution}</span>
                        <span>•</span>
                        <span>{generation.format}</span>
                        <span>•</span>
                        <span>{generation.generation_time_seconds}s</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t-2 border-cream-200 border-dashed">
                        <button
                          onClick={() => handleDownload(generation)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold text-sketch-dark hover:bg-cream-100 rounded-sketch transition-colors border-2 border-transparent hover:border-sketch-dark/10"
                        >
                          <Download className="w-4 h-4" />
                          {t('generate.result.download')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(generation.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-sketch transition-colors border-2 border-transparent hover:border-red-100"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-2 rounded-lg hover:bg-cream-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sketch-dark">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="p-2 rounded-lg hover:bg-cream-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedGeneration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setSelectedGeneration(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedGeneration(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid md:grid-cols-2">
              {/* Image */}
              <div className="relative aspect-square bg-cream-100">
                <Image
                  src={selectedGeneration.generated_image_url}
                  alt="Generated image"
                  fill
                  className="object-contain"
                />
              </div>

              {/* Details */}
              <div className="p-6 overflow-y-auto max-h-[50vh] md:max-h-[90vh]">
                <h2 className="font-display text-2xl text-sketch-dark mb-6">
                  {t('history.imageDetails.createdAt')}
                </h2>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-sketch-light mb-1">
                      {t('history.imageDetails.createdAt')}
                    </p>
                    <p className="text-sketch-dark">
                      {formatDate(selectedGeneration.created_at)}
                    </p>
                  </div>

                  {selectedGeneration.user_prompt && (
                    <div>
                      <p className="text-sm text-sketch-light mb-1">
                        {t('history.imageDetails.prompt')}
                      </p>
                      <p className="text-sketch-dark">
                        {selectedGeneration.user_prompt}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-sketch-light mb-1">
                      {t('history.imageDetails.resolution')}
                    </p>
                    <p className="text-sketch-dark">
                      {selectedGeneration.resolution}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-sketch-light mb-1">
                      {t('history.imageDetails.generationTime')}
                    </p>
                    <p className="text-sketch-dark">
                      {selectedGeneration.generation_time_seconds} Sekunden
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => handleDownload(selectedGeneration)}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    {t('generate.result.download')}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(selectedGeneration.id)}
                    className="p-3 text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-sketch-dark mb-2">
              {t('common.confirm')}
            </h3>
            <p className="text-sketch-medium mb-6">
              {t('history.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1"
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    {t('common.delete')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
