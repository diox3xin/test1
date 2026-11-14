import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Sparkles,
  Download,
  RefreshCw,
  ArrowLeftRight,
  Copy,
  Check,
  UserPlus,
  MessageSquare,
} from 'lucide-react';
import {
  INITIAL_NPCS,
  INITIAL_POSTS,
  INITIAL_DMS,
  INITIAL_RP_MESSAGES,
  INITIAL_SYNC_EVENTS,
  ASSETS,
  NpcProfile,
  SocialPost,
  DirectMessage,
  RpChatMessage,
  SyncBridgeEvent,
} from './data/initialWorld';
import {
  ExtensionConfig,
  buildSillyTavernPromptInjection,
  downloadSillyTavernExtensionZip,
} from './utils/stExtensionBuilder';
import { LiveSmartphone } from './components/LiveSmartphone';
import { ExtensionExporterView } from './components/ExtensionExporterView';

export default function App() {
  const [activeNav, setActiveNav] = useState<'workspace' | 'matrix' | 'prompt' | 'export'>('workspace');

  // Player & World State
  const [userHandle] = useState('@player_one');
  const [userFollowers, setUserFollowers] = useState(1240);
  const [npcs, setNpcs] = useState<Record<'kira' | 'marcus' | 'elena', NpcProfile>>(INITIAL_NPCS);
  const [posts, setPosts] = useState<SocialPost[]>(INITIAL_POSTS);
  const [dms, setDms] = useState<Record<'kira' | 'marcus' | 'elena', DirectMessage[]>>(INITIAL_DMS);
  const [rpMessages, setRpMessages] = useState<RpChatMessage[]>(INITIAL_RP_MESSAGES);
  const [syncEvents, setSyncEvents] = useState<SyncBridgeEvent[]>(INITIAL_SYNC_EVENTS);

  // Inputs & Simulation state
  const [rpInput, setRpInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [autoLifeEnabled, setAutoLifeEnabled] = useState(true);
  const [secondsUntilNextTick, setSecondsUntilNextTick] = useState(40);
  const [phoneToast, setPhoneToast] = useState<string | null>(null);
  const [apiErrorBanner, setApiErrorBanner] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // SillyTavern Extension Config
  const [extConfig, setExtConfig] = useState<ExtensionConfig>({
    extensionName: 'ST LivePhone — Autonomous Social & Messenger',
    autoTickIntervalSec: 40,
    injectionDepth: 2,
    injectionPosition: 'in_chat',
    maxFeedPostsInContext: 5,
    enableAutonomousDms: true,
    enableFollowerDynamics: true,
  });

  const rpChatEndRef = useRef<HTMLDivElement>(null);

  const showPhoneNotification = useCallback((text: string) => {
    setPhoneToast(text);
    setTimeout(() => {
      setPhoneToast((prev) => (prev === text ? null : prev));
    }, 4500);
  }, []);

  const currentPromptBlock = buildSillyTavernPromptInjection(
    userHandle,
    userFollowers,
    npcs,
    posts,
    dms,
    extConfig.maxFeedPostsInContext
  );

  const nowTimeShort = () => {
    const d = new Date();
    return d.toTimeString().slice(0, 5);
  };

  const nowTimeFull = () => {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  };

  // Helper to resolve NPC id safely
  const normalizeNpcId = (raw?: string): 'kira' | 'marcus' | 'elena' => {
    const l = (raw || '').toLowerCase();
    if (l.includes('marcus') || l.includes('маркус')) return 'marcus';
    if (l.includes('elena') || l.includes('елена')) return 'elena';
    return 'kira';
  };

  // 1. Autonomous Background Life Tick
  const handleTriggerAutonomousTick = useCallback(
    async (reason = 'autonomous_timer') => {
      if (isSimulating) return;
      setIsSimulating(true);
      setApiErrorBanner(null);

      try {
        const response = await fetch('/api/autonomous-tick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            triggerReason: reason,
            phoneSummary: currentPromptBlock,
            rpHistory: rpMessages.map((m) => ({ sender: m.senderName, text: m.text })),
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Ошибка сервера (${response.status})`);
        }

        const data = await response.json();
        const authorKey = normalizeNpcId(data.postAuthorId);
        const commentKey = normalizeNpcId(data.commentAuthorId);

        setNpcs((prevNpcs) => {
          const authorNpc = prevNpcs[authorKey];
          const commentNpc = prevNpcs[commentKey];

          const newPostObj: SocialPost = {
            id: 'post-' + Date.now(),
            authorId: authorKey,
            authorName: authorNpc.name,
            authorHandle: authorNpc.handle,
            authorAvatar: authorNpc.avatar,
            content: data.postContent || 'Ночной город никогда не спит.',
            location: data.postLocation || 'Сектор-7',
            timestamp: 'только что',
            likes: data.postLikes || 128,
            isLikedByUser: false,
            rpImpactNote: data.eventSummary,
            comments: data.commentText
              ? [
                  {
                    id: 'c-' + Date.now(),
                    authorId: commentKey,
                    authorName: commentNpc.name,
                    authorHandle: commentNpc.handle,
                    text: data.commentText,
                    timestamp: 'только что',
                  },
                ]
              : [],
          };

          setPosts((prev) => [newPostObj, ...prev]);
          showPhoneNotification(`Новый пост от ${authorNpc.handle}`);

          return {
            ...prevNpcs,
            kira: {
              ...prevNpcs.kira,
              followers: Math.max(0, prevNpcs.kira.followers + (data.followerDeltaMap?.kiraDelta || 4)),
            },
            marcus: {
              ...prevNpcs.marcus,
              followers: Math.max(0, prevNpcs.marcus.followers + (data.followerDeltaMap?.marcusDelta || 7)),
            },
            elena: {
              ...prevNpcs.elena,
              followers: Math.max(0, prevNpcs.elena.followers + (data.followerDeltaMap?.elenaDelta || 2)),
            },
          };
        });

        if (data.followerDeltaMap?.userDelta) {
          setUserFollowers((f) => Math.max(0, f + data.followerDeltaMap.userDelta));
        }

        if (data.spontaneousDm?.shouldSend && data.spontaneousDm?.text) {
          const dmSender = normalizeNpcId(data.spontaneousDm.senderId);
          setDms((prev) => ({
            ...prev,
            [dmSender]: [
              ...prev[dmSender],
              {
                id: 'dm-' + Date.now(),
                senderId: dmSender,
                text: data.spontaneousDm.text,
                timestamp: nowTimeShort(),
                read: false,
              },
            ],
          }));
          showPhoneNotification(`Новое СМС от @${dmSender}`);
        }

        if (data.ambientRpReaction) {
          setRpMessages((prev) => [
            ...prev,
            {
              id: 'rp-auto-' + Date.now(),
              senderId: 'kira',
              senderName: 'Кира Вэнс',
              avatar: ASSETS.kiraAvatar,
              timestamp: nowTimeShort(),
              linkedPhoneEvent: `Автономное событие: ${data.eventSummary || 'активность в Pulse'}`,
              text: data.ambientRpReaction,
            },
          ]);
        }

        setSyncEvents((prev) => [
          {
            id: 'sync-' + Date.now(),
            timestamp: nowTimeFull(),
            direction: 'AUTONOMOUS_LIFE',
            summary: data.eventSummary || 'НПС опубликовали новый пост и обменялись комментариями',
            contextDelta: 'Контекст SillyTavern автоматически обновлен новыми данными из ленты.',
          },
          ...prev,
        ]);
      } catch (err: any) {
        setApiErrorBanner(err?.message || 'Не удалось выполнить тик симуляции.');
      } finally {
        setIsSimulating(false);
        setSecondsUntilNextTick(extConfig.autoTickIntervalSec);
      }
    },
    [isSimulating, currentPromptBlock, rpMessages, extConfig.autoTickIntervalSec, showPhoneNotification]
  );

  // Autonomous countdown effect
  useEffect(() => {
    if (!autoLifeEnabled) return;
    const timer = setInterval(() => {
      setSecondsUntilNextTick((prev) => {
        if (prev <= 1) {
          handleTriggerAutonomousTick('scheduled_autonomous_life');
          return extConfig.autoTickIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoLifeEnabled, extConfig.autoTickIntervalSec, handleTriggerAutonomousTick]);

  // 2. Send RP Chat Message -> Coupled with Phone Side Effects
  const handleSendRpMessage = async (customText?: string) => {
    const messageToSend = (customText ?? rpInput).trim();
    if (!messageToSend || isSimulating) return;

    const userMsg: RpChatMessage = {
      id: 'rp-u-' + Date.now(),
      senderId: 'user',
      senderName: 'Вы ({{user}})',
      timestamp: nowTimeShort(),
      text: messageToSend,
    };

    const updatedHistory = [...rpMessages, userMsg];
    setRpMessages(updatedHistory);
    if (!customText) setRpInput('');
    setIsSimulating(true);
    setApiErrorBanner(null);

    try {
      const response = await fetch('/api/rp-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageToSend,
          activeCharacterId: 'kira',
          phoneSummary: currentPromptBlock,
          rpHistory: updatedHistory.map((m) => ({ sender: m.senderName, text: m.text })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера (${response.status})`);
      }

      const data = await response.json();

      // Add Kira's RP Reply
      setRpMessages((prev) => [
        ...prev,
        {
          id: 'rp-k-' + Date.now(),
          senderId: 'kira',
          senderName: 'Кира Вэнс',
          avatar: ASSETS.kiraAvatar,
          timestamp: nowTimeShort(),
          linkedPhoneEvent: data.bridgeLog,
          text: data.rpReply,
        },
      ]);

      // Update Kira's affinity and mood
      setNpcs((prev) => ({
        ...prev,
        kira: {
          ...prev.kira,
          mood: data.characterMood || prev.kira.mood,
          affinity: Math.max(-100, Math.min(100, prev.kira.affinity + (data.affinityDelta || 0))),
        },
      }));

      if (data.userFollowersDelta) {
        setUserFollowers((f) => Math.max(0, f + data.userFollowersDelta));
      }

      // Check if RP action spawned a new social post
      if (data.newPost?.shouldCreate && data.newPost?.content) {
        const postAuthorKey = normalizeNpcId(data.newPost.authorId);
        const authorObj = npcs[postAuthorKey];
        const commentKey = normalizeNpcId(data.newPost.firstCommentAuthorId);
        const commentObj = npcs[commentKey];

        const createdPost: SocialPost = {
          id: 'post-rp-' + Date.now(),
          authorId: postAuthorKey,
          authorName: authorObj.name,
          authorHandle: authorObj.handle,
          authorAvatar: authorObj.avatar,
          content: data.newPost.content,
          location: data.newPost.location || 'Кафе «Амбер»',
          timestamp: 'только что',
          likes: data.newPost.initialLikes || 95,
          isLikedByUser: false,
          rpImpactNote: data.bridgeLog,
          comments: data.newPost.firstCommentText
            ? [
                {
                  id: 'c-rp-' + Date.now(),
                  authorId: commentKey,
                  authorName: commentObj.name,
                  authorHandle: commentObj.handle,
                  text: data.newPost.firstCommentText,
                  timestamp: 'только что',
                },
              ]
            : [],
        };

        setPosts((prev) => [createdPost, ...prev]);
        showPhoneNotification(`${authorObj.handle} выложил(а) пост по итогам сцены`);
      }

      // Check if RP action triggered a new DM
      if (data.newDm?.shouldSend && data.newDm?.text) {
        const senderKey = normalizeNpcId(data.newDm.senderId);
        setDms((prev) => ({
          ...prev,
          [senderKey]: [
            ...prev[senderKey],
            {
              id: 'dm-rp-' + Date.now(),
              senderId: senderKey,
              text: data.newDm.text,
              timestamp: nowTimeShort(),
              read: false,
            },
          ],
        }));
        showPhoneNotification(`Новое сообщение от ${npcs[senderKey].handle}`);
      }

      setSyncEvents((prev) => [
        {
          id: 'sync-rp-' + Date.now(),
          timestamp: nowTimeFull(),
          direction: 'RP_TO_PHONE',
          summary: data.bridgeLog || 'Событие РП-чата синхронизировано с телефоном',
          contextDelta: `Настроение Киры: ${data.characterMood || 'Обновлено'} (Δ симпатии: ${
            data.affinityDelta >= 0 ? '+' : ''
          }${data.affinityDelta || 0})`,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setApiErrorBanner(err?.message || 'Ошибка при генерации ответа РП.');
    } finally {
      setIsSimulating(false);
    }
  };

  // 3. Phone Actions -> Immediate NPC response + RP Chat ripple
  const triggerPhoneActionRipple = async (
    actionType: string,
    targetNpcId: 'kira' | 'marcus' | 'elena',
    payloadText: string,
    attachCommentToPostId?: string
  ) => {
    setIsSimulating(true);
    setApiErrorBanner(null);

    try {
      const response = await fetch('/api/phone-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          targetNpcId,
          payloadText,
          phoneSummary: currentPromptBlock,
          rpHistory: rpMessages.map((m) => ({ sender: m.senderName, text: m.text })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера (${response.status})`);
      }

      const data = await response.json();
      const responderKey = normalizeNpcId(data.npcResponderId || targetNpcId);
      const responderNpc = npcs[responderKey];

      if (actionType === 'SEND_DM' && data.npcReplyText) {
        setDms((prev) => ({
          ...prev,
          [targetNpcId]: [
            ...prev[targetNpcId],
            {
              id: 'dm-reply-' + Date.now(),
              senderId: targetNpcId,
              text: data.npcReplyText,
              timestamp: nowTimeShort(),
              read: true,
            },
          ],
        }));
        showPhoneNotification(`${npcs[targetNpcId].handle} ответил(а) в ЛС`);
      } else if (attachCommentToPostId && data.npcReplyText) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== attachCommentToPostId) return p;
            const updatedComments = [
              ...p.comments,
              {
                id: 'c-npc-' + Date.now(),
                authorId: responderKey,
                authorName: responderNpc.name,
                authorHandle: responderNpc.handle,
                text: data.npcReplyText,
                timestamp: 'только что',
              },
            ];
            if (data.secondaryCommentText && data.secondaryCommentAuthorId) {
              const secKey = normalizeNpcId(data.secondaryCommentAuthorId);
              const secNpc = npcs[secKey];
              updatedComments.push({
                id: 'c-npc2-' + Date.now(),
                authorId: secKey,
                authorName: secNpc.name,
                authorHandle: secNpc.handle,
                text: data.secondaryCommentText,
                timestamp: 'только что',
              });
            }
            return { ...p, comments: updatedComments };
          })
        );
        showPhoneNotification(`${responderNpc.handle} прокомментировал(а) запись`);
      }

      // Add physical RP Chat reaction from Kira
      if (data.rpChatReaction) {
        setRpMessages((prev) => [
          ...prev,
          {
            id: 'rp-ripple-' + Date.now(),
            senderId: 'kira',
            senderName: 'Кира Вэнс',
            avatar: ASSETS.kiraAvatar,
            timestamp: nowTimeShort(),
            linkedPhoneEvent: data.bridgeLog || 'Реакция на ваше действие в смартфоне',
            text: data.rpChatReaction,
          },
        ]);
      }

      setNpcs((prev) => ({
        ...prev,
        [targetNpcId]: {
          ...prev[targetNpcId],
          affinity: Math.max(
            -100,
            Math.min(100, prev[targetNpcId].affinity + (data.affinityDelta || 0))
          ),
        },
      }));

      if (data.userFollowersDelta) {
        setUserFollowers((f) => Math.max(0, f + data.userFollowersDelta));
      }

      setSyncEvents((prev) => [
        {
          id: 'sync-ph-' + Date.now(),
          timestamp: nowTimeFull(),
          direction: 'PHONE_TO_RP',
          summary: data.bridgeLog || 'Действие в смартфоне вызвало отклик в РП-чате',
          contextDelta: `Ответ от ${responderNpc.handle} инжектирован в память сцены.`,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setApiErrorBanner(err?.message || 'Ошибка синхронизации действия телефона.');
    } finally {
      setIsSimulating(false);
    }
  };

  // Handlers passed to LiveSmartphone
  const handleLikePost = (postId: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const willLike = !targetPost.isLikedByUser;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLikedByUser: willLike,
              likes: willLike ? p.likes + 1 : Math.max(0, p.likes - 1),
            }
          : p
      )
    );

    if (willLike && targetPost.authorId !== 'user') {
      setSyncEvents((prev) => [
        {
          id: 'sync-like-' + Date.now(),
          timestamp: nowTimeFull(),
          direction: 'PHONE_TO_RP',
          summary: `Вы поставили лайк посту ${targetPost.authorHandle}`,
          contextDelta:
            targetPost.authorId === 'marcus'
              ? 'Кира видит ваш лайк под постом Маркуса в своей ленте.'
              : `Симпатия ${targetPost.authorHandle} +2.`,
        },
        ...prev,
      ]);
    }
  };

  const handleCommentPost = (postId: string, commentText: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: 'c-user-' + Date.now(),
                  authorId: 'user',
                  authorName: 'Вы',
                  authorHandle: userHandle,
                  text: commentText,
                  timestamp: 'только что',
                },
              ],
            }
          : p
      )
    );

    const npcTarget = targetPost.authorId === 'user' ? 'kira' : targetPost.authorId;
    triggerPhoneActionRipple(
      'COMMENT_POST',
      npcTarget,
      `Игрок оставил комментарий "${commentText}" под постом ${targetPost.authorHandle}: "${targetPost.content}"`,
      postId
    );
  };

  const handlePublishUserPost = (content: string, location: string) => {
    const newId = 'post-user-' + Date.now();
    const userPost: SocialPost = {
      id: newId,
      authorId: 'user',
      authorName: 'Вы ({{user}})',
      authorHandle: userHandle,
      authorAvatar: '',
      content,
      location,
      timestamp: 'только что',
      likes: 14,
      isLikedByUser: true,
      rpImpactNote: 'Опубликовано вами прямо во время РП-сцены.',
      comments: [],
    };

    setPosts((prev) => [userPost, ...prev]);
    triggerPhoneActionRipple(
      'PUBLISH_POST',
      'kira',
      `Игрок только что выложил новый пост в ленту Pulse (локация: ${location}): "${content}"`,
      newId
    );
  };

  const handleShowPostInRp = (post: SocialPost) => {
    handleSendRpMessage(
      `*Я поворачиваю экран своего смартфона к Кире, показывая пост от ${post.authorHandle}: «${post.content}»* — Посмотри на это. Что думаешь?`
    );
  };

  const handleSendDm = (npcId: 'kira' | 'marcus' | 'elena', text: string) => {
    setDms((prev) => ({
      ...prev,
      [npcId]: [
        ...prev[npcId],
        {
          id: 'dm-u-' + Date.now(),
          senderId: 'user',
          text,
          timestamp: nowTimeShort(),
          read: true,
        },
      ],
    }));

    triggerPhoneActionRipple(
      'SEND_DM',
      npcId,
      `Игрок отправил личное сообщение для ${npcs[npcId].name} (${npcs[npcId].handle}): "${text}"`
    );
  };

  const handleMarkDmRead = (npcId: 'kira' | 'marcus' | 'elena') => {
    setDms((prev) => ({
      ...prev,
      [npcId]: prev[npcId].map((m) => ({ ...m, read: true })),
    }));
  };

  const handleToggleFollowNpc = (npcId: 'kira' | 'marcus' | 'elena') => {
    const target = npcs[npcId];
    const nextFollowState = !target.isFollowedByUser;

    setNpcs((prev) => ({
      ...prev,
      [npcId]: {
        ...prev[npcId],
        isFollowedByUser: nextFollowState,
        followers: nextFollowState
          ? prev[npcId].followers + 1
          : Math.max(0, prev[npcId].followers - 1),
      },
    }));

    triggerPhoneActionRipple(
      nextFollowState ? 'FOLLOW_NPC' : 'UNFOLLOW_NPC',
      npcId,
      `Игрок ${nextFollowState ? 'ПОДПИСАЛСЯ на' : 'ОТПИСАЛСЯ от'} аккаунта ${target.name} (${target.handle}) в соцсети Pulse.`
    );
  };

  const handleCopyLivePrompt = () => {
    navigator.clipboard.writeText(currentPromptBlock);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('workspace');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          ST LivePhone
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              setActiveNav('workspace');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeNav === 'workspace'
                ? 'text-slate-100 border-b-2 border-amber-500'
                : 'hover:text-slate-100'
            }`}
          >
            Ролевой чат и Телефон
          </a>
          <a
            href="#matrix"
            onClick={(e) => {
              e.preventDefault();
              setActiveNav('matrix');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeNav === 'matrix'
                ? 'text-slate-100 border-b-2 border-amber-500'
                : 'hover:text-slate-100'
            }`}
          >
            Матрица НПС
          </a>
          <a
            href="#prompt"
            onClick={(e) => {
              e.preventDefault();
              setActiveNav('prompt');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeNav === 'prompt'
                ? 'text-slate-100 border-b-2 border-amber-500'
                : 'hover:text-slate-100'
            }`}
          >
            Промпт-инжекция
          </a>
          <a
            href="#export"
            onClick={(e) => {
              e.preventDefault();
              setActiveNav('export');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeNav === 'export'
                ? 'text-slate-100 border-b-2 border-amber-500'
                : 'hover:text-slate-100'
            }`}
          >
            Экспорт в SillyTavern
          </a>
        </nav>

        {/* Zone 3: 1 primary action button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => downloadSillyTavernExtensionZip(extConfig, currentPromptBlock)}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать .ZIP для SillyTavern</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Selector (for narrow screens) */}
      <div className="flex md:hidden items-center gap-1 px-4 py-2 border-b border-slate-900 overflow-x-auto bg-slate-950">
        {(
          [
            ['workspace', 'Чат + Телефон'],
            ['matrix', 'Матрица НПС'],
            ['prompt', 'Промпт'],
            ['export', 'Экспорт .ZIP'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveNav(id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 ${
              activeNav === id
                ? 'bg-slate-800 text-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">
        {apiErrorBanner && (
          <div className="mb-4 px-4 py-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center justify-between">
            <span>{apiErrorBanner}</span>
            <button
              type="button"
              onClick={() => setApiErrorBanner(null)}
              className="text-rose-300 hover:text-white font-medium ml-4 cursor-pointer"
            >
              Скрыть
            </button>
          </div>
        )}

        {/* VIEW 1: COUPLED ROLEPLAY CHAT & LIVE SMARTPHONE */}
        {activeNav === 'workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): SillyTavern Roleplay Chat */}
            <section className="lg:col-span-7 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col h-[740px] overflow-hidden">
              {/* RP Scene Header */}
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={npcs.kira.avatar}
                    alt={npcs.kira.name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <h1 className="text-base font-semibold text-slate-100 truncate">
                      Сцена SillyTavern: Ночное кафе «Амбер»
                    </h1>
                    <div className="text-xs text-slate-400 flex items-center gap-2 truncate tabular-nums">
                      <span>Кира Вэнс ({npcs.kira.handle})</span>
                      <span aria-hidden="true">·</span>
                      <span>Настроение: {npcs.kira.mood}</span>
                      <span aria-hidden="true">·</span>
                      <span>Симпатия: {npcs.kira.affinity}%</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTriggerAutonomousTick('manual_scene_pulse')}
                  disabled={isSimulating}
                  className="min-h-[40px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Шаг жизни НПС</span>
                </button>
              </div>

              {/* Quick Coupled Scenario Starters */}
              <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                  Быстрый ход:
                </span>
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={() =>
                    handleSendRpMessage(
                      '*Я открываю сообщение от Маркуса на телефоне и кладу смартфон на стол перед Кирой.* — Смотри, он предупреждает, что за твоим аккаунтом в Pulse сегодня следят.'
                    )
                  }
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Показать Кире СМС от Маркуса
                </button>
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={() =>
                    handleSendRpMessage(
                      '*Я незаметно фотографирую Киру через стол на фоне мокрого неонового окна и улыбаюсь.* — Сейчас выложу в Pulse, пусть Маркус гадает, чем мы заняты.'
                    )
                  }
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Сфотографировать Киру для ленты
                </button>
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={() =>
                    handleSendRpMessage(
                      '*Я убираю телефон в карман куртки и наклоняюсь ближе к Кире.* — Забудь про подписчиков. Расскажи, что именно было на том архиве «Кронос»?'
                    )
                  }
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Спросить про архив «Кронос»
                </button>
              </div>

              {/* Scrollable RP Messages Stream */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {rpMessages.map((msg) => {
                  const isUser = msg.senderId === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isUser ? (
                        <img
                          src={msg.avatar || ASSETS.kiraAvatar}
                          alt={msg.senderName}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0 mt-1"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0 mt-1">
                          ВЫ
                        </div>
                      )}

                      <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">{msg.senderName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{msg.timestamp}</span>
                        </div>

                        {msg.linkedPhoneEvent && (
                          <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span>{msg.linkedPhoneEvent}</span>
                          </div>
                        )}

                        <div
                          className={`rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line ${
                            isUser
                              ? 'bg-slate-800 text-slate-100 border border-slate-700'
                              : 'bg-slate-950/90 text-slate-200 border border-slate-800/90'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isSimulating && (
                  <div className="flex items-center gap-3 text-xs text-slate-400 px-2 py-1">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>
                      Синхронизация ответа РП-чата и фоновой активности смартфона...
                    </span>
                  </div>
                )}
                <div ref={rpChatEndRef} />
              </div>

              {/* RP Chat Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendRpMessage();
                }}
                className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center gap-3 shrink-0"
              >
                <input
                  type="text"
                  value={rpInput}
                  onChange={(e) => setRpInput(e.target.value)}
                  disabled={isSimulating}
                  placeholder="Напишите реплику или *действие* в РП-чат (повлияет на телефон и ленту НПС)..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  type="submit"
                  disabled={!rpInput.trim() || isSimulating}
                  className="min-h-[46px] px-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-semibold text-sm rounded-xl flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Отправить</span>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </section>

            {/* Right Column (5 cols): Interactive Live Smartphone */}
            <aside className="lg:col-span-5 flex flex-col items-center">
              <LiveSmartphone
                userHandle={userHandle}
                userFollowers={userFollowers}
                npcs={npcs}
                posts={posts}
                dms={dms}
                syncEvents={syncEvents}
                autoLifeEnabled={autoLifeEnabled}
                secondsUntilNextTick={secondsUntilNextTick}
                isSimulating={isSimulating}
                phoneToast={phoneToast}
                onToggleAutoLife={() => setAutoLifeEnabled((v) => !v)}
                onTriggerAutonomousTick={handleTriggerAutonomousTick}
                onLikePost={handleLikePost}
                onCommentPost={handleCommentPost}
                onPublishUserPost={handlePublishUserPost}
                onShowPostInRp={handleShowPostInRp}
                onSendDm={handleSendDm}
                onMarkDmRead={handleMarkDmRead}
                onToggleFollowNpc={handleToggleFollowNpc}
              />
            </aside>
          </div>
        )}

        {/* VIEW 2: NPC SOCIAL MATRIX & RELATIONSHIP GRAPH */}
        {activeNav === 'matrix' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-bold text-slate-100">
                  Матрица автономных НПС и социальных связей
                </h1>
                <p className="text-sm text-slate-400">
                  Все персонажи живут в едином графе: их подписки, симпатия и комментарии напрямую меняют тон диалога в SillyTavern.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTriggerAutonomousTick('matrix_manual_pulse')}
                disabled={isSimulating}
                className="min-h-[42px] px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Запустить волну активности НПС</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['kira', 'marcus', 'elena'] as const).map((npcId) => {
                const npc = npcs[npcId];
                const npcPostCount = posts.filter((p) => p.authorId === npcId).length;
                const npcDmCount = dms[npcId].length;
                return (
                  <div
                    key={npc.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={npc.avatar}
                          alt={npc.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-slate-100 truncate">
                            {npc.name}
                          </h2>
                          <div className="text-xs text-slate-400">
                            <span>{npc.handle}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{npc.mood}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400">{npc.role}</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{npc.bio}</p>

                      <div className="pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
                        <div>
                          <div className="text-sm font-bold text-slate-100">
                            {npc.followers.toLocaleString('ru-RU')}
                          </div>
                          <div className="text-[11px] text-slate-400">Подписчиков</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-amber-400">{npc.affinity}%</div>
                          <div className="text-[11px] text-slate-400">Симпатия</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-100">
                            {npcPostCount} / {npcDmCount}
                          </div>
                          <div className="text-[11px] text-slate-400">Посты / ЛС</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFollowNpc(npc.id)}
                        disabled={isSimulating}
                        className="flex-1 min-h-[40px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{npc.isFollowedByUser ? 'Отписаться' : 'Подписаться'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('workspace')}
                        className="flex-1 min-h-[40px] px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Открыть в телефоне</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: LIVE PROMPT CONTEXT INJECTOR (ПРОМПТ-ИНЖЕКЦИЯ SILLYTAVERN) */}
        {activeNav === 'prompt' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-bold text-slate-100">
                  Живой блок инжекции контекста SillyTavern (setExtensionPrompt)
                </h1>
                <p className="text-sm text-slate-400">
                  Именно этот динамический блок расширение автоматически передает в память модели перед каждым ответом персонажа.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLivePrompt}
                className="min-h-[42px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Скопировано в буфер</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Скопировать блок промпта</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <pre className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                <code>{currentPromptBlock}</code>
              </pre>
            </div>
          </div>
        )}

        {/* VIEW 4: SILLYTAVERN EXTENSION EXPORTER */}
        {activeNav === 'export' && (
          <ExtensionExporterView
            config={extConfig}
            onChangeConfig={setExtConfig}
            livePromptBlock={currentPromptBlock}
          />
        )}
      </main>
    </div>
  );
}
