import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  UserPlus,
  UserCheck,
  Sparkles,
  Share2,
  RefreshCw,
  Compass,
  Users,
  Activity,
  ChevronRight,
} from 'lucide-react';
import {
  NpcProfile,
  SocialPost,
  DirectMessage,
  SyncBridgeEvent,
} from '../data/initialWorld';

interface LiveSmartphoneProps {
  userHandle: string;
  userFollowers: number;
  npcs: Record<'kira' | 'marcus' | 'elena', NpcProfile>;
  posts: SocialPost[];
  dms: Record<'kira' | 'marcus' | 'elena', DirectMessage[]>;
  syncEvents: SyncBridgeEvent[];
  autoLifeEnabled: boolean;
  secondsUntilNextTick: number;
  isSimulating: boolean;
  phoneToast: string | null;
  onToggleAutoLife: () => void;
  onTriggerAutonomousTick: (reason?: string) => void;
  onLikePost: (postId: string) => void;
  onCommentPost: (postId: string, commentText: string) => void;
  onPublishUserPost: (content: string, location: string) => void;
  onShowPostInRp: (post: SocialPost) => void;
  onSendDm: (npcId: 'kira' | 'marcus' | 'elena', text: string) => void;
  onMarkDmRead: (npcId: 'kira' | 'marcus' | 'elena') => void;
  onToggleFollowNpc: (npcId: 'kira' | 'marcus' | 'elena') => void;
}

