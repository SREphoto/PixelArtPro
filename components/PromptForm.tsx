
import React, { useState } from 'react';
import { SparklesIcon, XIcon, FileUpIcon } from './icons';

export type StylePreset =
  | '8-bit' | '16-bit' | 'Game Boy' | 'Monochrome'
  | 'Isometric' | 'Claymation' | 'LEGO' | 'Comic Book'
  | 'Cinematic' | 'Stained Glass' | 'Sticker' | 'Low Poly'
  | 'Voxel' | 'Dithering' | 'HD Pixel Art' | 'Cute'
  | 'Gothic' | 'Synthwave';

export type Genre = 'Fantasy' | 'Sci-Fi' | 'Cyberpunk' | 'Horror' | 'Steampunk' | 'Apocalyptic' | 'Noir' | 'Jungle';
export type Color = 'Vibrant' | 'Pastel' | 'Gloomy' | 'Neon' | 'Warm' | 'Cool' | 'Earthy' | 'Monochromatic';
export type GenerationMode = 'single' | 'spritesheet';

const genrePrompts: Record<Genre, string> = {
  'Fantasy': 'in a high fantasy style',
  'Sci-Fi': 'in a futuristic science fiction style',
  'Cyberpunk': 'in a neon-drenched cyberpunk style',
  'Horror': 'in a dark, gothic horror style',
  'Steampunk': 'in a steampunk style with gears and brass',
  'Apocalyptic': 'in a post-apocalyptic, rugged style',
  'Noir': 'in a high-contrast, black and white noir style',
  'Jungle': 'in a lush, overgrown jungle style',
};

const colorPrompts: Record<Color, string> = {
    'Vibrant': 'using a vibrant, high-contrast color palette',
    'Pastel': 'using a soft, light pastel color palette',
    'Gloomy': 'using a dark, desaturated, and gloomy color palette',
    'Neon': 'using glowing, electric neon colors',
    'Warm': 'using a warm color palette of reds, oranges, and yellows',
    'Cool': 'using a cool color palette of blues, greens, and purples',
    'Earthy': 'using an earthy, natural color palette',
    'Monochromatic': 'using a monochromatic color palette with shades of a single color',
};

// Word banks for random generation
const subjects = ['knight', 'wizard', 'dragon', 'cyborg', 'alien', 'goblin', 'slime monster', 'robot', 'vampire', 'zombie', 'ninja', 'pirate', 'elf', 'demon hunter', 'space marine', 'android detective', 'mech pilot'];
const descriptors = ['heroic', 'ancient', 'glowing', 'steampunk', 'tiny', 'giant', 'shadowy', 'crystal', 'flaming', 'undead', 'cybernetic', 'mystical', 'ethereal', 'mutated', 'rogue'];
const items = ['sword', 'staff', 'potion', 'jetpack', 'laser gun', 'shield', 'gem', 'key', 'book', 'helmet', 'grappling hook', 'artifact', 'plasma rifle', 'energy shield', 'ancient scroll'];

const getRandomElement = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
export const generateRandomCharacter = () => `${getRandomElement(descriptors)} ${getRandomElement(subjects)} with a ${getRandomElement(items)}`;


const OptionSelector = <T extends string>({ label, options, selected, onSelect, disabled }: {
    label: string;
    options: T[];
    selected: T;
    onSelect: (option: T) => void;
    disabled: boolean;
}) => (
    <div>
        <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">{label}</label>
        <div className="grid grid-cols-4 justify-center gap-2 p-1 bg-slate-900 border-2 border-slate-700 rounded-lg">
            {options.map(option => (
                <button key={option} type="button" onClick={() => onSelect(option)}
                    className={`min-h-[2.75rem] px-1 py-1 text-xs font-bold transition-all duration-200 border-2 rounded-lg flex items-center justify-center text-center leading-tight tracking-normal ${
                        selected === option
                            ? 'bg-cyan-400 text-slate-900 border-cyan-300 shadow-inner shadow-black/40'
                            : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:border-slate-500 shadow-md shadow-black/40 transform hover:-translate-y-px active:translate-y-0 active:shadow-inner'
                    } disabled:opacity-50 disabled:transform-none disabled:shadow-none`}
                    disabled={disabled} aria-pressed={selected === option}>
                    {option}
                </button>
            ))}
        </div>
    </div>
);


