/**
 * ST LivePhone — Живой смартфон и автономная соцсеть для SillyTavern
 * Полная двусторонняя синхронизация с РП-чатом (Посты, ЛС, Подписчики, Авто-жизнь НПС)
 */

const EXTENSION_NAME = "st-live-phone";
const PROMPT_KEY = "st_live_phone_context";

const defaultState = {
  enabled: true,
  autoTickIntervalSec: 60,
  injectionDepth: 2,
  activeTab: "feed",
  selectedNpcId: "char",
  userHandle: "@player_rp",
  userFollowers: 1240,
  npcs: [
    {
      id: "char",
      name: "Активный персонаж",
      handle: "@main_companion",
      bio: "Главный собеседник вашей текущей РП-сцены.",
      followers: 14800,
      isFollowed: true,
      followsUser: true,
      affinity: 65,
      mood: "На связи"
    },
    {
      id: "rival",
      name: "Маркус Торн",
      handle: "@marcus_noir",
      bio: "Владелец ночного клуба Sub-Zero и городской инсайдер.",
      followers: 29400,
      isFollowed: false,
      followsUser: true,
      affinity: 20,
      mood: "Интригует"
    },
    {
      id: "friend",
      name: "Елена Ростова",
      handle: "@dr_rostova",
      bio: "Нейроинженер и общий друг. Всегда в курсе свежих слухов.",
      followers: 8900,
      isFollowed: true,
      followsUser: true,
      affinity: 55,
      mood: "В сети"
    }
  ],
  posts: [
    {
      id: "p1",
      authorName: "Маркус Торн",
      authorHandle: "@marcus_noir",
      content: "Говорят, сегодня вечером кое-кто затеял серьезный разговор. Город маленький — все равно узнаем подробности в ленте.",
      timestamp: "10 мин назад",
      likes: 184,
      liked: false,
      comments: [
        { authorHandle: "@dr_rostova", text: "Опять ты собираешь слухи раньше времени, Маркус." }
      ]
    }
  ],
  dms: {
    char: [
      { sender: "npc", text: "Я вижу, что ты сидишь в телефоне. Только не игнорируй меня слишком долго.", time: "сейчас" }
    ],
    rival: [
      { sender: "npc", text: "Будь начеку. Если что-то пойдет не по плану — пиши сюда.", time: "5 мин назад" }
    ],
    friend: [
      { sender: "npc", text: "Привет! Как проходит ваша встреча? Напиши, когда освободишься.", time: "15 мин назад" }
    ]
  },
  logs: [
    "Расширение ST LivePhone инициализировано и связано с РП-чатом."
  ]
};

let stContext = null;
let autoTimer = null;
let isBusy = false;

function getSTContext() {
  if (window.SillyTavern && typeof window.SillyTavern.getContext === "function") {
    return window.SillyTavern.getContext();
  }
  return stContext;
}

function getState() {
  const ctx = getSTContext();
  if (ctx && ctx.extensionSettings) {
    ctx.extensionSettings[EXTENSION_NAME] = ctx.extensionSettings[EXTENSION_NAME] || JSON.parse(JSON.stringify(defaultState));
    return ctx.extensionSettings[EXTENSION_NAME];
  }
  window.__stLivePhoneFallback = window.__stLivePhoneFallback || JSON.parse(JSON.stringify(defaultState));
  return window.__stLivePhoneFallback;
}

function saveState() {
  const ctx = getSTContext();
  if (ctx && typeof ctx.saveSettingsDebounced === "function") {
    ctx.saveSettingsDebounced();
  }
  syncPromptWithRP();
  renderDrawer();
}

function syncMainCharacterName() {
  const ctx = getSTContext();
  const state = getState();
  if (ctx && ctx.name2) {
    const mainNpc = state.npcs.find((n) => n.id === "char");
    if (mainNpc) {
      mainNpc.name = ctx.name2;
      mainNpc.handle = "@" + ctx.name2.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "_").slice(0, 16);
    }
  }
  if (ctx && ctx.name1) {
    state.userHandle = "@" + ctx.name1.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "_").slice(0, 16);
  }
}

