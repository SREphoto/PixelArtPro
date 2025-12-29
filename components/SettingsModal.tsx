
import React, { useState, useEffect } from 'react';
import { XIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) setApiKey(storedKey);
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('GEMINI_API_KEY', apiKey);
        onClose();
    };

    const handleClear = () => {
        localStorage.removeItem('GEMINI_API_KEY');
        setApiKey('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-800 border-2 border-slate-600 rounded-lg shadow-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-100">Settings</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Google Gemini API Key
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Your key is stored locally in your browser and never sent to our servers.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                        <button
                            onClick={handleClear}
                            className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-400"
                        >
                            Clear Key
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition-colors"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