const StylePresetSelector: React.FC<{
  selected: StylePreset; onSelect: (preset: StylePreset) => void; disabled: boolean;
}> = ({ selected, onSelect, disabled }) => {
  const presets: StylePreset[] = [
    '8-bit', '16-bit', 'Game Boy', 'Monochrome', 'Isometric', 'Claymation', 'LEGO', 'Comic Book',
    'Cinematic', 'Stained Glass', 'Sticker', 'Low Poly', 'Voxel', 'Dithering', 'HD Pixel Art', 'Cute',
    'Gothic', 'Synthwave'
  ];
  return (
    <div>
      <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Style Preset</label>
      <div className="grid grid-cols-4 justify-center gap-2 p-1 bg-slate-900 border-2 border-slate-700 rounded-lg">
        {presets.map(preset => (
          <button key={preset} type="button" onClick={() => onSelect(preset)}
            className={`min-h-[2.75rem] px-1 py-1 text-xs font-bold transition-all duration-200 border-2 rounded-lg flex items-center justify-center text-center leading-tight tracking-normal ${
              selected === preset
                ? 'bg-cyan-400 text-slate-900 border-cyan-300 shadow-inner shadow-black/40'
                : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:border-slate-500 shadow-md shadow-black/40 transform hover:-translate-y-px active:translate-y-0 active:shadow-inner'
            } disabled:opacity-50 disabled:transform-none disabled:shadow-none`}
            disabled={disabled} aria-pressed={selected === preset}>
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
};

const ImageUploader: React.FC<{ onImageUpload: (base64: string | null) => void }> = ({ onImageUpload }) => {
    const [image, setImage] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setImage(base64String);
                onImageUpload(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
        onImageUpload(null);
    };

    return (
        <div>
            <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Base Image (Optional)</label>
            {image ? (
                <div className="relative group">
                    <img src={image} alt="Upload preview" className="w-full h-32 object-contain rounded-md bg-slate-900/50 p-1" />
                    <button
                        onClick={handleRemoveImage}
                        className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <label className="w-full h-20 flex flex-col items-center justify-center bg-slate-800 border-2 border-dashed border-slate-600 rounded-md cursor-pointer hover:border-cyan-400 hover:bg-slate-700">
                    <FileUpIcon className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-400">Click to upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
            )}
        </div>
    );
};


const SingleGenerator: React.FC<{ onSubmit: (data: any) => void; isLoading: boolean }> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('a heroic knight with a glowing sword');
  const [animationPrompt, setAnimationPrompt] = useState('swinging the sword');
  const [negativePrompt, setNegativePrompt] = useState('blurry, text, watermark');
  const [generationType, setGenerationType] = useState<'image' | 'animation'>('image');
  const [stylePreset, setStylePreset] = useState<StylePreset>('16-bit');
  const [genre, setGenre] = useState<Genre>('Fantasy');
  const [color, setColor] = useState<Color>('Vibrant');
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [numToGenerate, setNumToGenerate] = useState(1);
  const [temperature, setTemperature] = useState(0.8);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const promptAdditions = [genrePrompts[genre], colorPrompts[color]].join(', ');
    const fullPrompt = `${prompt}, ${promptAdditions}.`;
    onSubmit({ prompt: fullPrompt, animationPrompt, negativePrompt, generationType, stylePreset, numImages: numToGenerate, baseImage, temperature });
  };

  const buttonBaseClasses = "px-4 py-2 text-sm font-bold transition-all duration-300 border-2 rounded-md shadow-md shadow-black/40 transform hover:-translate-y-px active:translate-y-0 active:shadow-inner";
  const activeClasses = "bg-cyan-400 text-slate-900 border-cyan-300 shadow-inner";
  const inactiveClasses = "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700";

  const glowButtonClasses = "w-full flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold transition-all duration-200 border-2 rounded-lg shadow-md shadow-black/40 transform hover:-translate-y-px active:translate-y-0 active:shadow-inner disabled:opacity-50 disabled:transform-none disabled:shadow-none bg-fuchsia-600 text-white border-fuchsia-500 hover:bg-fuchsia-500 hover:border-fuchsia-400 hover:shadow-[0_0_15px_2px_theme(colors.cyan.400)] focus:shadow-[0_0_15px_2px_theme(colors.cyan.400)]";
  
  const selectorButtonBase = `p-3 text-lg font-bold transition-all duration-300 ease-in-out rounded-lg shadow-md shadow-black/40 text-center border-2`;
  const selectorActive = `bg-cyan-400 text-slate-900 border-cyan-300`;
  const selectorInactive = `bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700`;


  const canGenerateVariants = generationType === 'image' && !baseImage;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="w-full grid grid-cols-2 justify-center gap-2 p-1 bg-slate-900 border-2 border-slate-700 rounded-lg">
        <button type="button" onClick={() => setGenerationType('image')} className={`${buttonBaseClasses} ${generationType === 'image' ? activeClasses : inactiveClasses}`} disabled={isLoading}>Image</button>
        <button type="button" onClick={() => setGenerationType('animation')} className={`${buttonBaseClasses} ${generationType === 'animation' ? activeClasses : inactiveClasses}`} disabled={isLoading}>Animation</button>
      </div>
       <ImageUploader onImageUpload={setBaseImage} />
       <OptionSelector label="Genre" options={Object.keys(genrePrompts) as Genre[]} selected={genre} onSelect={option => setGenre(option)} disabled={isLoading} />
       <OptionSelector label="Color" options={Object.keys(colorPrompts) as Color[]} selected={color} onSelect={option => setColor(option)} disabled={isLoading} />
       <StylePresetSelector selected={stylePreset} onSelect={setStylePreset} disabled={isLoading} />
        <div>
          <label htmlFor="creativity-slider" className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Creativity: {temperature.toFixed(1)}</label>
           <div className="px-1">
            <input id="creativity-slider" type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full" disabled={isLoading}/>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Precise</span>
              <span>Imaginative</span>
            </div>
          </div>
       </div>
       <div>
         <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Description</label>
         <div className="relative">
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Sprite Description" className="w-full h-24 p-2 pr-10 bg-slate-800 border-2 border-slate-600 rounded-md text-sm text-slate-200 resize-none" disabled={isLoading} />
            <button type="button" title="Surprise Me!" onClick={() => setPrompt(generateRandomCharacter())} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-cyan-400" disabled={isLoading}><SparklesIcon className="w-5 h-5"/></button>
         </div>
       </div>
      {generationType === 'animation' && <textarea value={animationPrompt} onChange={e => setAnimationPrompt(e.target.value)} placeholder="Animation Description" className="w-full h-20 p-2 bg-slate-800 border-2 border-slate-600 rounded-md text-sm text-slate-200 resize-none" disabled={isLoading} />}
      <div>
        <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Negative Prompt</label>
        <textarea value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="e.g. blurry, text, watermark" className="w-full h-20 p-2 bg-slate-800 border-2 border-slate-600 rounded-md text-sm text-slate-200 resize-none" disabled={isLoading} />
      </div>

      {canGenerateVariants ? (
        <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNumToGenerate(1)}
                disabled={isLoading}
                className={`${selectorButtonBase} ${numToGenerate === 1 ? 'w-3/4 ' + selectorActive : 'w-1/4 ' + selectorInactive}`}
              >
                {numToGenerate === 1 ? 'One Generation' : '1'}
              </button>
              <button
                type="button"
                onClick={() => setNumToGenerate(2)}
                disabled={isLoading}
                className={`${selectorButtonBase} ${numToGenerate === 2 ? 'w-3/4 ' + selectorActive : 'w-1/4 ' + selectorInactive}`}
              >
                {numToGenerate === 2 ? 'Two Generations' : '2'}
              </button>
            </div>
            <button type="submit" disabled={isLoading} className={glowButtonClasses}>
              {isLoading ? 'Generating...' : `Generate`}
            </button>
        </>
      ) : (
        <button type="submit" onClick={() => setNumToGenerate(1)} disabled={isLoading} className={glowButtonClasses}>
            {isLoading ? 'Generating...' : 'Generate'}
        </button>
      )}

    </form>
  );
};

