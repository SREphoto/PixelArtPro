
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import type { StylePreset } from '../components/PromptForm';

const getApiKey = () => {
    return localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_API_KEY || '';
};

const getAIClient = () => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing. Please add it in Settings.");
    return new GoogleGenAI({ apiKey: key });
};

const stylePrompts: Record<StylePreset, string> = {
    '8-bit': '8-bit pixel art sprite, very pixelated, extremely low resolution, limited 4-color palette like the NES, retro video game asset, clean lines, simple, 1:1 aspect ratio.',
    '16-bit': '16-bit pixel art sprite, SNES/Genesis style, detailed, low resolution, vibrant 32-color palette, retro RPG asset, shaded, 1:1 aspect ratio.',
    'Game Boy': 'Game Boy pixel art sprite, 4-color grayscale palette (shades of green-and-black), very low resolution, iconic retro handheld style, 1:1 aspect ratio.',
    'Monochrome': 'Monochrome 1-bit pixel art, black and white only, sharp edges, minimalist, high contrast, 1:1 aspect ratio.',
    'Isometric': 'isometric 3D pixel art, clean lines, blocky, distinct lighting and shadows, retro strategy game style, 1:1 aspect ratio.',
    'Claymation': 'claymation style, stop-motion look, slightly imperfect shapes, fingerprint textures, vibrant and soft, 1:1 aspect ratio.',
    'LEGO': 'LEGO brick-built style, stud connections visible, blocky and modular, bright primary colors, 1:1 aspect ratio.',
    'Comic Book': 'comic book art style, bold outlines, cel-shading, halftone dot patterns, dynamic, pop art, 1:1 aspect ratio.',
    'Cinematic': 'cinematic lighting, dramatic shadows, high contrast, detailed, atmospheric, movie still look, 1:1 aspect ratio.',
    'Stained Glass': 'stained glass window style, thick black lead lines, vibrant translucent colors, glowing effect, 1:1 aspect ratio.',
    'Sticker': 'die-cut sticker style, thick white border, glossy finish, cute and simple, 1:1 aspect ratio.',
    'Low Poly': 'low-poly 3D render style, flat shading, geometric shapes, minimalist, modern retro, 1:1 aspect ratio.',
    'Voxel': 'voxel art style, made of 3D cubes, blocky, Minecraft-like aesthetic, 1:1 aspect ratio.',
    'Dithering': 'dithered pixel art, limited color palette with dithering for gradients, retro PC-98 style, 1:1 aspect ratio.',
    'HD Pixel Art': 'modern HD pixel art, high resolution sprite, extremely detailed, clean anti-aliasing on curves, contemporary indie game style, 1:1 aspect ratio.',
    'Cute': 'cute kawaii style, rounded shapes, simple features, pastel colors, chibi proportions, 1:1 aspect ratio.',
    'Gothic': 'gothic horror style, dark and moody, high contrast, deep shadows, desaturated colors with red accents, 1:1 aspect ratio.',
    'Synthwave': 'synthwave retrowave style, neon grid lines, glowing elements, 80s aesthetic, purple and pink hues, 1:1 aspect ratio.',
};

const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1];

const imageToGenerativePart = async (imageDataUrl: string) => {
    const base64Encoded = dataUrlToBase64(imageDataUrl);
    const mimeType = imageDataUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
    return {
        inlineData: {
            mimeType,
            data: base64Encoded
        }
    };
};


export const generatePixelArtImage = async (
    userPrompt: string, negativePrompt: string, stylePreset: StylePreset, numberOfImages: number = 1
): Promise<string[]> => {
    const stylePart = stylePrompts[stylePreset];
    const negativePart = negativePrompt ? `絶対に避けてください: ${negativePrompt}.` : '';
    const fullPrompt = `${stylePart} Description: ${userPrompt}. ${negativePart}`;

    const ai = getAIClient();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: fullPrompt,
        config: { numberOfImages, outputMimeType: 'image/png', aspectRatio: '1:1' },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) throw new Error("API did not return any images.");
    return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
};

