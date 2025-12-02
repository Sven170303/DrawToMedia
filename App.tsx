import React, { useState, useEffect } from 'react';
import { User, ViewState, Language, GeneratedImage } from './types';
import { TRANSLATIONS } from './constants';
import { Navbar } from './components/Navbar';
import { Button } from './components/ui/Button';
import { HistoryGallery } from './components/HistoryGallery';
import { generateDigitalMedia } from './services/geminiService';
import { Upload, Camera, Zap, CheckCircle, Plus, X } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [lang, setLang] = useState<Language>('en');
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  
  // Auth State
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  // Generation State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // New: Additional Assets State
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]); // Array of Base64 strings

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<GeneratedImage[]>([]);

  // Helpers
  const t = (key: string) => TRANSLATIONS[key][lang];

  // Auth Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      setOtpSent(true);
      // Simulate OTP send
    } else {
      // Simulate Verify
      if (otp === '1234') { // Mock OTP
        setUser({ email, credits: 5, isVerified: true });
        setView(ViewState.GENERATE);
      } else {
        alert('Invalid OTP (Try 1234)');
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView(ViewState.HOME);
    setOtpSent(false);
    setEmail('');
    setOtp('');
  };

  // Image Upload (Main Sketch)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setGeneratedResult(null); // Reset previous result
      };
      reader.readAsDataURL(file);
    }
  };

  // Image Upload (Reference Assets)
  const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                setReferenceFiles(prev => [...prev, reader.result as string]);
            }
        };
        reader.readAsDataURL(file);
    }
    // Reset input value to allow same file selection again if needed
    e.target.value = '';
  };

  const removeReference = (index: number) => {
      setReferenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Generation Logic
  const handleGenerate = async () => {
    if (!user || user.credits < 1) {
      alert(t('noCredits'));
      setView(ViewState.CREDITS);
      return;
    }
    if (!previewUrl) return;

    setIsGenerating(true);
    const startTime = Date.now();
    const interval = setInterval(() => {
        setGenerationTime(prev => prev + 0.1);
    }, 100);

    try {
      // Pass main sketch + reference images
      const result = await generateDigitalMedia(previewUrl, prompt, referenceFiles);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      const finalImage = result.imageBase64 || previewUrl; 

      // Deduct Credit
      setUser(prev => prev ? { ...prev, credits: prev.credits - 1 } : null);

      // Save to History
      const newEntry: GeneratedImage = {
        id: Date.now().toString(),
        originalImage: previewUrl,
        generatedImage: finalImage,
        prompt,
        timestamp: Date.now(),
        durationSeconds: duration
      };

      setHistory(prev => [newEntry, ...prev]);
      setGeneratedResult(finalImage);

    } catch (error) {
      console.error(error);
      alert("Error generating image. Please try again.");
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
      setGenerationTime(0);
    }
  };

  // Feedback Handler
  const handleFeedback = (imageId: string, comment: string) => {
    if (!user || user.credits < 1) {
       alert(t('noCredits'));
       return;
    }

    // Deduct credit for feedback
    setUser(prev => prev ? { ...prev, credits: prev.credits - 1 } : null);

    // Update history item
    setHistory(prev => prev.map(item => 
        item.id === imageId ? { ...item, feedback: comment } : item
    ));
  };

  const handleBuyCredits = () => {
      // Mock Stripe
      if(user) {
          setUser({...user, credits: user.credits + 10});
          alert("Payment Successful! +10 Credits");
      }
  };

  // Views
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 text-ink drop-shadow-sm">
        {t('appTitle')}
      </h1>
      <p className="font-sans text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl">
        {t('subtitle')}
      </p>
      <div className="bg-white p-8 border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md">
        <h2 className="font-bold text-xl mb-4 font-serif">{t('login')}</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {!otpSent ? (
            <>
              <label className="text-left font-bold font-sans text-sm">{t('emailLabel')}</label>
              <input 
                type="email" 
                required
                className="p-3 border-2 border-black rounded font-sans focus:outline-none focus:ring-2 focus:ring-pencil-blue"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="artist@example.com"
              />
              <Button type="submit">{t('sendOtp')}</Button>
            </>
          ) : (
            <>
              <div className="bg-green-100 p-2 rounded text-sm text-green-800 border border-green-300 mb-2">
                Code sent to {email}. (Use 1234)
              </div>
              <label className="text-left font-bold font-sans text-sm">{t('enterOtp')}</label>
              <input 
                type="text" 
                required
                maxLength={4}
                className="p-3 border-2 border-black rounded font-sans text-center text-2xl tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <Button type="submit">{t('verify')}</Button>
              <button 
                type="button" 
                onClick={() => setOtpSent(false)} 
                className="text-sm underline text-gray-500 mt-2"
              >
                Change Email
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );

  const renderCredits = () => (
      <div className="max-w-4xl mx-auto py-10 px-4">
          <h2 className="font-serif text-4xl font-bold mb-8 text-center">{t('credits')}</h2>
          <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-6 border-2 border-black rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="font-bold text-xl mb-2 font-sans">Pay As You Go</h3>
                  <div className="text-4xl font-bold text-pencil-blue mb-4">1 € <span className="text-base text-gray-500 font-normal">/ Credit</span></div>
                  <ul className="list-disc list-inside mb-6 text-gray-600 font-serif">
                      <li>Single Generation</li>
                      <li>High Res Output</li>
                      <li>Commercial Usage</li>
                  </ul>
                  <Button onClick={handleBuyCredits} className="w-full">{t('buyCredits')} (1)</Button>
              </div>
              <div className="bg-paper p-6 border-2 border-black rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-marker-red text-white text-xs font-bold px-2 py-1 transform rotate-12">POPULAR</div>
                  <h3 className="font-bold text-xl mb-2 font-sans">Creative Pack</h3>
                  <div className="text-4xl font-bold text-pencil-blue mb-4">10 € <span className="text-base text-gray-500 font-normal">/ 12 Credits</span></div>
                  <ul className="list-disc list-inside mb-6 text-gray-600 font-serif">
                      <li>12 Generations (+2 Free)</li>
                      <li>Priority Processing</li>
                      <li>History Access</li>
                  </ul>
                  <Button onClick={handleBuyCredits} className="w-full">{t('buyCredits')} (12)</Button>
              </div>
          </div>
      </div>
  );

  const renderGenerator = () => (
    <div className="max-w-4xl mx-auto py-8 px-4">
       <div className="mb-8 text-center">
         <h2 className="font-serif text-3xl font-bold mb-2">{t('uploadTitle')}</h2>
         <p className="font-sans text-gray-600">{t('uploadDesc')}</p>
       </div>

       <div className="grid md:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
              <div className="relative border-2 border-dashed border-black rounded-lg p-8 bg-white hover:bg-gray-50 transition-colors text-center cursor-pointer group">
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {previewUrl ? (
                      <div className="relative aspect-square w-full bg-gray-100 rounded overflow-hidden">
                          <img src={previewUrl} alt="Preview" className="object-cover w-full h-full" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold">
                              Change Sketch
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                          <Camera size={48} className="text-gray-400 mb-4" />
                          <span className="font-bold font-serif text-lg text-gray-500">Click to Upload Sketch</span>
                      </div>
                  )}
              </div>

              {/* Reference Images Section */}
              <div className="bg-paper p-4 rounded border border-gray-300">
                  <div className="flex justify-between items-center mb-2">
                     <label className="font-bold font-sans text-sm">{t('addAssets')}</label>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{t('addAssetsDesc')}</p>
                  
                  <div className="flex flex-wrap gap-2">
                      {referenceFiles.map((ref, idx) => (
                          <div key={idx} className="relative w-16 h-16 border border-gray-300 rounded overflow-hidden bg-white group">
                              <img src={ref} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                              <button 
                                onClick={() => removeReference(idx)}
                                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl hover:bg-red-700"
                              >
                                  <X size={12} />
                              </button>
                          </div>
                      ))}
                      
                      <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-400 rounded cursor-pointer hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <Plus size={20} />
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg"
                            onChange={handleReferenceChange}
                            className="hidden" 
                          />
                      </label>
                  </div>
              </div>

              <div>
                  <label className="block font-bold font-sans text-sm mb-2">Custom Instructions (Optional)</label>
                  <textarea 
                    className="w-full p-3 border-2 border-black rounded font-sans focus:outline-none focus:ring-2 focus:ring-pencil-blue bg-white"
                    placeholder={t('promptPlaceholder')}
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
              </div>

              <Button 
                className="w-full py-4 text-lg" 
                onClick={handleGenerate} 
                disabled={!previewUrl || isGenerating}
                isLoading={isGenerating}
              >
                  {isGenerating ? `${t('generating')} ${generationTime.toFixed(1)}s` : t('generateBtn')}
              </Button>
          </div>

          {/* Result Section */}
          <div className="border-2 border-black bg-white rounded-lg p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center min-h-[400px]">
              {generatedResult ? (
                  <div className="w-full h-full flex flex-col animate-in fade-in zoom-in duration-500">
                      <div className="flex items-center justify-center gap-2 mb-4 text-green-600 font-bold">
                          <CheckCircle /> Done!
                      </div>
                      <div className="relative w-full flex-grow flex items-center justify-center bg-gray-100 rounded border border-gray-200 overflow-hidden">
                          <img 
                            src={generatedResult} 
                            alt="Generated" 
                            className="max-w-full max-h-[500px] object-contain" 
                          />
                      </div>
                      <div className="mt-4 w-full">
                         <a 
                            href={generatedResult} 
                            download="digital-art.png" 
                            className="block w-full text-center py-2 bg-black text-white font-bold rounded hover:bg-gray-800 transition"
                         >
                             Download
                         </a>
                      </div>
                  </div>
              ) : (
                  <div className="text-center text-gray-400">
                      <Zap size={64} className="mx-auto mb-4 opacity-20" />
                      <p className="font-serif text-xl">Your masterpiece will appear here.</p>
                  </div>
              )}
          </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-10">
      <Navbar 
        user={user} 
        lang={lang} 
        setLang={setLang} 
        setView={setView} 
        onLogout={handleLogout}
        currentView={view}
      />
      
      <main className="container mx-auto mt-6">
        {view === ViewState.HOME && renderHome()}
        
        {/* Protected Routes */}
        {user && view === ViewState.GENERATE && renderGenerator()}
        {user && view === ViewState.CREDITS && renderCredits()}
        {user && view === ViewState.HISTORY && (
            <div className="max-w-6xl mx-auto px-4">
                <h2 className="font-serif text-3xl font-bold mb-6">{t('history')}</h2>
                <HistoryGallery 
                    images={history} 
                    lang={lang} 
                    onFeedback={handleFeedback}
                    userCredits={user.credits}
                />
            </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 border-t border-gray-200 py-3 px-6 text-center text-xs font-sans text-gray-500 flex justify-center gap-6">
          <span>&copy; 2024 {t('appTitle')}</span>
          <span className="cursor-pointer hover:underline">{t('legal')}</span>
          <span>{t('footerText')}</span>
      </footer>
    </div>
  );
};

export default App;