function buildPromptText() {
  syncMainCharacterName();
  const state = getState();

  const npcSummary = state.npcs
    .map(
      (n) =>
        `- ${n.name} (${n.handle}): подписчиков ${n.followers}, симпатия к {{user}}: ${n.affinity}/100, статус подписки {{user}}: ${
          n.isFollowed ? "Подписан(а)" : "НЕ подписан(а)"
        }`
    )
    .join("\n");

  const feedSummary = state.posts
    .slice(0, 4)
    .map((p) => {
      const cText =
        p.comments && p.comments.length
          ? ` | Комментарии: ${p.comments.map((c) => `${c.authorHandle}: "${c.text}"`).join("; ")}`
          : "";
      return `- [${p.timestamp}] ${p.authorName} (${p.authorHandle}, ♥ ${p.likes}${
        p.liked ? ", лайкнуто {{user}}" : ""
      }): "${p.content}"${cText}`;
    })
    .join("\n");

  const dmSummary = state.npcs
    .map((n) => {
      const list = state.dms[n.id] || [];
      const last = list[list.length - 1];
      if (!last) return null;
      const who = last.sender === "user" ? `{{user}} -> ${n.handle}` : `${n.handle} -> {{user}}`;
      return `- ЛС с ${n.name}: ${who}: "${last.text}"`;
    })
    .filter(Boolean)
    .join("\n");

  return `[ST_LIVE_PHONE_STATE — ЖИВОЙ СМАРТФОН И СОЦСЕТЬ PULSE]
Игрок {{user}} (${state.userHandle}, подписчиков: ${state.userFollowers}).
Персонажи в сети:
${npcSummary}

Последние посты в ленте смартфона:
${feedSummary}

Последние личные сообщения (ЛС) в смартфоне {{user}}:
${dmSummary}

[ИНСТРУКЦИЯ ДЛЯ РОЛЕВОГО ОТЫГРЫША]:
Телефон и РП-чат неразрывно связаны. Персонаж {{char}} знает о постах в ленте, лайках, подписках/отписках и своих личных сообщениях с {{user}} и живо реагирует на них в диалоге.`;
}

function syncPromptWithRP() {
  const ctx = getSTContext();
  const state = getState();
  if (!ctx || typeof ctx.setExtensionPrompt !== "function") return;

  if (!state.enabled) {
    ctx.setExtensionPrompt(PROMPT_KEY, "", 1, 0);
    return;
  }

  const promptBlock = buildPromptText();
  ctx.setExtensionPrompt(PROMPT_KEY, promptBlock, 1, Number(state.injectionDepth) || 2);
}

async function runQuietGeneration(promptText) {
  const ctx = getSTContext();
  if (ctx && typeof ctx.generateQuietPrompt === "function") {
    return await ctx.generateQuietPrompt(promptText, false, false);
  }
  return null;
}

async function triggerAutonomousNpcTick(reason = "auto") {
  if (isBusy) return;
  const state = getState();
  if (!state.enabled) return;

  isBusy = true;
  renderDrawer();

  try {
    syncMainCharacterName();
    const prompt = `${buildPromptText()}

Задача (причина: ${reason}): Сгенерируй ОДНО живое событие в смартфоне от лица одного из НПС (${state.npcs
      .map((n) => n.name)
      .join(", ")}) на русском языке, учитывая последние события РП-чата.
Верни ответ СТРОГО в формате чистого JSON без markdown-блоков:
{"authorId":"char или rival или friend","postContent":"текст нового поста в соцсети","commentAuthorHandle":"@хэндл","commentText":"короткий комментарий от другого НПС","dmSenderId":"char или rival или friend","dmText":"короткое СМС игроку","followersDelta":5}`;

    const raw = await runQuietGeneration(prompt);
    let parsed = null;
    if (raw) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (_e) {}
      }
    }

    const authorNpc =
      state.npcs.find((n) => n.id === (parsed && parsed.authorId)) ||
      state.npcs[Math.floor(Math.random() * state.npcs.length)];

    const newPost = {
      id: "p_" + Date.now(),
      authorName: authorNpc.name,
      authorHandle: authorNpc.handle,
      content:
        (parsed && parsed.postContent) ||
        `Ночной эфир продолжается. Кто-то сегодня явно скрывает больше, чем говорит вслух.`,
      timestamp: "только что",
      likes: Math.floor(Math.random() * 90) + 15,
      liked: false,
      comments:
        parsed && parsed.commentText
          ? [
              {
                authorHandle: parsed.commentAuthorHandle || "@dr_rostova",
                text: parsed.commentText
              }
            ]
          : []
    };

    state.posts.unshift(newPost);

    if (parsed && parsed.dmText && parsed.dmSenderId) {
      const dmTarget = state.dms[parsed.dmSenderId] ? parsed.dmSenderId : "char";
      state.dms[dmTarget].push({
        sender: "npc",
        text: parsed.dmText,
        time: "только что"
      });
    }

    state.userFollowers = Math.max(0, state.userFollowers + Number((parsed && parsed.followersDelta) || 4));
    state.logs.unshift(`[Авто-жизнь] Новый пост от ${authorNpc.handle}`);
    saveState();
  } catch (err) {
    console.warn("[ST-LivePhone] Ошибка тика:", err);
  } finally {
    isBusy = false;
    renderDrawer();
  }
}

