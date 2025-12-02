import React, { useState } from 'react';
import { GeneratedImage, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Button } from './ui/Button';
import { MessageSquare } from 'lucide-react';

interface HistoryGalleryProps {
  images: GeneratedImage[];
  lang: Language;
  onFeedback: (imageId: string, comment: string) => void;
  userCredits: number;
}

export const HistoryGallery: React.FC<HistoryGalleryProps> = ({ images, lang, onFeedback, userCredits }) => {
  const t = (key: string) => TRANSLATIONS[key][lang];
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const handleFeedbackSubmit = (id: string) => {
    if (comment.trim()) {
        onFeedback(id, comment);
        setActiveFeedbackId(null);
        setComment('');
    }
  };

  if (images.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 font-serif">
            <p className="text-xl">No masterpieces yet.</p>
        </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
      {images.map((img) => (
        <div key={img.id} className="bg-white p-3 border-2 border-black rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <div className="relative aspect-square mb-3 bg-gray-100 overflow-hidden rounded border border-gray-200">
                 {/* Show generated if available, else original as fallback/placeholder */}
                 <img 
                    src={img.generatedImage || img.originalImage} 
                    alt="Result" 
                    className="w-full h-full object-cover"
                 />
                 <div className="absolute bottom-0 right-0 bg-black text-white text-xs px-2 py-1 font-mono">
                    {img.durationSeconds.toFixed(1)}s
                 </div>
            </div>
            
            <div className="mb-3">
                <p className="text-xs text-gray-500 font-sans uppercase tracking-wider mb-1">Prompt</p>
                <p className="font-serif text-sm leading-tight text-ink line-clamp-2">
                    {img.prompt || "No custom prompt"}
                </p>
            </div>

            {img.feedback ? (
                <div className="bg-gray-50 p-2 rounded border border-gray-200 text-sm font-sans italic text-gray-600">
                    "{img.feedback}"
                </div>
            ) : (
                <>
                    {activeFeedbackId === img.id ? (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                             <textarea 
                                className="w-full p-2 border-2 border-black rounded font-sans text-sm mb-2"
                                placeholder={t('feedbackPlaceholder')}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                             />
                             <div className="flex gap-2">
                                <Button 
                                    onClick={() => handleFeedbackSubmit(img.id)} 
                                    className="text-xs py-1 px-3"
                                    disabled={userCredits < 1}
                                >
                                    {t('submit')} (-1)
                                </Button>
                                <button 
                                    onClick={() => setActiveFeedbackId(null)}
                                    className="text-xs underline text-gray-500"
                                >
                                    Cancel
                                </button>
                             </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setActiveFeedbackId(img.id)}
                            className="flex items-center gap-1 text-sm font-bold text-pencil-blue hover:underline"
                        >
                            <MessageSquare size={14} />
                            {t('feedback')}
                        </button>
                    )}
                </>
            )}
        </div>
      ))}
    </div>
  );
};