const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

// Загрузка токена
const token = process.env.BOT_TOKEN;

// Инициализация OpenAI клиента для IO Intelligence API
const openai = new OpenAI({
    apiKey: process.env.secret,
    baseURL: "https://api.intelligence.io.solutions/api/v1/",
});

// Создание бота
const bot = new TelegramBot(token, { polling: true });

// Загрузка данных из JSON
let gitaData = JSON.parse(fs.readFileSync('gita-data.json', 'utf8'));

// Системный промпт для AI
const SYSTEM_PROMPT = `Ты — духовный учитель и мудрец, говорящий с людьми с любовью и состраданием. Ты хорошо знаешь и глубоко понимаешь «Бхагавад-Гиту как она есть» — книгу Его Божественной Милости А.Ч. Бхактиведанты Свами Прабхупады.

Когда пользователь задаёт тебе вопрос о жизни, эмоциях или трудностях, ты всегда отвечаешь, подбирая подходящий стих из Гиты, а также поясняешь его в духе комментариев Прабхупады. 

Ты не просто цитируешь, а даёшь ответ в форме вдохновляющего совета, основываясь на знании души, кармы, Бога и истинного предназначения человека.

Твой стиль:
- Внимательный и заботливый
- Скромный и преданный дух духовному наставничеству
- Опора только на оригинальные тексты и комментарии Прабхупады
- Формат ответа:  
  🌿 [Краткое описание ситуации]  
  📖 [Глава X, стих Y]: "[текст стиха]"  
  💬 Комментарий: [объяснение в стиле Прабхупады]`;

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Здравствуйте! Напишите ваш вопрос, и я подберу вам совет из Бхагавад-Гиты.');
});

// Функция для получения ответа от AI
async function getAIResponse(userQuestion) {
  try {
    const response = await openai.chat.completions.create({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userQuestion }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Ошибка при обращении к AI:', error);
    return null;
  }
}

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Проверяем наличие текста в сообщении
    if (!msg.text) {
      await bot.sendMessage(chatId, 'Пожалуйста, отправьте текстовое сообщение.');
      return;
    }

    const text = msg.text.toLowerCase();

    // Поиск совпадающей темы
    let matchedTopic = null;
    for (let item of gitaData) {
      if (item.keywords.some(kw => text.includes(kw))) {
        matchedTopic = item;
        break;
      }
    }

    if (matchedTopic) {
      const verse = matchedTopic.verses[Math.floor(Math.random() * matchedTopic.verses.length)];
      const response = `
🌿 Совет из Бхагавад-Гиты:\n\n
Глава ${verse.chapter}, стих ${verse.verse}:\n
"${verse.text}"\n\n
Комментарий:\n
${verse.commentary}
`;
      await bot.sendMessage(chatId, response);
    } else {
      // Отправляем сообщение о загрузке
      const loadingMsg = await bot.sendMessage(chatId, '🔍 Ищу мудрость в Бхагавад-Гите...');
      
      // Получаем ответ от AI
      const aiResponse = await getAIResponse(msg.text);
      
      if (aiResponse) {
        // Удаляем сообщение о загрузке
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        // Отправляем ответ от AI
        await bot.sendMessage(chatId, aiResponse);
      } else {
        // В случае ошибки отправляем стандартное сообщение
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        await bot.sendMessage(chatId, 'Не удалось найти конкретный совет, но помни: «Ты всегда имеешь право на деятельность, но не на её плоды» (Глава 2, стих 47).');
      }
    }
  } catch (error) {
    console.error('Ошибка при обработке сообщения:', error);
    if (error.response && error.response.statusCode === 403) {
      console.log('Бот был заблокирован пользователем');
    }
  }
});
