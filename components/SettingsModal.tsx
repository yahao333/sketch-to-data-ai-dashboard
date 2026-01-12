import React from 'react';
import { AppSettings, Language, LLMProvider } from '../types';
import { UI_TEXT } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  if (!isOpen) return null;

  const t = UI_TEXT[settings.language];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ ...settings, language: e.target.value as Language });
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ ...settings, llmProvider: e.target.value as LLMProvider });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, aliyunApiKey: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">{t.settings}</h2>

        <div className="space-y-6">
          {/* Language Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.language}</label>
            <select
              value={settings.language}
              onChange={handleLanguageChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value={Language.ZH}>中文 (Chinese)</option>
              <option value={Language.EN}>English</option>
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.llmModel}</label>
            <select
              value={settings.llmProvider}
              onChange={handleProviderChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value={LLMProvider.GEMINI}>Google Gemini</option>
              <option value={LLMProvider.ALIYUN}>阿里云百炼 (Aliyun Bailian)</option>
            </select>
            <p className="text-xs text-amber-600 mt-2">
              {t.changeProviderWarning}
            </p>
          </div>

          {/* API Key Input (Only for Aliyun) */}
          {settings.llmProvider === LLMProvider.ALIYUN && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.apiKey}</label>
              <input
                type="password"
                value={settings.aliyunApiKey || ''}
                onChange={handleApiKeyChange}
                placeholder={t.apiKeyPlaceholder}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-sm"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;