export const LiveSmartphone: React.FC<LiveSmartphoneProps> = ({
  userHandle,
  userFollowers,
  npcs,
  posts,
  dms,
  syncEvents,
  autoLifeEnabled,
  secondsUntilNextTick,
  isSimulating,
  phoneToast,
  onToggleAutoLife,
  onTriggerAutonomousTick,
  onLikePost,
  onCommentPost,
  onPublishUserPost,
  onShowPostInRp,
  onSendDm,
  onMarkDmRead,
  onToggleFollowNpc,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'dms' | 'profiles' | 'autonomy'>('feed');
  const [selectedDmNpc, setSelectedDmNpc] = useState<'kira' | 'marcus' | 'elena'>('marcus');
  const [newPostText, setNewPostText] = useState('');
  const [newPostLocation, setNewPostLocation] = useState('Кафе «Амбер», Сектор-7');
  const [showCompose, setShowCompose] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [dmInput, setDmInput] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const unreadDmCount = (Object.keys(dms) as Array<'kira' | 'marcus' | 'elena'>).reduce(
    (acc, key) => acc + dms[key].filter((m) => !m.read && m.senderId !== 'user').length,
    0
  );

  const followingCount = (Object.values(npcs) as NpcProfile[]).filter(
    (n) => n.isFollowedByUser
  ).length;

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() || isSimulating) return;
    onPublishUserPost(newPostText.trim(), newPostLocation.trim() || 'Ночной город');
    setNewPostText('');
    setShowCompose(false);
  };

  const handleSendComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text || isSimulating) return;
    onCommentPost(postId, text);
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleSendDmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmInput.trim() || isSimulating) return;
    onSendDm(selectedDmNpc, dmInput.trim());
    setDmInput('');
  };

  const selectDmContact = (npcId: 'kira' | 'marcus' | 'elena') => {
    setSelectedDmNpc(npcId);
    onMarkDmRead(npcId);
  };

  return (
    <div className="w-full max-w-[400px] mx-auto bg-slate-950 border border-slate-800 rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[740px] select-none relative">
      {/* Top Smartphone Hardware Status Bar */}
      <div className="px-5 pt-3 pb-2 bg-slate-950 border-b border-slate-900 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span className="text-slate-200 font-medium">21:04</span>
          <span aria-hidden="true">·</span>
          <span>Pulse 5G</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAutoLife}
            title="Переключить автономную жизнь НПС"
            className="text-[11px] font-mono tabular-nums text-slate-300 hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            {autoLifeEnabled ? `Авто-жизнь ${secondsUntilNextTick}с` : 'Авто-жизнь: пауза'}
          </button>
          <span aria-hidden="true" className="text-slate-700">|</span>
          <button
            type="button"
            onClick={() => onTriggerAutonomousTick('manual_step')}
            disabled={isSimulating}
            title="Сгенерировать случайное событие от НПС прямо сейчас"
            className="p-1 text-amber-400 hover:text-amber-300 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Live Push Notification Toast inside the Phone */}
      {phoneToast && (
        <div className="mx-3 mt-2 px-3.5 py-2.5 bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl text-xs text-slate-100 flex items-center justify-between gap-2 shadow-lg shrink-0">
          <span className="truncate">{phoneToast}</span>
          <span className="text-[11px] text-amber-400 font-mono whitespace-nowrap shrink-0">
            Синхр. с РП
          </span>
        </div>
      )}

      {/* Main Scrollable Phone Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* TAB 1: SOCIAL FEED (ЛЕНТА PULSE) */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {/* Top App Bar inside Feed */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-900">
              <div>
                <h2 className="text-base font-semibold text-slate-100 tracking-tight">
                  Лента Pulse
                </h2>
                <p className="text-xs text-slate-400 tabular-nums">
                  {userHandle} · {userFollowers.toLocaleString('ru-RU')} подписчиков
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompose(!showCompose)}
                className="min-h-[40px] px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {showCompose ? 'Закрыть' : 'Новый пост'}
              </button>
            </div>

            {/* Compose Post Drawer */}
            {showCompose && (
              <form
                onSubmit={handleCreatePost}
                className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3"
              >
                <div className="text-xs font-medium text-slate-300">
                  Опубликовать от имени {userHandle} (повлияет на РП-чат)
                </div>
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="Что происходит сейчас в кафе или в городе?.."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 resize-none"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPostLocation}
                    onChange={(e) => setNewPostLocation(e.target.value)}
                    placeholder="Локация"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/60"
                  />
                  <button
                    type="submit"
                    disabled={!newPostText.trim() || isSimulating}
                    className="min-h-[40px] px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Опубликовать
                  </button>
                </div>
              </form>
            )}

            {/* Posts List */}
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-3.5 space-y-3"
                >
                  {/* Post Author Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {post.authorAvatar && !brokenImages[post.id + '_avatar'] ? (
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [post.id + '_avatar']: true }))
                          }
                          className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                          {post.authorName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {post.authorName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          <span>{post.authorHandle}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{post.location}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
                      {post.timestamp}
                    </span>
                  </div>

                  {/* Post Text */}
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {post.content}
                  </p>

                  {/* Optional Post Image with Fallback */}
                  {post.image && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      {!brokenImages[post.id + '_img'] ? (
                        <img
                          src={post.image}
                          alt={post.location}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [post.id + '_img']: true }))
                          }
                          className="w-full h-44 object-cover"
                        />
                      ) : (
                        <div className="w-full h-36 bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
                          <Compass className="w-6 h-6 text-amber-400/70 mb-1" />
                          <span className="text-xs text-slate-400">{post.location}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtle RP Impact Note */}
                  {post.rpImpactNote && (
                    <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1.5">
                      Связь с РП: {post.rpImpactNote}
                    </div>
                  )}

                  {/* Post Action Row (Thumb-friendly hitboxes) */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onLikePost(post.id)}
                        className={`min-h-[38px] px-2.5 flex items-center gap-1.5 text-xs font-mono tabular-nums rounded-lg transition-colors cursor-pointer ${
                          post.isLikedByUser
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${post.isLikedByUser ? 'fill-rose-400' : ''}`}
                        />
                        <span>{post.likes}</span>
                      </button>

                      <span className="text-xs text-slate-400 font-mono tabular-nums flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        <span>{post.comments.length}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onShowPostInRp(post)}
                      disabled={isSimulating}
                      title="Показать экран с этим постом персонажу в РП-чате"
                      className="min-h-[38px] px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Показать в РП</span>
                    </button>
                  </div>

                  {/* Comments List */}
                  {post.comments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      {post.comments.map((c) => (
                        <div key={c.id} className="text-xs leading-snug space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">{c.authorHandle}</span>
                            <span className="font-mono tabular-nums text-slate-500">
                              {c.timestamp}
                            </span>
                          </div>
                          <p className="text-slate-300">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={commentInputs[post.id] || ''}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendComment(post.id);
                        }
                      }}
                      placeholder="Ответить в комментариях..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendComment(post.id)}
                      disabled={!commentInputs[post.id]?.trim() || isSimulating}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 disabled:opacity-40 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: DIRECT MESSAGES (ЖИВЫЕ СООБЩЕНИЯ) */}
        {activeTab === 'dms' && (
          <div className="flex flex-col h-[560px]">
            <div className="pb-2.5 border-b border-slate-900 shrink-0">
              <h2 className="text-base font-semibold text-slate-100">Личные сообщения</h2>
              <p className="text-xs text-slate-400">
                Переписка с НПС напрямую меняет их поведение в РП-чате
              </p>
            </div>

            {/* Contact Selector Bar */}
            <div className="grid grid-cols-3 gap-1.5 py-2.5 border-b border-slate-900 shrink-0">
              {(['kira', 'marcus', 'elena'] as const).map((npcId) => {
                const npc = npcs[npcId];
                const unread = dms[npcId].filter(
                  (m) => !m.read && m.senderId !== 'user'
                ).length;
                const isSelected = selectedDmNpc === npcId;
                return (
                  <button
                    key={npcId}
                    type="button"
                    onClick={() => selectDmContact(npcId)}
                    className={`min-h-[48px] px-2 py-1.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/60 text-slate-100'
                        : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <img
                      src={npc.avatar}
                      alt={npc.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">
                        {npc.name.split(' ')[0]}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-amber-400">
                        {unread > 0 ? `${unread} нов.` : npc.mood.slice(0, 9)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active NPC Chat Header */}
            <div className="py-2 flex items-center justify-between text-xs text-slate-400 border-b border-slate-900/80 shrink-0">
              <span className="truncate">{npcs[selectedDmNpc].statusText}</span>
              <span className="font-mono tabular-nums text-slate-300 shrink-0">
                Симпатия: {npcs[selectedDmNpc].affinity}%
              </span>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {dms[selectedDmNpc].map((msg) => {
                const isUser = msg.senderId === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-amber-500 text-slate-950 font-medium'
                          : 'bg-slate-900 border border-slate-800 text-slate-200'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono tabular-nums mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Send DM Form */}
            <form
              onSubmit={handleSendDmSubmit}
              className="pt-2 border-t border-slate-900 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder={`Написать ${npcs[selectedDmNpc].name.split(' ')[0]}...`}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              <button
                type="submit"
                disabled={!dmInput.trim() || isSimulating}
                className="min-h-[42px] px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Отпр.
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: PROFILES, FOLLOWERS & SUBSCRIPTIONS (ПОДПИСЧИКИ И ПОДПИСКИ) */}
        {activeTab === 'profiles' && (
          <div className="space-y-4">
            {/* Player Profile Summary */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Ваш профиль РП</div>
                  <div className="text-xs text-amber-400 font-mono">{userHandle}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-sm font-bold text-slate-100">
                    {userFollowers.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-slate-400">подписчиков</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                <span>Ваши подписки: {followingCount}</span>
                <span>Взаимных связей: 2</span>
              </div>
            </div>

            {/* NPC Profiles List */}
            <div className="space-y-3">
              {(['kira', 'marcus', 'elena'] as const).map((npcId) => {
                const npc = npcs[npcId];
                return (
                  <div
                    key={npc.id}
                    className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={npc.avatar}
                          alt={npc.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 truncate">
                            {npc.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            <span>{npc.handle}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{npc.mood}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleFollowNpc(npc.id)}
                        disabled={isSimulating}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          npc.isFollowedByUser
                            ? 'bg-slate-800 text-slate-200 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700'
                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        }`}
                      >
                        {npc.isFollowedByUser ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Подписаны</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Подписаться</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{npc.bio}</p>

                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums pt-2 border-t border-slate-800/80">
                      <span>{npc.followers.toLocaleString('ru-RU')} подписчиков</span>
                      <span aria-hidden="true">·</span>
                      <span>{npc.followsUser ? 'Подписан(а) на вас' : 'Не подписан(а)'}</span>
                    </div>

                    {/* Relationship Affinity Meter */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                        <span>Отношение в РП</span>
                        <span className="text-amber-400">{npc.affinity} / 100</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-transform duration-200 origin-left"
                          style={{
                            transform: `scaleX(${Math.max(0.05, Math.min(1, (npc.affinity + 20) / 120))})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: AUTONOMOUS WORLD ENGINE & BRIDGE LOGS (АВТОНОМНАЯ ЖИЗНЬ) */}
        {activeTab === 'autonomy' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Движок автономной жизни НПС
                  </h2>
                  <p className="text-xs text-slate-400">
                    Персонажи генерируют посты и сообщения без вашего участия
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleAutoLife}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    autoLifeEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {autoLifeEnabled ? 'Активен' : 'На паузе'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onTriggerAutonomousTick('manual_button')}
                disabled={isSimulating}
                className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isSimulating
                    ? 'Синхронизация мира...'
                    : 'Сгенерировать живое событие НПС сейчас'}
                </span>
              </button>
            </div>

            {/* Live Synchronization Log inside Phone */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-300">
                Журнал влияния «Телефон ⇄ РП-чат»
              </div>
              {syncEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                    <span className="text-amber-400">
                      {ev.direction === 'PHONE_TO_RP'
                        ? 'Телефон → РП-чат'
                        : ev.direction === 'RP_TO_PHONE'
                        ? 'РП-чат → Телефон'
                        : 'Автономная жизнь НПС'}
                    </span>
                    <span>{ev.timestamp}</span>
                  </div>
                  <div className="font-medium text-slate-200">{ev.summary}</div>
                  <div className="text-[11px] text-slate-400">{ev.contextDelta}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Thumb-Zone Navigation Bar (4 Tabs, >=44px hitboxes) */}
      <nav className="h-16 bg-slate-950 border-t border-slate-900 grid grid-cols-4 items-center px-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
            activeTab === 'feed' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">Лента</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('dms');
            onMarkDmRead(selectedDmNpc);
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer relative ${
            activeTab === 'dms' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">
            Сообщения {unreadDmCount > 0 ? `(${unreadDmCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
            activeTab === 'profiles' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">Подписки</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('autonomy')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
            activeTab === 'autonomy' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">Авто-жизнь</span>
        </button>
      </nav>
    </div>
  );
};
