import JSZip from 'jszip';
import { NpcProfile, SocialPost, DirectMessage } from '../data/initialWorld';

export interface ExtensionConfig {
  extensionName: string;
  autoTickIntervalSec: number;
  injectionDepth: number;
  injectionPosition: 'in_chat' | 'before_prompt' | 'after_char_defs';
  maxFeedPostsInContext: number;
  enableAutonomousDms: boolean;
  enableFollowerDynamics: boolean;
}

export function buildSillyTavernPromptInjection(
  userHandle: string,
  userFollowers: number,
  npcs: Record<'kira' | 'marcus' | 'elena', NpcProfile>,
  posts: SocialPost[],
  dms: Record<'kira' | 'marcus' | 'elena', DirectMessage[]>,
  maxPosts = 4
): string {
  const npcLines = Object.values(npcs)
    .map(
      (n) =>
        `- ${n.name} (${n.handle}): подписчиков ${n.followers}, отношение к {{user}}: ${n.affinity}/100 (${n.mood}), статус подписки {{user}}: ${
          n.isFollowedByUser ? 'Подписан(а)' : 'НЕ подписан(а)'
        }, статус: "${n.statusText}"`
    )
    .join('\n');

  const recentPosts = posts
    .slice(0, maxPosts)
    .map((p) => {
      const commentStr =
        p.comments.length > 0
          ? ` | Комментарии: ${p.comments.map((c) => `${c.authorHandle}: "${c.text}"`).join('; ')}`
          : '';
      return `- [${p.timestamp}] ${p.authorHandle} (${p.location}, ♥ ${p.likes}${
        p.isLikedByUser ? ', лайкнуто {{user}}' : ''
      }): "${p.content}"${commentStr}`;
    })
    .join('\n');

  const recentDms = Object.entries(dms)
    .map(([npcId, list]) => {
      const last = list[list.length - 1];
      const npc = npcs[npcId as 'kira' | 'marcus' | 'elena'];
      if (!last || !npc) return null;
      const who = last.senderId === 'user' ? '{{user}} -> ' + npc.handle : npc.handle + ' -> {{user}}';
      return `- Чат с ${npc.name}: [${ last.timestamp }] ${who}: "${last.text}" (${last.read ? 'прочитано' : 'НЕ ПРОЧИТАНО'})`;
    })
    .filter(Boolean)
    .join('\n');

  return `[ST_LIVE_PHONE_STATE — АКТУАЛЬНЫЙ КОНТЕКСТ СМАРТФОНА И СОЦСЕТИ PULSE]
Профиль игрока {{user}}: ${userHandle} (Подписчиков: ${userFollowers})
Состояние НПС в сети:
${npcLines}

Последние посты в ленте Pulse:
${recentPosts}

Последние личные сообщения (ЛС) в смартфоне {{user}}:
${recentDms}

[ДИРЕКТИВА СИНХРОНИЗАЦИИ ДЛЯ МОДЕЛИ]:
Персонажи в РП-сцене осведомлены о публичных постах, лайках, подписках/отписках в ленте Pulse и о своих личных переписках с {{user}}. Органично вплетай реакцию на события в смартфоне в ролевой отыгрыш.`;
}

export function generateManifestJson(config: ExtensionConfig): string {
  return JSON.stringify(
    {
      display_name: config.extensionName || 'ST LivePhone — Autonomous Social & Messenger',
      loading_order: 45,
      requires: [],
      optional: [],
      js: 'index.js',
      css: 'style.css',
      author: 'ST LivePhone Studio',
      version: '1.4.0',
      homePage: 'https://github.com/sillytavern-livephone/st-live-phone',
      auto_update: true,
    },
    null,
    2
  );
}