async function sendActionIntoRPChat(actionText) {
  const textarea = document.querySelector("#send_textarea");
  const sendBtn = document.querySelector("#send_but");
  if (textarea && sendBtn) {
    textarea.value = actionText;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    sendBtn.click();
  }
}

function renderDrawer() {
  syncMainCharacterName();
  const state = getState();

  let fab = document.getElementById("st-lp-fab-btn");
  if (!fab) {
    fab = document.createElement("button");
    fab.id = "st-lp-fab-btn";
    fab.className = "st-lp-fab";
    fab.onclick = () => {
      const dr = document.getElementById("st-lp-drawer");
      if (dr) dr.classList.toggle("st-lp-open");
    };
    document.body.appendChild(fab);
  }
  fab.innerHTML = `<span>📱 Pulse OS</span><span class="st-lp-badge">${state.posts.length}</span>`;

  let drawer = document.getElementById("st-lp-drawer");
  if (!drawer) {
    drawer = document.createElement("div");
    drawer.id = "st-lp-drawer";
    document.body.appendChild(drawer);
  }

  let bodyHtml = "";

  if (state.activeTab === "feed") {
    const postsHtml = state.posts
      .map(
        (p) => `
      <div class="st-lp-card">
        <div class="st-lp-card-head">
          <div>
            <span class="st-lp-author">${p.authorName}</span>
            <span class="st-lp-handle">${p.authorHandle}</span>
          </div>
          <span style="color:#64748b;font-size:10px;">${p.timestamp}</span>
        </div>
        <div class="st-lp-text">${p.content}</div>
        ${
          p.comments && p.comments.length
            ? `<div class="st-lp-comments">${p.comments
                .map((c) => `<div><strong style="color:#f59e0b;">${c.authorHandle}:</strong> ${c.text}</div>`)
                .join("")}</div>`
            : ""
        }
        <div class="st-lp-actions">
          <button class="st-lp-btn" data-lp-like="${p.id}">♥ ${p.likes} ${p.liked ? "(Вы)" : ""}</button>
          <button class="st-lp-btn" data-lp-showrp="${p.id}">Показать в РП</button>
        </div>
        <div style="display:flex;gap:6px;margin-top:4px;">
          <input class="st-lp-input" id="st-lp-cinput-${p.id}" placeholder="Комментарий..." />
          <button class="st-lp-btn-primary" data-lp-comment="${p.id}">→</button>
        </div>
      </div>`
      )
      .join("");

    bodyHtml = `
      <div class="st-lp-card">
        <div style="font-size:11px;font-weight:700;color:#cbd5e1;">Опубликовать пост (${state.userHandle})</div>
        <textarea class="st-lp-textarea" id="st-lp-newpost" rows="2" placeholder="Что происходит в РП?..."></textarea>
        <button class="st-lp-btn-primary" id="st-lp-pub-btn" ${isBusy ? "disabled" : ""}>Выложить в ленту</button>
      </div>
      ${postsHtml}
    `;
  } else if (state.activeTab === "dms") {
    const currentNpc = state.npcs.find((n) => n.id === state.selectedNpcId) || state.npcs[0];
    const msgs = state.dms[currentNpc.id] || [];

    bodyHtml = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${state.npcs
          .map(
            (n) =>
              `<button class="st-lp-btn" data-lp-selectnpc="${n.id}" style="${
                n.id === currentNpc.id ? "border-color:#f59e0b;color:#f59e0b;" : ""
              }">${n.name}</button>`
          )
          .join("")}
      </div>
      <div class="st-lp-card" style="flex:1;overflow-y:auto;max-height:360px;">
        ${msgs
          .map(
            (m) => `
          <div style="align-self:${m.sender === "user" ? "flex-end" : "flex-start"};background:${
              m.sender === "user" ? "#f59e0b" : "#1e293b"
            };color:${
              m.sender === "user" ? "#090d16" : "#f8fafc"
            };padding:8px 11px;border-radius:12px;max-width:85%;font-size:12px;">
            ${m.text}
          </div>`
          )
          .join("")}
      </div>
      <div style="display:flex;gap:6px;">
        <input class="st-lp-input" id="st-lp-dminput" placeholder="Написать ${currentNpc.name}..." />
        <button class="st-lp-btn-primary" id="st-lp-dmsend" ${isBusy ? "disabled" : ""}>Отпр.</button>
      </div>
    `;
  } else if (state.activeTab === "subs") {
    bodyHtml = `
      <div class="st-lp-card">
        <div class="st-lp-author">Ваш профиль: ${state.userHandle}</div>
        <div style="font-size:12px;color:#f59e0b;">Подписчиков: ${state.userFollowers}</div>
      </div>
      ${state.npcs
        .map(
          (n) => `
        <div class="st-lp-card">
          <div class="st-lp-card-head">
            <div>
              <div class="st-lp-author">${n.name}</div>
              <div class="st-lp-handle">${n.handle} · ${n.followers} подп.</div>
            </div>
            <button class="st-lp-btn-primary" data-lp-follow="${n.id}">
              ${n.isFollowed ? "Отписаться" : "Подписаться"}
            </button>
          </div>
          <div class="st-lp-text">${n.bio}</div>
          <div style="font-size:11px;color:#94a3b8;">Симпатия к вам: ${n.affinity}/100</div>
        </div>`
        )
        .join("")}
    `;
  } else {
    bodyHtml = `
      <div class="st-lp-card">
        <div class="st-lp-author">Автономная жизнь НПС</div>
        <div class="st-lp-text">Персонажи сами публикуют посты, комментируют и пишут вам в ЛС, а все события автоматически попадают в память SillyTavern.</div>
        <button class="st-lp-btn-primary" id="st-lp-force-tick" ${isBusy ? "disabled" : ""}>
          ${isBusy ? "Генерация события..." : "⚡ Сгенерировать активность НПС сейчас"}
        </button>
      </div>
      <div class="st-lp-card">
        <div class="st-lp-author">Журнал синхронизации с РП</div>
        ${state.logs.slice(0, 8).map((l) => `<div style="font-size:11px;color:#94a3b8;">• ${l}</div>`).join("")}
      </div>
    `;
  }

  drawer.innerHTML = `
    <div class="st-lp-statusbar">
      <span>Pulse 5G · SillyTavern Bridge</span>
      <span>${isBusy ? "Синхронизация..." : "Онлайн"}</span>
    </div>
    <div class="st-lp-header">
      <div>
        <div class="st-lp-title">Живой Телефон</div>
        <div class="st-lp-subtitle">${state.userHandle} · ${state.userFollowers} подп.</div>
      </div>
      <button class="st-lp-btn" id="st-lp-quick-tick" title="Шаг жизни НПС">↻ Шаг НПС</button>
    </div>
    <div class="st-lp-body">${bodyHtml}</div>
    <div class="st-lp-nav">
      <button class="st-lp-tab ${state.activeTab === "feed" ? "active" : ""}" data-lp-tab="feed">Лента</button>
      <button class="st-lp-tab ${state.activeTab === "dms" ? "active" : ""}" data-lp-tab="dms">Сообщения</button>
      <button class="st-lp-tab ${state.activeTab === "subs" ? "active" : ""}" data-lp-tab="subs">Подписки</button>
      <button class="st-lp-tab ${state.activeTab === "auto" ? "active" : ""}" data-lp-tab="auto">Авто-жизнь</button>
    </div>
  `;

  bindDrawerEvents(drawer);
}

function bindDrawerEvents(drawer) {
  const state = getState();

  drawer.querySelectorAll("[data-lp-tab]").forEach((btn) => {
    btn.onclick = () => {
      state.activeTab = btn.getAttribute("data-lp-tab");
      saveState();
    };
  });

  const quickTick = drawer.querySelector("#st-lp-quick-tick");
  if (quickTick) quickTick.onclick = () => triggerAutonomousNpcTick("manual_button");

  const forceTick = drawer.querySelector("#st-lp-force-tick");
  if (forceTick) forceTick.onclick = () => triggerAutonomousNpcTick("manual_force");

  const pubBtn = drawer.querySelector("#st-lp-pub-btn");
  if (pubBtn) {
    pubBtn.onclick = async () => {
      const inp = drawer.querySelector("#st-lp-newpost");
      const text = inp ? inp.value.trim() : "";
      if (!text) return;
      state.posts.unshift({
        id: "p_u_" + Date.now(),
        authorName: "Вы",
        authorHandle: state.userHandle,
        content: text,
        timestamp: "только что",
        likes: 1,
        liked: true,
        comments: []
      });
      state.logs.unshift(`[Пост] Вы опубликовали: "${text.slice(0, 30)}..."`);
      saveState();
      await triggerAutonomousNpcTick("user_published_post");
    };
  }

  drawer.querySelectorAll("[data-lp-like]").forEach((btn) => {
    btn.onclick = () => {
      const pid = btn.getAttribute("data-lp-like");
      const post = state.posts.find((p) => p.id === pid);
      if (post) {
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        state.logs.unshift(`[Лайк] Вы оценили пост ${post.authorHandle}`);
        saveState();
      }
    };
  });

  drawer.querySelectorAll("[data-lp-showrp]").forEach((btn) => {
    btn.onclick = () => {
      const pid = btn.getAttribute("data-lp-showrp");
      const post = state.posts.find((p) => p.id === pid);
      if (post) {
        sendActionIntoRPChat(
          `*Показываю экран смартфона с постом от ${post.authorHandle}: «${post.content}»* — Посмотри, что пишут в ленте.`
        );
      }
    };
  });

  drawer.querySelectorAll("[data-lp-comment]").forEach((btn) => {
    btn.onclick = async () => {
      const pid = btn.getAttribute("data-lp-comment");
      const inp = drawer.querySelector(`#st-lp-cinput-${pid}`);
      const text = inp ? inp.value.trim() : "";
      const post = state.posts.find((p) => p.id === pid);
      if (post && text) {
        post.comments.push({ authorHandle: state.userHandle, text });
        state.logs.unshift(`[Комментарий] Вы ответили под постом ${post.authorHandle}`);
        saveState();
      }
    };
  });

  drawer.querySelectorAll("[data-lp-selectnpc]").forEach((btn) => {
    btn.onclick = () => {
      state.selectedNpcId = btn.getAttribute("data-lp-selectnpc");
      saveState();
    };
  });

  const dmSend = drawer.querySelector("#st-lp-dmsend");
  if (dmSend) {
    dmSend.onclick = async () => {
      const inp = drawer.querySelector("#st-lp-dminput");
      const text = inp ? inp.value.trim() : "";
      if (!text) return;
      const npc = state.npcs.find((n) => n.id === state.selectedNpcId) || state.npcs[0];
      state.dms[npc.id] = state.dms[npc.id] || [];
      state.dms[npc.id].push({ sender: "user", text, time: "только что" });
      state.logs.unshift(`[ЛС] Вы написали ${npc.handle}: "${text.slice(0, 25)}..."`);
      saveState();

      const replyRaw = await runQuietGeneration(
        `${buildPromptText()}\nИгрок {{user}} только что прислал личное сообщение (СМС) персонажу ${npc.name} (${npc.handle}): "${text}". Напиши короткий ответ (1-2 предложения) от лица ${npc.name} для мессенджера.`
      );
      if (replyRaw) {
        state.dms[npc.id].push({ sender: "npc", text: replyRaw.trim(), time: "только что" });
        saveState();
      }
    };
  }

  drawer.querySelectorAll("[data-lp-follow]").forEach((btn) => {
    btn.onclick = () => {
      const nid = btn.getAttribute("data-lp-follow");
      const npc = state.npcs.find((n) => n.id === nid);
      if (npc) {
        npc.isFollowed = !npc.isFollowed;
        npc.followers += npc.isFollowed ? 1 : -1;
        npc.affinity += npc.isFollowed ? 5 : -8;
        state.logs.unshift(
          `[Подписки] Вы ${npc.isFollowed ? "подписались на" : "отписались от"} ${npc.handle}`
        );
        saveState();
      }
    };
  });
}

(function initSTLivePhone() {
  const start = () => {
    syncPromptWithRP();
    renderDrawer();

    const ctx = getSTContext();
    if (ctx && ctx.eventSource && ctx.event_types) {
      ctx.eventSource.on(ctx.event_types.MESSAGE_RECEIVED, () => {
        syncPromptWithRP();
        triggerAutonomousNpcTick("rp_message_received");
      });
      ctx.eventSource.on(ctx.event_types.MESSAGE_SENT, () => {
        syncPromptWithRP();
      });
      if (ctx.event_types.CHAT_CHANGED) {
        ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, () => {
          syncMainCharacterName();
          syncPromptWithRP();
          renderDrawer();
        });
      }
    }

    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      const state = getState();
      if (state.enabled) {
        triggerAutonomousNpcTick("timer_interval");
      }
    }, 90000);

    console.log("[ST-LivePhone] Расширение успешно загружено!");
  };

  if (window.jQuery) {
    window.jQuery(start);
  } else {
    window.addEventListener("DOMContentLoaded", start);
  }
})();
