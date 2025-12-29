
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PromptForm from './components/PromptForm';
import ImageDisplay from './components/ImageDisplay';
import Editor from './components/Editor';
import { generatePixelArtImage, generatePixelArtAnimation, generateSpriteSheet, generateImageFromImage, generateSpriteSheetFromImage } from './services/geminiService';
import { SparklesIcon, HistoryIcon, TrashIcon, PanelLeftCloseIcon, PanelRightCloseIcon, SettingsIcon } from './components/icons';
import type { StylePreset, GenerationMode } from './components/PromptForm';
import type { EditorState } from './components/Editor';
import SettingsModal from './components/SettingsModal';


// UTILS - Inlined for simplicity
const subjects = ['knight', 'wizard', 'dragon', 'cyborg', 'alien', 'goblin', 'slime monster', 'robot', 'vampire', 'zombie', 'ninja', 'pirate', 'elf'];
const descriptors = ['heroic', 'ancient', 'glowing', 'steampunk', 'tiny', 'giant', 'shadowy', 'crystal', 'flaming', 'undead', 'cybernetic', 'mystical'];
const items = ['sword', 'staff', 'potion', 'jetpack', 'laser gun', 'shield', 'gem', 'key', 'book', 'helmet', 'grappling hook', 'artifact'];
const animations = ['walking cycle', 'attack animation', 'idle animation', 'jumping', 'casting a spell', 'powering up', 'disappearing', 'exploding', 'dancing', 'running loop'];

const getRandomElement = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const generateRandomPrompt = () => `${getRandomElement(descriptors)} ${getRandomElement(subjects)} with a ${getRandomElement(items)}`;
export const generateRandomAnimationPrompt = () => getRandomElement(animations);

// TYPES
export interface GeneratedAsset {
  id: string;
  url: string;
  type: 'image' | 'animation' | 'spritesheet';
  promptData?: any;
}

export interface HistoryItem {
  id: string;
  asset: GeneratedAsset;
  timestamp: number;
}

