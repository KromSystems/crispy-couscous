const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Загрузка токена
const token = 'ВАШ_ТОКЕН'; // ← замени на свой!

// Создание бота
const bot = new TelegramBot(token, { polling: true });

// Загрузка данных из JSON
let gitaData = JSON.parse(fs.readFileSync('gita-data.json', 'utf8'));

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Здравствуйте! Напишите ваш вопрос, и я подберу вам совет из Бхагавад-Гиты.');
});

// Обработка текстовых сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
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
    bot.sendMessage(chatId, response);
  } else {
    bot.sendMessage(chatId, 'Не удалось найти конкретный совет, но помни: «Ты всегда имеешь право на деятельность, но не на её плоды» (Глава 2, стих 47).');
  }
});