export function generateExtensionIndexJs(
  config: ExtensionConfig,
  initialPromptBlock: string
): string {
  return `/**
 * ST LivePhone — Расширение живого смартфона и автономной соцсети для SillyTavern
 * Полная двусторонняя связь с РП-чатом через setExtensionPrompt и generateQuietPrompt
 */
import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types, generateQuietPrompt } from "../../../../script.js";

const EXTENSION_NAME = "st-live-phone";
const PROMPT_KEY = "st_live_phone_context";

const defaultSettings = {
  enabled: true,
  autoTickIntervalSec: ${config.autoTickIntervalSec},
  injectionDepth: ${config.injectionDepth},
  injectionPosition: "${config.injectionPosition}",
  maxFeedPostsInContext: ${config.maxFeedPostsInContext},
  enableAutonomousDms: ${config.enableAutonomousDms},
  enableFollowerDynamics: ${config.enableFollowerDynamics},
  phoneState: {
    userHandle: "@player_one",
    userFollowers: 1240,
    feed: [],
    dms: {},
    subscriptions: {}
  }
};

let autonomousTimer = null;

function loadSettings() {
  extension_settings[EXTENSION_NAME] = extension_settings[EXTENSION_NAME] || {};
  for (const [key, val] of Object.entries(defaultSettings)) {
    if (extension_settings[EXTENSION_NAME][key] === undefined) {
      extension_settings[EXTENSION_NAME][key] = val;
    }
  }
}

/**
 * Инжектирует актуальное состояние смартфона (посты, ЛС, подписки) прямо в промпт SillyTavern
 */
function syncPhoneContextToSillyTavern() {
  const context = getContext();
  const settings = extension_settings[EXTENSION_NAME];
  if (!settings.enabled) {
    context.setExtensionPrompt(PROMPT_KEY, "", 1, 0);
    return;
  }

  const stateBlock = buildLivePhonePrompt(settings.phoneState);
  // Позиция 1 = In-chat @ depth, гарантирует что персонаж видит события телефона прямо перед ответом
  context.setExtensionPrompt(
    PROMPT_KEY,
    stateBlock,
    1,
    settings.injectionDepth || 2
  );
}

function buildLivePhonePrompt(state) {
  return \`${initialPromptBlock.replace(/`/g, '\\`')}\`;
}

/**
 * Автономный цикл жизни НПС: генерирует случайные посты, комментарии, подписки и входящие ЛС без участия игрока
 */
async function triggerAutonomousNpcLifeTick(reason = "autonomous_timer") {
  const settings = extension_settings[EXTENSION_NAME];
  if (!settings.enabled) return;

  const quietInstruction = \`[SYSTEM: Сгенерируй в формате JSON одно автономное действие НПС в смартфоне (новый пост в ленте, комментарий к последнему событию чата или спонтанное ЛС для {{user}}), учитывая текущий контекст РП-сцены. Причина: \${reason}]\`;

  try {
    const rawJson = await generateQuietPrompt(quietInstruction, false, false);
    if (rawJson) {
      console.log("[ST-LivePhone] Autonomous tick generated:", rawJson);
      syncPhoneContextToSillyTavern();
      renderPhoneOverlayUI();
    }
  } catch (err) {
    console.warn("[ST-LivePhone] Quiet prompt tick skipped:", err);
  }
}

function startAutonomousLoop() {
  if (autonomousTimer) clearInterval(autonomousTimer);
  const sec = extension_settings[EXTENSION_NAME]?.autoTickIntervalSec || ${config.autoTickIntervalSec};
  autonomousTimer = setInterval(() => {
    triggerAutonomousNpcLifeTick("background_autonomous_life");
  }, sec * 1000);
}

function renderPhoneOverlayUI() {
  let toggleBtn = document.getElementById("st-livephone-fab");
  if (!toggleBtn) {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "st-livephone-fab";
    toggleBtn.className = "st-livephone-fab";
    toggleBtn.innerHTML = "<span>Pulse OS</span>";
    toggleBtn.onclick = () => {
      const panel = document.getElementById("st-livephone-drawer");
      if (panel) panel.classList.toggle("open");
    };
    document.body.appendChild(toggleBtn);
  }
}

jQuery(async () => {
  loadSettings();
  renderPhoneOverlayUI();
  syncPhoneContextToSillyTavern();
  startAutonomousLoop();

  // После каждого сообщения в РП-чате обновляем телефон и проверяем реакцию НПС
  eventSource.on(event_types.MESSAGE_RECEIVED, () => {
    syncPhoneContextToSillyTavern();
    triggerAutonomousNpcLifeTick("rp_message_received");
  });

  eventSource.on(event_types.MESSAGE_SENT, () => {
    syncPhoneContextToSillyTavern();
  });

  console.log("[ST-LivePhone] Расширение живого телефона успешно инициализировано.");
});
`;
}

export function generateExtensionStyleCss(): string {
  return `.st-livephone-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9998;
  background: #0f172a;
  color: #f8fafc;
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 14px;
  padding: 10px 18px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.st-livephone-fab:hover {
  transform: translateY(-2px);
  border-color: #f59e0b;
}

#st-livephone-drawer {
  position: fixed;
  top: 60px;
  right: 24px;
  width: 380px;
  height: 740px;
  max-height: calc(100vh - 100px);
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 32px;
  z-index: 9999;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
`;
}

export function generateReadmeMd(config: ExtensionConfig): string {
  return `# ${config.extensionName} (SillyTavern Extension)

Живой смартфон и автономная социальная сеть для **SillyTavern**, неразрывно связанная с вашим ролевым чатом.

## Возможности
- **Автономная жизнь НПС**: Персонажи публикуют посты, комментируют друг друга, подписываются/отписываются и пишут вам в личные сообщения без вашего постоянного вмешательства (интервал тика: \`${config.autoTickIntervalSec} сек\`).
- **Двусторонняя связь с РП-чатом**: Каждое событие в телефоне автоматически инжектируется в промпт SillyTavern через \`setExtensionPrompt('st_live_phone_context', ...)\` на глубину \`${config.injectionDepth}\`.
- **Реакция на действия игрока**: Если вы лайкнете пост соперника, отпишетесь от персонажа или напишете кому-то в ЛС прямо во время диалога, персонаж в РП-чате заметит это и отыграет реакцию.

## Установка в SillyTavern
1. Распакуйте архив \`st-live-phone.zip\` в папку расширений вашего SillyTavern:
   \`SillyTavern/public/scripts/extensions/third-party/st-live-phone/\`
2. Перезапустите страницу SillyTavern (или обновите список расширений во вкладке **Extensions**).
3. Нажмите кнопку **Pulse OS** в правом нижнем углу экрана, чтобы открыть живой смартфон рядом с чатом.
`;
}

export async function downloadSillyTavernExtensionZip(
  config: ExtensionConfig,
  initialPromptBlock: string
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('st-live-phone');
  if (!folder) return;

  folder.file('manifest.json', generateManifestJson(config));
  folder.file('index.js', generateExtensionIndexJs(config, initialPromptBlock));
  folder.file('style.css', generateExtensionStyleCss());
  folder.file('README.md', generateReadmeMd(config));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'st-live-phone-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
