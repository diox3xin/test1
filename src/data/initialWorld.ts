export interface NpcProfile {
  id: 'kira' | 'marcus' | 'elena';
  name: string;
  handle: string;
  role: string;
  bio: string;
  avatar: string;
  followers: number;
  following: number;
  isFollowedByUser: boolean;
  followsUser: boolean;
  affinity: number; // -100 to 100
  statusText: string;
  mood: string;
  mutualHandles: string[];
}

export interface SocialComment {
  id: string;
  authorId: 'user' | 'kira' | 'marcus' | 'elena';
  authorName: string;
  authorHandle: string;
  text: string;
  timestamp: string;
}

export interface SocialPost {
  id: string;
  authorId: 'user' | 'kira' | 'marcus' | 'elena';
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  content: string;
  image?: string;
  location: string;
  timestamp: string;
  likes: number;
  isLikedByUser: boolean;
  comments: SocialComment[];
  rpImpactNote?: string;
}

export interface DirectMessage {
  id: string;
  senderId: 'user' | 'kira' | 'marcus' | 'elena';
  text: string;
  timestamp: string;
  read: boolean;
}

export interface RpChatMessage {
  id: string;
  senderId: 'user' | 'kira' | 'system_bridge';
  senderName: string;
  avatar?: string;
  text: string;
  timestamp: string;
  linkedPhoneEvent?: string;
}

export interface SyncBridgeEvent {
  id: string;
  timestamp: string;
  direction: 'PHONE_TO_RP' | 'RP_TO_PHONE' | 'AUTONOMOUS_LIFE';
  summary: string;
  contextDelta: string;
}

export const ASSETS = {
  kiraAvatar: '/src/assets/images/avatar_kira_vance_1794693890721.jpg',
  marcusAvatar: '/src/assets/images/avatar_marcus_thorne_1794693891582.jpg',
  elenaAvatar: '/src/assets/images/avatar_elena_rostova_1794693892983.jpg',
  postRooftop: '/src/assets/images/post_rooftop_rain_1794693892400.jpg',
  postVinyl: '/src/assets/images/post_vinyl_lounge_1794693893395.jpg',
};

export const INITIAL_NPCS: Record<'kira' | 'marcus' | 'elena', NpcProfile> = {
  kira: {
    id: 'kira',
    name: 'Кира Вэнс',
    handle: '@kira_vance',
    role: 'Ночной фотограф · Нетраннер-фрилансер',
    bio: 'Снимаю на пленку то, что город пытается стереть. Кофе без сахара, крыши Сектора-7 и чужие секреты.',
    avatar: ASSETS.kiraAvatar,
    followers: 14820,
    following: 312,
    isFollowedByUser: true,
    followsUser: true,
    affinity: 68,
    statusText: 'В кафе «Амбер» напротив тебя',
    mood: 'Заинтригована',
    mutualHandles: ['@dr_rostova', '@night_pulse'],
  },
  marcus: {
    id: 'marcus',
    name: 'Маркус Торн',
    handle: '@marcus_noir',
    role: 'Владелец винилового клуба «Sub-Zero» · Фиксер',
    bio: 'Редкий джаз, закрытые сделки и старый бурбон. Если ты ищешь кого-то в нижнем городе — я уже знаю, где он.',
    avatar: ASSETS.marcusAvatar,
    followers: 29450,
    following: 184,
    isFollowedByUser: false,
    followsUser: true,
    affinity: 15,
    statusText: 'В клубе «Sub-Zero», слушает пластинки',
    mood: 'Наблюдает',
    mutualHandles: ['@kira_vance', '@dr_rostova'],
  },
  elena: {
    id: 'elena',
    name: 'Д-р Елена Ростова',
    handle: '@dr_rostova',
    role: 'Ведущий биоинженер · Оранжерея «Гелиос»',
    bio: 'Синтетическая ботаника и нейроимпланты. Спасаю тех, кто забывает спать по ночам.',
    avatar: ASSETS.elenaAvatar,
    followers: 8930,
    following: 420,
    isFollowedByUser: true,
    followsUser: true,
    affinity: 54,
    statusText: 'Дежурство в био-блоке 4',
    mood: 'Сосредоточена',
    mutualHandles: ['@kira_vance', '@marcus_noir'],
  },
};

