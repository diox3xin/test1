import React, { useState } from 'react';
import { Download, Copy, Check, FileCode, FolderGit2 } from 'lucide-react';
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Configuration Column */}
      <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-100">
            Параметры сборщика для SillyTavern
          </h2>
          <p className="text-sm text-slate-400">
            Настройте частоту автономной жизни НПС и глубину инжекции телефонного контекста перед скачиванием готового расширения.
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
            <span>Скачать архив st-live-phone.zip</span>
          </button>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-400">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-amber-400" />
              <span>Путь установки в SillyTavern:</span>
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
  );
};
