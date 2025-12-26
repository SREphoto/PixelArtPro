
import React from 'react';
import { DownloadIcon, EditIcon } from './icons';
import type { GeneratedAsset } from '../App';

const sanitizeFilename = (prompt: string): string => {
  return prompt.toLowerCase().substring(0, 30).replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim() || 'untitled';
};

const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center gap-4 text-cyan-400">
        <div className="w-16 h-16 border-4 border-dashed border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-center w-48">{message}</p>
    </div>
);

const Placeholder: React.FC = () => (
    <div className="w-full h-full bg-slate-800/50 border-4 border-dashed border-slate-600 rounded-lg flex items-center justify-center p-4">
        <p className="text-slate-500 text-center text-sm">Your creation will appear here...</p>
    </div>
);

interface ImageDisplayProps {
  asset: GeneratedAsset | undefined | null;
  isLoading: boolean;
  error: string | null;
  loadingMessage: string;
  onEdit: (asset: GeneratedAsset) => void;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ asset, isLoading, error, loadingMessage, onEdit }) => {
  const containerClasses = "w-full h-full max-h-[calc(100vh-10rem)] flex items-center justify-center flex-col gap-4";

  if (isLoading) return <div className={containerClasses}><LoadingSpinner message={loadingMessage} /></div>;
  if (error) return <div className={`${containerClasses} bg-red-900/20 border-2 border-red-500 rounded-lg p-4`}><p className="text-red-400 text-center text-sm">{error}</p></div>;
  if (!asset) return <div className={containerClasses}><Placeholder /></div>;

  const promptText = asset.promptData?.prompt || 'Edited Image';
  const downloadFilename = `${sanitizeFilename(promptText)}.${asset.type === 'animation' ? 'mp4' : 'png'}`;
  
  const baseButtonClasses = "inline-flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all duration-200 border-2 rounded-lg shadow-md shadow-black/40 transform hover:-translate-y-px active:translate-y-0 active:shadow-inner";
  const cyanButtonClasses = "bg-cyan-500 text-slate-900 border-cyan-400 hover:bg-cyan-400 hover:border-cyan-300";
  const fuchsiaButtonClasses = "bg-fuchsia-600 text-white border-fuchsia-500 hover:bg-fuchsia-500 hover:border-fuchsia-400";

  return (
    <div className={containerClasses}>
      <div className="flex-grow flex items-center justify-center w-full p-4">
        <div className="p-2 bg-slate-800 border-4 border-slate-700 rounded-lg shadow-lg relative max-w-full max-h-full">
          {asset.type === 'animation' ? (
              <video key={asset.id} src={asset.url} className="pixelated object-contain max-w-full max-h-[calc(100vh-20rem)]" autoPlay loop muted playsInline aria-label={promptText} />
          ) : (
              <img src={asset.url} alt={promptText} className="pixelated object-contain max-w-full max-h-[calc(100vh-20rem)]" />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <a href={asset.url} download={downloadFilename} className={`${baseButtonClasses} ${cyanButtonClasses}`}>
            <DownloadIcon className="w-5 h-5" /> Download
        </a>
        {asset.type !== 'animation' && (
             <button onClick={() => onEdit(asset)} className={`${baseButtonClasses} ${fuchsiaButtonClasses}`}>
                <EditIcon className="w-5 h-5" /> Edit in Studio
            </button>
        )}
      </div>
    </div>
  );
};

export default ImageDisplay;
