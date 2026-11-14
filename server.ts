import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const MODEL_NAME = 'gemini-4-hydrogen';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // 1. RP Chat Turn -> Coupled RP Response + Live Phone Side Effects
  app.post('/api/rp-turn', async (req, res) => {
    try {
      const { userMessage, activeCharacterId, rpHistory, phoneSummary } = req.body;

      const systemInstruction = `Ты — движок ролевой синхронизации SillyTavern (ST LivePhone).
Твоя задача — вести глубокий, атмосферный ролевой отыгрыш на русском языке от лица активного персонажа сцены (по умолчанию Кира Вэнс, либо другой выбранный персонаж) И ОДНОВРЕМЕННО управлять живым смартфоном персонажей.
Главное правило: Ролевой чат и Телефон НЕРАЗРЫВНО СВЯЗАНЫ.
- Если игрок в телефоне недавно лайкнул пост соперника (Маркуса), отписался от Киры, выложил провокационный пост или переписывается с кем-то в ЛС — персонаж в РП-чате замечает это (или проверяет свой телефон) и эмоционально отыгрывает реакцию.
- Если в РП-чате происходит яркое событие (ссора, признание, заказ кофе, поход в клуб, опасная сделка) — это тут же отражается в телефоне: НПС пишут об этом посты, присылают живые СМС или комментируют.
Отвечай строго в формате JSON по заданной схеме. В поле rpReply используй художественное описание действий в звездочках *действие* и прямую речь.`;

      const prompt = `ТЕКУЩЕЕ СОСТОЯНИЕ ТЕЛЕФОНА И СОЦСЕТИ (инжектировано в контекст SillyTavern):
${phoneSummary}

ПОСЛЕДНИЕ СООБЩЕНИЯ РП-ЧАТА:
${(rpHistory || []).slice(-6).map((m: { sender: string; text: string }) => `${m.sender}: ${m.text}`).join('\n')}

НОВОЕ ДЕЙСТВИЕ / СООБЩЕНИЕ ИГРОКА В РП-ЧАТЕ (активный персонаж сцены: ${activeCharacterId || 'kira'}):
Игрок: ${userMessage}

Сгенерируй ответ персонажа в РП-чате и сопутствующие живые события в телефоне.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rpReply: {
                type: Type.STRING,
                description: 'Ролевой ответ активного персонажа (2-4 абзаца, с действиями *...* и репликами).',
              },
              characterMood: {
                type: Type.STRING,
                description: 'Текущее настроение персонажа одним-двумя словами (например: Заинтригована, Ревнует, Спокойна).',
              },
              affinityDelta: {
                type: Type.INTEGER,
                description: 'Изменение симпатии активного персонажа к игроку от -10 до +10.',
              },
              userFollowersDelta: {
                type: Type.INTEGER,
                description: 'Изменение числа подписчиков игрока (от -5 до +25) в зависимости от резонанса.',
              },
              newPost: {
                type: Type.OBJECT,
                properties: {
                  shouldCreate: { type: Type.BOOLEAN },
                  authorId: { type: Type.STRING, description: 'kira, marcus, elena или ambient_news' },
                  content: { type: Type.STRING, description: 'Текст нового поста в соцсети Pulse' },
                  location: { type: Type.STRING, description: 'Локация поста' },
                  initialLikes: { type: Type.INTEGER },
                  firstCommentAuthorId: { type: Type.STRING, description: 'kira, marcus или elena' },
                  firstCommentText: { type: Type.STRING },
                },
                required: ['shouldCreate', 'authorId', 'content', 'location', 'initialLikes'],
              },
              newDm: {
                type: Type.OBJECT,
                properties: {
                  shouldSend: { type: Type.BOOLEAN },
                  senderId: { type: Type.STRING, description: 'kira, marcus или elena' },
                  text: { type: Type.STRING, description: 'Текст входящего сообщения в мессенджер' },
                },
                required: ['shouldSend', 'senderId', 'text'],
              },
              bridgeLog: {
                type: Type.STRING,
                description: 'Краткая запись (1 предложение) о том, как действие в чате изменило состояние телефона.',
              },
            },
            required: ['rpReply', 'characterMood', 'affinityDelta', 'userFollowersDelta', 'newPost', 'newDm', 'bridgeLog'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error: any) {
      console.error('Error in /api/rp-turn:', error);
      res.status(500).json({
        error: error?.message || 'Ошибка генерации ответа модели Gemini.',
      });
    }
  });

  // 2. Autonomous Background NPC Life Tick (Characters live without user intervention)
  app.post('/api/autonomous-tick', async (req, res) => {
    try {
      const { rpHistory, phoneSummary, triggerReason } = req.body;

      const systemInstruction = `Ты — фоновый симулятор автономной жизни НПС для расширения ST LivePhone в SillyTavern.
Персонажи (Кира Вэнс @kira_vance, Маркус Торн @marcus_noir, Елена Ростова @dr_rostova и городские аккаунты) живут своей жизнью в смартфоне без вмешательства игрока:
- Публикуют случайные жизненные или сюжетные посты в ленту,
- Комментируют посты друг друга и посты игрока,
- Подписываются или отписываются,
- Пишут игроку внезапные личные сообщения,
- И если персонаж сейчас рядом с игроком в РП-чате, телефон может подать сигнал, вызывая живую микро-реакцию в РП-сцене!
Все тексты должны быть на живом, естественном русском языке.`;

      const prompt = `ПРИЧИНА ТИКА СИМУЛЯЦИИ: ${triggerReason || 'Автономный цикл жизни мира'}
ТЕКУЩЕЕ СОСТОЯНИЕ ТЕЛЕФОНА:
${phoneSummary}

КОНТЕКСТ ПОСЛЕДНЕЙ СЦЕНЫ РП-ЧАТА:
${(rpHistory || []).slice(-4).map((m: { sender: string; text: string }) => `${m.sender}: ${m.text}`).join('\n')}

Сгенерируй новую автономную активность НПС в смартфоне и укажи, как это влияет на контекст ролевого чата.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              postAuthorId: {
                type: Type.STRING,
                description: 'Кто публикует пост: kira, marcus или elena',
              },
              postContent: {
                type: Type.STRING,
                description: 'Живой пост от НПС (размышление, фото-подпись, слух, реакция на события в городе или РП).',
              },
              postLocation: {
                type: Type.STRING,
                description: 'Короткое название места (например: Лаунж «Винил», Лаборатория Сектор-4, Крыша на 7-й улице)',
              },
              postLikes: {
                type: Type.INTEGER,
              },
              commentAuthorId: {
                type: Type.STRING,
                description: 'Другой НПС (kira, marcus или elena), который сразу комментирует этот пост',
              },
              commentText: {
                type: Type.STRING,
                description: 'Живой комментарий от второго НПС под этим постом',
              },
              spontaneousDm: {
                type: Type.OBJECT,
                properties: {
                  shouldSend: { type: Type.BOOLEAN },
                  senderId: { type: Type.STRING, description: 'kira, marcus или elena' },
                  text: { type: Type.STRING, description: 'Спонтанное личное сообщение игроку' },
                },
                required: ['shouldSend', 'senderId', 'text'],
              },
              ambientRpReaction: {
                type: Type.STRING,
                description: 'Короткая ремарка для РП-чата (1-2 предложения в *звездочках*), как экран смартфона загорается и как активный персонаж в комнате на это реагирует.',
              },
              followerDeltaMap: {
                type: Type.OBJECT,
                properties: {
                  userDelta: { type: Type.INTEGER },
                  kiraDelta: { type: Type.INTEGER },
                  marcusDelta: { type: Type.INTEGER },
                  elenaDelta: { type: Type.INTEGER },
                },
                required: ['userDelta', 'kiraDelta', 'marcusDelta', 'elenaDelta'],
              },
              eventSummary: {
                type: Type.STRING,
                description: 'Краткая сводка автономного события для лога синхронизации.',
              },
            },
            required: [
              'postAuthorId',
              'postContent',
              'postLocation',
              'postLikes',
              'commentAuthorId',
              'commentText',
              'spontaneousDm',
              'ambientRpReaction',
              'followerDeltaMap',
              'eventSummary',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error: any) {
      console.error('Error in /api/autonomous-tick:', error);
      res.status(500).json({
        error: error?.message || 'Ошибка генерации автономного события.',
      });
    }
  });

  // 3. Direct Phone Interaction (User sends DM, publishes post, or comments -> NPC replies + RP Chat ripples)
  app.post('/api/phone-action', async (req, res) => {
    try {
      const { actionType, targetNpcId, payloadText, rpHistory, phoneSummary } = req.body;

      const systemInstruction = `Ты — система мгновенной реакции смартфона ST LivePhone для SillyTavern.
Когда игрок совершает действие В ТЕЛЕФОНЕ (отправляет СМС персонажу, публикует свой пост или оставляет комментарий, либо подписывается/отписывается):
1. Целевой НПС мгновенно отвечает в телефоне (в ЛС или в комментариях) в своем характере.
2. Поскольку телефон и РП-чат неразрывно связаны, активный персонаж в РП-чате (Кира Вэнс) замечает это действие (например, слышит звук уведомления, видит, что игрок уткнулся в экран, или видит новый пост/сообщение) и выдает живую реакцию в РП-чат!`;

      const prompt = `ТИП ДЕЙСТВИЯ ИГРОКА В ТЕЛЕФОНЕ: ${actionType}
ЦЕЛЕВОЙ ПЕРСОНАЖ: ${targetNpcId || 'all'}
ТЕКСТ / ДАННЫЕ ДЕЙСТВИЯ: ${payloadText}

ТЕКУЩЕЕ СОСТОЯНИЕ ТЕЛЕФОНА:
${phoneSummary}

ПОСЛЕДНИЕ СООБЩЕНИЯ РП-ЧАТА:
${(rpHistory || []).slice(-4).map((m: { sender: string; text: string }) => `${m.sender}: ${m.text}`).join('\n')}

Сгенерируй реакцию в телефоне и реакцию в РП-чате.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              npcReplyText: {
                type: Type.STRING,
                description: 'Ответ НПС в личных сообщениях или комментарий под постом игрока.',
              },
              npcResponderId: {
                type: Type.STRING,
                description: 'ID ответившего НПС: kira, marcus или elena',
              },
              secondaryCommentAuthorId: {
                type: Type.STRING,
                description: 'Второй НПС (kira, marcus или elena), если действие — публикация поста',
              },
              secondaryCommentText: {
                type: Type.STRING,
                description: 'Комментарий второго НПС (если уместно)',
              },
              rpChatReaction: {
                type: Type.STRING,
                description: 'Реакция персонажа в самом РП-чате (1-2 абзаца с действиями *...* и прямой речью), связывающая действие в телефоне с физическим миром.',
              },
              affinityDelta: {
                type: Type.INTEGER,
                description: 'Изменение отношения целевого НПС (-10..+10)',
              },
              userFollowersDelta: {
                type: Type.INTEGER,
                description: 'Прирост/убыль подписчиков игрока (-5..+30)',
              },
              bridgeLog: {
                type: Type.STRING,
                description: 'Запись о том, как действие в телефоне повлияло на РП-чат.',
              },
            },
            required: [
              'npcReplyText',
              'npcResponderId',
              'rpChatReaction',
              'affinityDelta',
              'userFollowersDelta',
              'bridgeLog',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error: any) {
      console.error('Error in /api/phone-action:', error);
      res.status(500).json({
        error: error?.message || 'Ошибка обработки действия в телефоне.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ST LivePhone Server running on http://localhost:${PORT}`);
  });
}

startServer();
