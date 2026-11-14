import React, { useState } from 'react';
import { Download, Copy, Check, FolderGit2, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import {
  ExtensionConfig,
  generateManifestJson,
  generateExtensionIndexJs,
  generateExtensionStyleCss,
  generateReadmeMd,
  downloadSillyTavernExtensionZip,
} from '../utils/stExtensionBuilder';

interface ExtensionExporterViewProps {
  config: ExtensionConfig;
  onChangeConfig: (cfg: ExtensionConfig) => void;
  livePromptBlock: string;
}

export const ExtensionExporterView: React.FC<ExtensionExporterViewProps> = ({
  config,
  onChangeConfig,
  livePromptBlock,
}) => {
  const [selectedFile, setSelectedFile] = useState<'index.js' | 'manifest.json' | 'style.css' | 'README.md'>('index.js');
  const [copied, setCopied] = useState(false);
  const [githubUrlInput, setGithubUrlInput] = useState('');
  const [copiedCleanUrl, setCopiedCleanUrl] = useState(false);

  const getFileContent = () => {
    switch (selectedFile) {
      case 'manifest.json':
        return generateManifestJson(config);
      case 'style.css':
        return generateExtensionStyleCss();
      case 'README.md':
        return generateReadmeMd(config);
      case 'index.js':
      default:
        return generateExtensionIndexJs(config, livePromptBlock);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFileContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Clean and diagnose user's GitHub URL for SillyTavern
  const analyzeGithubUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    if (!match) {
      return {
        valid: false,
        cleanUrl: '',
        reason: 'Ссылка должна вести на репозиторий github.com/логин/репозиторий.',
      };
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/i, '');
    const cleanUrl = `https://github.com/${owner}/${repo}`;

    const hasSubpath =
      trimmed.includes('/tree/') ||
      trimmed.includes('/blob/') ||
      trimmed.endsWith('/manifest.json');

    return {
      valid: true,
      cleanUrl,
      hasSubpath,
      reason: hasSubpath
        ? 'Внимание: в вашей ссылке был лишний хвост (/tree/main и т.д.). SillyTavern принимает ТОЛЬКО чистую ссылку на корень репозитория!'
        : 'Формат ссылки идеальный для SillyTavern.',
    };
  };

  const urlAnalysis = analyzeGithubUrl(githubUrlInput);

  const handleCopyCleanUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCleanUrl(true);
    setTimeout(() => setCopiedCleanUrl(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* GitHub Installation Troubleshooting Banner */}
      <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-100">
              Почему SillyTavern выдавал ошибку при установке с GitHub и что мы уже исправили:
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              При установке по ссылке SillyTavern клонирует репозиторий и ищет файл{' '}
              <code className="text-amber-300 font-mono">manifest.json</code> строго в самом{' '}
              <strong>корне репозитория</strong>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>1. Файлы вынесены в корень</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Мы добавили готовые <code className="font-mono text-amber-300">manifest.json</code>,{' '}
              <code className="font-mono text-amber-300">index.js</code> и{' '}
              <code className="font-mono text-amber-300">style.css</code> прямо в корень этого проекта (и убрали вложенную подпапку из ZIP-архива). Просто <strong>запушьте обновленный проект на GitHub еще раз</strong>!
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 shrink-0" />
              <span>2. Репозиторий должен быть Public</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Убедитесь в настройках GitHub (<em>Settings → Change repository visibility</em>), что репозиторий <strong>Public (Публичный)</strong>. Если он Private, SillyTavern не может сделать <code className="font-mono">git clone</code> и выдает ошибку.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 shrink-0" />
              <span>3. Чистая ссылка без /tree/main</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              В поле установки SillyTavern вставляйте ссылку строго вида{' '}
              <code className="font-mono text-amber-300">https://github.com/логин/репо</code> — без{' '}
              <code className="font-mono">/tree/main</code> и без <code className="font-mono">/manifest.json</code> на конце.
            </p>
          </div>
        </div>

        {/* Interactive GitHub URL Checker & Cleaner */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            Проверьте вашу ссылку GitHub перед вставкой в SillyTavern:
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={githubUrlInput}
              onChange={(e) => setGithubUrlInput(e.target.value)}
              placeholder="Вставьте сюда вашу ссылку на GitHub (например: https://github.com/user/repo/tree/main)..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            {urlAnalysis?.valid && (
              <button
                type="button"
                onClick={() => handleCopyCleanUrl(urlAnalysis.cleanUrl)}
                className="min-h-[38px] px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedCleanUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Скопировать правильный URL: {urlAnalysis.cleanUrl}</span>
              </button>
            )}
          </div>
          {urlAnalysis && (
            <div
              className={`text-xs ${
                urlAnalysis.valid && !urlAnalysis.hasSubpath
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {urlAnalysis.reason}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Configuration Column */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-100">
              Параметры сборщика для SillyTavern
            </h2>
            <p className="text-sm text-slate-400">
              Настройте частоту автономной жизни НПС и глубину инжекции телефонного контекста.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Интервал автономного тика жизни НПС (сек)
              </label>
              <input
                type="number"
                min={15}
                max={600}
                value={config.autoTickIntervalSec}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    autoTickIntervalSec: Number(e.target.value) || 45,
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Глубина в промпте (Depth)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={config.injectionDepth}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      injectionDepth: Number(e.target.value) || 2,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Постов в памяти чата
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={config.maxFeedPostsInContext}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      maxFeedPostsInContext: Number(e.target.value) || 5,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
                <span className="text-xs font-medium text-slate-200">
                  Спонтанные входящие СМС от НПС
                </span>
                <input
                  type="checkbox"
                  checked={config.enableAutonomousDms}
                  onChange={(e) =>
                    onChangeConfig({ ...config, enableAutonomousDms: e.target.checked })
                  }
                  className="accent-amber-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
                <span className="text-xs font-medium text-slate-200">
                  Динамика подписчиков и отписок НПС
                </span>
                <input
                  type="checkbox"
                  checked={config.enableFollowerDynamics}
                  onChange={(e) =>
                    onChangeConfig({ ...config, enableFollowerDynamics: e.target.checked })
                  }
                  className="accent-amber-500 w-4 h-4"
                />
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => downloadSillyTavernExtensionZip(config, livePromptBlock)}
              className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Скачать чистые файлы для корня GitHub (.ZIP)</span>
            </button>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-400">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <FolderGit2 className="w-4 h-4 text-amber-400" />
                <span>Локальный путь (если ставите без GitHub):</span>
              </div>
              <code className="block font-mono text-[11px] text-amber-300 break-all">
                SillyTavern/public/scripts/extensions/third-party/st-live-phone/
              </code>
            </div>
          </div>
        </div>

        {/* Right Code Inspector Column */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['index.js', 'manifest.json', 'style.css', 'README.md'] as const).map((file) => (
                <button
                  key={file}
                  type="button"
                  onClick={() => setSelectedFile(file)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedFile === file
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {file}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[36px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать код</span>
                </>
              )}
            </button>
          </div>

          <div className="p-5 bg-slate-950 overflow-x-auto max-h-[540px] overflow-y-auto">
            <pre className="text-xs font-mono text-slate-300 leading-relaxed">
              <code>{getFileContent()}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