export const INITIAL_POSTS: SocialPost[] = [
  {
    id: 'post-1',
    authorId: 'kira',
    authorName: 'Кира Вэнс',
    authorHandle: '@kira_vance',
    authorAvatar: ASSETS.kiraAvatar,
    content: 'Дождь смывает неоновую пыль с седьмого квартала. Обещали встретиться в «Амбере» ровно в 21:00 — посмотрим, кто сегодня придет вовремя, а кто опять застрял в переулках.',
    image: ASSETS.postRooftop,
    location: 'Балкон над 7-й авеню',
    timestamp: '14 мин назад',
    likes: 412,
    isLikedByUser: true,
    rpImpactNote: 'Кира выложила этот пост за 15 минут до вашей встречи в кафе.',
    comments: [
      {
        id: 'c-101',
        authorId: 'elena',
        authorName: 'Д-р Елена Ростова',
        authorHandle: '@dr_rostova',
        text: 'Только не пей четвертый эспрессо подряд, Кира. У тебя пульс на телеметрии зашкаливает.',
        timestamp: '11 мин назад',
      },
      {
        id: 'c-102',
        authorId: 'marcus',
        authorName: 'Маркус Торн',
        authorHandle: '@marcus_noir',
        text: 'Если твой спутник не объявится — заглядывай в Sub-Zero. Сегодня привезли японский пресс 74-го года.',
        timestamp: '6 мин назад',
      },
    ],
  },
  {
    id: 'post-2',
    authorId: 'marcus',
    authorName: 'Маркус Торн',
    authorHandle: '@marcus_noir',
    authorAvatar: ASSETS.marcusAvatar,
    content: 'Ламповые усилители прогреты. Сегодня вход в нижний зал только для своих. Кстати, кто-нибудь видел новые сводки из архива «Кронос»? Говорят, кто-то скачал закрытый реестр.',
    image: ASSETS.postVinyl,
    location: 'Виниловый бар Sub-Zero',
    timestamp: '38 мин назад',
    likes: 874,
    isLikedByUser: false,
    rpImpactNote: 'Маркус намекает на утечку данных, которую вы с Кирой обсуждали вчера.',
    comments: [
      {
        id: 'c-201',
        authorId: 'kira',
        authorName: 'Кира Вэнс',
        authorHandle: '@kira_vance',
        text: 'Ты слишком громко задаешь вопросы в открытой ленте, Маркус.',
        timestamp: '29 мин назад',
      },
    ],
  },
];

export const INITIAL_DMS: Record<'kira' | 'marcus' | 'elena', DirectMessage[]> = {
  kira: [
    {
      id: 'dm-k1',
      senderId: 'kira',
      text: 'Я заняла угловой столик у мокрого окна. Заказала тебе американо.',
      timestamp: '20:54',
      read: true,
    },
    {
      id: 'dm-k2',
      senderId: 'kira',
      text: 'И кстати... Маркус опять оставил комментарий под моим постом. Он явно что-то пронюхал про флешку.',
      timestamp: '20:58',
      read: true,
    },
  ],
  marcus: [
    {
      id: 'dm-m1',
      senderId: 'marcus',
      text: 'Привет. Знаю, вы сейчас с Вэнс в «Амбере». Будь осторожнее — за ее аккаунтом в Pulse сегодня следят не только подписчики.',
      timestamp: '21:01',
      read: false,
    },
  ],
  elena: [
    {
      id: 'dm-e1',
      senderId: 'elena',
      text: 'Результаты сканирования нейрочипа готовы. Когда освободишься после кафе — напиши, скину ключи дешифровки.',
      timestamp: '20:30',
      read: true,
    },
  ],
};

export const INITIAL_RP_MESSAGES: RpChatMessage[] = [
  {
    id: 'rp-1',
    senderId: 'kira',
    senderName: 'Кира Вэнс',
    avatar: ASSETS.kiraAvatar,
    timestamp: '21:02',
    linkedPhoneEvent: 'Синхронизировано с постом @kira_vance и непрочитанным ЛС от @marcus_noir',
    text: `*Дождевые капли медленно стекают по запотевшему стеклу ночного кафе «Амбер», окрашиваясь в теплый янтарный свет уличной вывески. Кира сидит напротив тебя в потертой кожаной куртке, лениво вращая пальцами тонкое серебряное кольцо. Ее смартфон лежит на деревянном столе экраном вверх — только что на нем мелькнуло уведомление о комментарии Маркуса Торна.*

*Она поднимает на тебя внимательный, чуть усталый взгляд и кивает на твой телефон:*

— У тебя тоже только что вибрировал. Это ведь Маркус написал тебе в личку, да? *Кира чуть заметно усмехается и делает глоток черного кофе.* — Он уже полчаса крутится в моей ленте и намекает на вчерашний архив. Покажи, что он хочет, или ответь ему прямо сейчас — посмотрим, как быстро он выложит новый пост.`,
  },
];

export const INITIAL_SYNC_EVENTS: SyncBridgeEvent[] = [
  {
    id: 'sync-1',
    timestamp: '20:58:12',
    direction: 'AUTONOMOUS_LIFE',
    summary: '@marcus_noir прокомментировал пост @kira_vance без участия игрока',
    contextDelta: 'Добавлен триггер ревности/подозрения Киры в системный промпт РП-чата.',
  },
  {
    id: 'sync-2',
    timestamp: '21:01:05',
    direction: 'PHONE_TO_RP',
    summary: 'Входящее ЛС от @marcus_noir доставлено в фоновом режиме',
    contextDelta: 'Кира в РП-чате услышала вибрацию твоего смартфона и спросила о сообщении.',
  },
];