const AppTabs: React.FC<{ activeTab: string; onTabChange: (tab: string) => void }> = ({ activeTab, onTabChange }) => {
  const tabs = ['Generate', 'Sprite Sheet', 'Editor'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-4 py-3 text-sm font-bold transition-all duration-200 border-2 rounded-lg flex items-center justify-center text-center shadow-md shadow-black/40 transform hover:-translate-y-px active:translate-y-0 active:shadow-inner ${activeTab.toLowerCase() === tab.toLowerCase()
            ? 'bg-cyan-400 text-slate-900 border-cyan-300 shadow-inner'
            : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
            }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};


// MAIN APP COMPONENT
function App() {
  const [prompt, setPrompt] = useState<string>('a heroic knight with a glowing sword');
  const [animationPrompt, setAnimationPrompt] = useState<string>('swinging the sword');
  const [negativePrompt, setNegativePrompt] = useState<string>('blurry, text, watermark');
  const [generationType, setGenerationType] = useState<'image' | 'animation'>('image');
  const [stylePreset, setStylePreset] = useState<StylePreset>('16-bit');

  const [activeHistoryItem, setActiveHistoryItem] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Conjuring pixels...');

  const [activeTab, setActiveTab] = useState('Generate');
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [panels, setPanels] = useState({ left: true, right: true });

  const displayedAsset = useMemo(() => activeHistoryItem?.asset, [activeHistoryItem]);

  // Load state from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('pixelArtHistoryV2');
      if (savedHistory) {
        const parsedHistory: HistoryItem[] = JSON.parse(savedHistory);
        setHistory(parsedHistory);
        if (parsedHistory.length > 0) setActiveHistoryItem(parsedHistory[0]);
      }
    } catch (e) { console.error("Failed to load history", e); }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    try {
      if (history.length > 0) {
        localStorage.setItem('pixelArtHistoryV2', JSON.stringify(history));
      } else {
        localStorage.removeItem('pixelArtHistoryV2');
      }
    } catch (e) { console.error("Failed to save history", e); }
  }, [history]);

  // Memory cleanup
  useEffect(() => {
    return () => {
      history.forEach(item => {
        if (item.asset.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.asset.url);
        }
      });
    };
  }, [history]);

  const addHistoryItems = (assets: GeneratedAsset[]) => {
    const newItems: HistoryItem[] = assets.map(asset => ({ id: crypto.randomUUID(), asset, timestamp: Date.now() }));
    setHistory(prev => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setActiveHistoryItem(newItems[0]);
    }
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'Editor' && !editorState) {
      const defaultWidth = 64;
      const defaultHeight = 64;
      const canvas = document.createElement('canvas');
      canvas.width = defaultWidth;
      canvas.height = defaultHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, defaultWidth, defaultHeight);

      const img = new Image();
      img.onload = () => {
        setEditorState({
          sourceImage: img,
          frames: [], // Initial state, will be populated by Editor's useEffect
          currentFrameIndex: 0,
          history: [],
          historyIndex: -1,
        });
        setActiveTab('Editor');
      };
      img.onerror = () => {
        setError("Failed to create a new canvas for the editor.");
      }
      img.src = canvas.toDataURL();
      return;
    }
    setActiveTab(tab);
  };

  const handleGenerate = useCallback(async (mode: GenerationMode, generationData: any) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const { baseImage, ...restData } = generationData;

      if (mode === 'single') {
        const { prompt, negativePrompt, stylePreset, generationType, animationPrompt, numImages, temperature } = restData;
        if (baseImage) {
          if (generationType === 'image') {
            setLoadingMessage('Altering image with AI...');
            const fullPrompt = `${prompt}. Style: ${stylePreset}. ${negativePrompt ? `Avoid: ${negativePrompt}` : ''}`;
            const url = await generateImageFromImage(baseImage, fullPrompt, temperature);
            addHistoryItems([{ id: crypto.randomUUID(), url, type: 'image', promptData: restData }]);
          } else { // animation
            setLoadingMessage('Animating from image... this can take a minute.');
            const url = await generatePixelArtAnimation(prompt, animationPrompt, negativePrompt, stylePreset, baseImage);
            addHistoryItems([{ id: crypto.randomUUID(), url, type: 'animation', promptData: restData }]);
          }
        } else {
          if (generationType === 'image') {
            setLoadingMessage(numImages > 1 ? 'Generating sprite variations...' : 'Generating sprite...');
            const urls = await generatePixelArtImage(prompt, negativePrompt, stylePreset, numImages);
            const newAssets: GeneratedAsset[] = urls.map(url => ({
              id: crypto.randomUUID(),
              url,
              type: 'image',
              promptData: restData
            }));
            addHistoryItems(newAssets);
          } else { // animation
            setLoadingMessage('Animating sprite... this can take a minute.');
            const url = await generatePixelArtAnimation(prompt, animationPrompt, negativePrompt, stylePreset);
            addHistoryItems([{ id: crypto.randomUUID(), url, type: 'animation', promptData: restData }]);
          }
        }
      } else if (mode === 'spritesheet') {
        const { prompt, negativePrompt, stylePreset, actions, dimensions, temperature } = restData;
        if (baseImage) {
          setLoadingMessage('Building sprite sheet from image...');
          const url = await generateSpriteSheetFromImage(baseImage, prompt, negativePrompt, stylePreset, actions, dimensions, temperature);
          addHistoryItems([{ id: crypto.randomUUID(), url, type: 'spritesheet', promptData: restData }]);
        } else {
          setLoadingMessage('Constructing sprite sheet...');
          const url = await generateSpriteSheet(prompt, negativePrompt, stylePreset, actions, dimensions);
          addHistoryItems([{ id: crypto.randomUUID(), url, type: 'spritesheet', promptData: restData }]);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate asset. ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);


  const handleSelectHistoryItem = (item: HistoryItem) => {
    setActiveHistoryItem(item);
  };

  const handleClearHistory = () => {
    if (!window.confirm("Are you sure? This will delete all items from your history.")) return;
    history.forEach(item => { if (item.asset.url.startsWith('blob:')) URL.revokeObjectURL(item.asset.url) });
    setHistory([]);
    setActiveHistoryItem(null);
  }

  const handleEditAsset = (asset: GeneratedAsset) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setEditorState({
        sourceImage: img,
        frames: [],
        currentFrameIndex: 0,
        history: [],
        historyIndex: -1
      });
      setActiveTab('Editor');
    };
    img.onerror = () => {
      setError("Could not load image into editor. The resource might be cross-origin or invalid.");
    }
    img.src = asset.url;
  }

  const handleSaveEditedAsset = (dataUrl: string) => {
    addHistoryItems([{
      id: crypto.randomUUID(),
      url: dataUrl,
      type: 'image',
      promptData: { prompt: "Edited in Studio" }
    }]);
    handleTabChange('Generate');
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 selection:bg-fuchsia-500 selection:text-white">
      <div className="w-full max-w-screen-2xl mx-auto flex flex-col items-center">
        <header className="mb-4 text-center relative">
          <h1 className="text-2xl md:text-4xl font-bold text-cyan-400 flex items-center justify-center gap-4 animate-[pulse_5s_ease-in-out_infinite]">
            <SparklesIcon className="w-8 h-8 md:w-12 md:h-12 text-fuchsia-400" />
            PixelArtPro
          </h1>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="w-full flex-grow grid grid-cols-[auto,1fr,auto] gap-4 items-start">
          {/* Left Panel */}
          <aside className={`transition-all duration-300 ${panels.left ? 'w-96' : 'w-8'}`}>
            <div className={`bg-slate-800/50 border-2 border-slate-700 rounded-lg shadow-lg h-full flex flex-col transition-opacity duration-300 ${panels.left ? 'opacity-100' : 'opacity-0'}`}>
              {panels.left && (
                <>
                  <div className="p-4 border-b-2 border-slate-700">
                    <AppTabs activeTab={activeTab} onTabChange={handleTabChange} />
                  </div>

                  <div className="flex-grow overflow-y-auto p-4">
                    {activeTab === 'Generate' && (
                      <PromptForm
                        generationMode='single'
                        onSubmit={handleGenerate}
                        isLoading={isLoading}
                      />
                    )}
                    {activeTab === 'Sprite Sheet' && (
                      <PromptForm
                        generationMode='spritesheet'
                        onSubmit={handleGenerate}
                        isLoading={isLoading}
                      />
                    )}
                    {activeTab === 'Editor' && (
                      <div className="text-center p-4 text-slate-400 text-sm">
                        <p>Pixel Art Studio is active.</p>
                        <p className="mt-2">Use the toolbars around the canvas to create your art.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-grow flex flex-col items-center justify-center h-full">
            <button onClick={() => setPanels(p => ({ ...p, left: !p.left }))} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-slate-700 p-1 rounded-full text-slate-300 hover:bg-cyan-500"><PanelLeftCloseIcon className={`w-5 h-5 transition-transform ${panels.left ? '' : 'rotate-180'}`} /></button>
            <button onClick={() => setPanels(p => ({ ...p, right: !p.right }))} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-slate-700 p-1 rounded-full text-slate-300 hover:bg-cyan-500"><PanelRightCloseIcon className={`w-5 h-5 transition-transform ${panels.right ? '' : 'rotate-180'}`} /></button>

            {activeTab === 'Editor' ? (
              editorState ? (
                <Editor initialState={editorState} onSave={handleSaveEditedAsset} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800/50 border-4 border-dashed border-slate-600 rounded-lg p-4">
                  <p className="text-slate-500 text-center text-sm">Loading editor...</p>
                </div>
              )
            ) : (
              <ImageDisplay
                asset={displayedAsset}
                isLoading={isLoading}
                error={error}
                loadingMessage={loadingMessage}
                onEdit={handleEditAsset}
              />
            )}
          </main>

          {/* Right Panel */}
          <aside className={`transition-all duration-300 ${panels.right ? 'w-80' : 'w-8'}`}>
            <div className={`bg-slate-800/50 border-2 border-slate-700 rounded-lg shadow-lg h-[calc(100vh-8rem)] flex flex-col transition-opacity duration-300 ${panels.right ? 'opacity-100' : 'opacity-0'}`}>
              {panels.right && <HistoryPanel history={history} onSelect={handleSelectHistoryItem} onClear={handleClearHistory} activeItemId={activeHistoryItem?.id} />}
            </div>
          </aside>
        </div>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div >
  );
}

// History Panel Component (can be moved to its own file later)
const HistoryPanel: React.FC<{
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  activeItemId?: string;
}> = ({ history, onSelect, onClear, activeItemId }) => {
  return (
    <>
      <header className="flex items-center justify-between p-3 border-b-2 border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2">
          <HistoryIcon className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-200">History</h2>
        </div>
        <button
          onClick={onClear}
          className="p-1 text-slate-400 hover:text-red-400 disabled:text-slate-600 transition-colors"
          disabled={history.length === 0}
          aria-label="Clear history"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </header>
      <div className="flex-grow overflow-y-auto p-2">
        {history.length === 0 ? (
          <p className="text-center text-xs text-slate-500 p-4">Your generated assets will appear here.</p>
        ) : (
          <ul className="space-y-2">
            {history.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => onSelect(item)}
                  className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-all duration-200 ${activeItemId === item.id ? 'bg-fuchsia-600/40 border-fuchsia-500' : 'bg-slate-900/50 hover:bg-slate-700/50 border-transparent'} border-2`}
                >
                  <img
                    src={item.asset.url}
                    alt={item.asset.promptData?.prompt || 'Generated Asset'}
                    className="w-12 h-12 rounded-md bg-slate-700 pixelated object-contain flex-shrink-0"
                  />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-200 truncate">{item.asset.promptData?.prompt || 'Edited Image'}</p>
                    <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};


export default App;