export const generatePixelArtAnimation = async (
    userPrompt: string, animationPrompt: string, negativePrompt: string, stylePreset: StylePreset, baseImage?: string
): Promise<string> => {
    const stylePart = stylePrompts[stylePreset].replace(', 1:1 aspect ratio', '');
    const negativePart = negativePrompt ? `avoiding: ${negativePrompt}.` : '';
    const fullPrompt = `Pixel art animation of a ${userPrompt}, performing this action: ${animationPrompt}. ${stylePart} Looping animation. ${negativePart}`;

    let operation;

    if (baseImage) {
        const base64Data = dataUrlToBase64(baseImage);
        const mimeType = baseImage.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
        const ai = getAIClient();
        operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: fullPrompt,
            image: {
                imageBytes: base64Data,
                mimeType: mimeType,
            },
            config: { numberOfVideos: 1 }
        });
    } else {
        const ai = getAIClient();
        operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: fullPrompt,
            config: { numberOfVideos: 1 }
        });
    }


    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed to produce a download link.");

    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!videoResponse.ok) throw new Error(`Failed to fetch video file: ${videoResponse.statusText}`);

    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);
};

export const generateSpriteSheet = async (
    userPrompt: string, negativePrompt: string, stylePreset: StylePreset, actions: string[], dimensions: { w: number, h: number }
): Promise<string> => {
    const stylePart = stylePrompts[stylePreset];
    const negativePart = negativePrompt ? `Do not include: ${negativePrompt}.` : '';
    const gridPrompt = actions.map((action, i) => `Frame ${i + 1}: ${action}.`).join(' ');

    const fullPrompt = `Create a ${dimensions.w}x${dimensions.h} sprite sheet of a single character. ${stylePart} The character is: ${userPrompt}. The sheet should have a transparent background. ${gridPrompt} ${negativePart}`;

    const ai = getAIClient();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: fullPrompt,
        config: { numberOfImages: 1, outputMimeType: 'image/png' },
    });
    if (!response.generatedImages || response.generatedImages.length === 0) throw new Error("API did not return sprite sheet.");
    return `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
}

export const generateImageFromImage = async (
    baseImage: string, // base64 data url
    editPrompt: string,
    temperature?: number
): Promise<string> => {
    const imagePart = await imageToGenerativePart(baseImage);
    const textPart = { text: `In the style of pixel art, ${editPrompt}` };

    const config: any = {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
    };

    if (temperature !== undefined) {
        config.temperature = temperature;
    }

    const ai = getAIClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [imagePart, textPart] },
        config: config,
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
        const blockReason = response.promptFeedback?.blockReason;
        let errorMessage = "AI edit did not return valid content.";
        if (blockReason) {
            errorMessage += ` The prompt may have been blocked due to: ${blockReason}.`;
        }
        throw new Error(errorMessage);
    }

    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("AI edit did not return an image.");
}

export const generateSpriteSheetFromImage = async (
    baseImage: string, // base64 data url
    userPrompt: string,
    negativePrompt: string,
    stylePreset: StylePreset,
    actions: string[],
    dimensions: { w: number; h: number },
    temperature?: number
): Promise<string> => {
    const imagePart = await imageToGenerativePart(baseImage);
    const negativePart = negativePrompt ? `Do not include: ${negativePrompt}.` : '';
    const gridPrompt = actions.map((action, i) => `Frame ${i + 1}: ${action}.`).join(' ');

    const fullPrompt = `Take the character from the provided image and create a ${dimensions.w}x${dimensions.h} sprite sheet. The character is described as: ${userPrompt}. The sheet must have a transparent background. Maintain the original art style exactly. The final image should only be the sprite sheet. ${gridPrompt} ${negativePart}`;
    const textPart = { text: fullPrompt };

    const config: any = {
        responseModalities: [Modality.IMAGE],
    };

    if (temperature !== undefined) {
        config.temperature = temperature;
    }

    const ai = getAIClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [imagePart, textPart] },
        config: config,
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
        const blockReason = response.promptFeedback?.blockReason;
        let errorMessage = "AI sprite sheet generation did not return valid content.";
        if (blockReason) {
            errorMessage += ` The prompt may have been blocked due to: ${blockReason}.`;
        }
        throw new Error(errorMessage);
    }

    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("AI sprite sheet generation did not return an image.");
};

export const generateAIPalette = async (
    palettePrompt: string,
    temperature?: number
): Promise<string[]> => {
    const config: any = {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                palette: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: "A hex color code, e.g., '#RRGGBB'"
                    }
                }
            }
        },
    };

    if (temperature !== undefined) {
        config.temperature = temperature;
    }

    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate a color palette of 8 colors based on this theme: "${palettePrompt}". Provide the colors as hex codes.`,
        config: config,
    });

    try {
        const json = JSON.parse(response.text);
        if (json.palette && Array.isArray(json.palette)) {
            return json.palette;
        }
    } catch (e) {
        console.error("Failed to parse palette JSON:", e);
    }
    throw new Error("Could not generate a valid color palette.");
}