const SpriteSheetGenerator: React.FC<{ onSubmit: (data: any) => void; isLoading: boolean }> = ({ onSubmit, isLoading }) => {
    const [prompt, setPrompt] = useState('a powerful robot');
    const [negativePrompt, setNegativePrompt] = useState('blurry, text, watermark, inconsistent design');
    const [stylePreset, setStylePreset] = useState<StylePreset>('16-bit');
    const [genre, setGenre] = useState<Genre>('Sci-Fi');
    const [color, setColor] = useState<Color>('Cool');
    const [actions, setActions] = useState(['idle stance', 'walking right', 'jumping', 'shooting laser']);
    const [dimensions, setDimensions] = useState({ w: 2, h: 2 });
    const [baseImage, setBaseImage] = useState<string | null>(null);
    const [temperature, setTemperature] = useState(0.8);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const promptAdditions = [genrePrompts[genre], colorPrompts[color]].join(', ');
        const fullPrompt = `Base character: ${prompt}, ${promptAdditions}.`;
        onSubmit({ prompt: fullPrompt, negativePrompt, stylePreset, actions: actions.slice(0, dimensions.w * dimensions.h), dimensions, baseImage, temperature });
    };

    const handleActionChange = (index: number, value: string) => {
        const newActions = [...actions];
        newActions[index] = value;
        setActions(newActions);
    };

    const glowButtonClasses = "flex items-center justify-center gap-2 px-4 py-3 text-lg font-bold transition-all duration-200 border-2 rounded-lg shadow-md shadow-black/40 transform hover:-translate-y-px active:translate-y-0 active:shadow-inner disabled:opacity-50 disabled:transform-none disabled:shadow-none bg-fuchsia-600 text-white border-fuchsia-500 hover:bg-fuchsia-500 hover:border-fuchsia-400 hover:shadow-[0_0_15px_2px_theme(colors.cyan.400)] focus:shadow-[0_0_15px_2px_theme(colors.cyan.400)]";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <ImageUploader onImageUpload={setBaseImage} />
            <OptionSelector label="Genre" options={Object.keys(genrePrompts) as Genre[]} selected={genre} onSelect={option => setGenre(option)} disabled={isLoading} />
            <OptionSelector label="Color" options={Object.keys(colorPrompts) as Color[]} selected={color} onSelect={option => setColor(option)} disabled={isLoading} />
            <StylePresetSelector selected={stylePreset} onSelect={setStylePreset} disabled={isLoading} />
             <div>
                <label htmlFor="creativity-slider-ss" className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Creativity: {temperature.toFixed(1)}</label>
                <div className="px-1">
                  <input id="creativity-slider-ss" type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full" disabled={isLoading}/>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Precise</span>
                    <span>Imaginative</span>
                  </div>
                </div>
            </div>
             <div>
                <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Base Character Description</label>
                <div className="relative">
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Base Character Description" className="w-full h-24 p-2 pr-10 bg-slate-800 border-2 border-slate-600 rounded-md text-sm text-slate-200 resize-none" disabled={isLoading} />
                    <button type="button" title="Surprise Me!" onClick={() => setPrompt(generateRandomCharacter())} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-cyan-400" disabled={isLoading}><SparklesIcon className="w-5 h-5"/></button>
                </div>
            </div>
            
            <div>
                <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Sheet Dimensions</label>
                <div className="grid grid-cols-2 gap-2">
                    <select value={`${dimensions.w}x${dimensions.h}`} onChange={e => {
                        const [w, h] = e.target.value.split('x').map(Number);
                        setDimensions({w, h});
                    }} className="bg-slate-800 border-2 border-slate-600 rounded-md text-sm p-2" disabled={isLoading}>
                        <option>2x2</option><option>4x1</option><option>1x4</option><option>3x2</option><option>4x2</option><option>4x4</option>
                    </select>
                </div>
            </div>

            <div>
                 <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Animation Frames</label>
                 <div className="space-y-2">
                     {Array.from({ length: dimensions.w * dimensions.h }).map((_, i) => (
                         <input key={i} type="text" value={actions[i] || ''} onChange={e => handleActionChange(i, e.target.value)} placeholder={`Frame ${i+1} Action`} className="w-full p-2 bg-slate-800 border-2 border-slate-600 rounded-md text-sm" disabled={isLoading}/>
                     ))}
                 </div>
            </div>
            <div>
              <label className="block text-lg text-slate-300 mb-2 ml-1 tracking-wider">Negative Prompt</label>
              <textarea value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="e.g. blurry, text, watermark" className="w-full h-20 p-2 bg-slate-800 border-2 border-slate-600 rounded-md text-sm text-slate-200 resize-none" disabled={isLoading} />
            </div>
            <button type="submit" disabled={isLoading} className={glowButtonClasses}>
                {isLoading ? 'Generating...' : 'Generate Sheet'}
            </button>
        </form>
    );
}

interface PromptFormProps {
  generationMode: GenerationMode;
  onSubmit: (mode: GenerationMode, data: any) => void;
  isLoading: boolean;
}

const PromptForm: React.FC<PromptFormProps> = ({ generationMode, onSubmit, isLoading }) => {
  const handleFormSubmit = (data: any) => {
    onSubmit(generationMode, data);
  };

  return (
    <div>
      {generationMode === 'single' && <SingleGenerator onSubmit={handleFormSubmit} isLoading={isLoading} />}
      {generationMode === 'spritesheet' && <SpriteSheetGenerator onSubmit={handleFormSubmit} isLoading={isLoading} />}
    </div>
  );
};

export default PromptForm;