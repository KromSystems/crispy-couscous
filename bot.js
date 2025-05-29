require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { userDB, subscriptionDB, historyDB } = require('./database');
const fs = require('fs');
const OpenAI = require('openai');
const { startDailyVerseScheduler } = require('./dailyVerse');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Инициализация OpenAI клиента для IO Intelligence API
const openai = new OpenAI({
    apiKey: process.env.secret,
    baseURL: "https://api.intelligence.io.solutions/api/v1/",
});

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

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;

    try {
        await userDB.upsertUser(userId, username);
        await historyDB.addMessage(userId, 'command', '/start');
        
        const welcomeMessage = `Привет, ${username}! 👋\n\n` +
            'Я бот для ежедневных стихов и поэзии.\n\n' +
            'Доступные команды:\n' +
            '/help - показать справку\n' +
            '/subscribe - подписаться на ежедневный стих\n' +
            '/history - показать последние 5 советов\n' +
            '/lang - сменить язык\n';
        
        bot.sendMessage(chatId, welcomeMessage);
    } catch (error) {
        console.error('Ошибка при обработке команды /start:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
});

// Обработка команды /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await historyDB.addMessage(userId, 'command', '/help');
        await userDB.incrementRequestCount(userId);

        const helpMessage = '📚 Справка по командам:\n\n' +
            '/start - начать работу с ботом\n' +
            '/help - показать эту справку\n' +
            '/subscribe - подписаться на ежедневный стих\n' +
            '/history - показать последние 5 советов\n' +
            '/lang - сменить язык (ru/en)\n\n' +
            'Для получения стиха просто напишите мне любое сообщение!';

        bot.sendMessage(chatId, helpMessage);
    } catch (error) {
        console.error('Ошибка при обработке команды /help:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
});

// Обработка команды /subscribe
bot.onText(/\/subscribe/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await historyDB.addMessage(userId, 'command', '/subscribe');
        await userDB.incrementRequestCount(userId);

        const subscriptions = await subscriptionDB.getUserSubscriptions(userId);
        const hasSubscription = subscriptions.some(sub => sub.subscription_type === 'daily_verse');

        if (hasSubscription) {
            await subscriptionDB.removeSubscription(userId, 'daily_verse');
            bot.sendMessage(chatId, 'Вы отписались от ежедневных стихов.');
        } else {
            await subscriptionDB.addSubscription(userId, 'daily_verse');
            bot.sendMessage(chatId, 'Вы подписались на ежедневные стихи! Каждый день в 9:00 вы будете получать новый стих.');
        }
    } catch (error) {
        console.error('Ошибка при обработке команды /subscribe:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
});

// Обработка команды /history
bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await historyDB.addMessage(userId, 'command', '/history');
        await userDB.incrementRequestCount(userId);

        const messages = await historyDB.getRecentMessages(userId, 5);
        
        if (messages.length === 0) {
            bot.sendMessage(chatId, 'У вас пока нет истории сообщений.');
            return;
        }

        const historyMessage = '📜 Ваша последняя история:\n\n' +
            messages.map(msg => {
                const date = new Date(msg.created_at).toLocaleString();
                return `${date}\n${msg.content}\n`;
            }).join('\n');

        bot.sendMessage(chatId, historyMessage);
    } catch (error) {
        console.error('Ошибка при обработке команды /history:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
});

// Обработка команды /lang
bot.onText(/\/lang (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const newLang = match[1].toLowerCase();

    try {
        await historyDB.addMessage(userId, 'command', `/lang ${newLang}`);
        await userDB.incrementRequestCount(userId);

        if (['ru', 'en'].includes(newLang)) {
            await userDB.updateLanguage(userId, newLang);
            bot.sendMessage(chatId, `Язык успешно изменен на ${newLang === 'ru' ? 'русский' : 'английский'}`);
        } else {
            bot.sendMessage(chatId, 'Поддерживаемые языки: ru, en');
        }
    } catch (error) {
        console.error('Ошибка при обработке команды /lang:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
});

// Обработка обычных сообщений
bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userMessage = msg.text;

        try {
            await historyDB.addMessage(userId, 'user_message', userMessage);
            await userDB.incrementRequestCount(userId);

            // Поиск совпадающей темы
            let matchedTopic = null;
            for (let item of gitaData) {
                if (item.keywords.some(kw => userMessage.includes(kw))) {
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
                await historyDB.addMessage(userId, 'bot_response', response);
                bot.sendMessage(chatId, response);
            } else {
                // Отправляем сообщение о загрузке
                const loadingMsg = await bot.sendMessage(chatId, '🔍 Ищу мудрость в Бхагавад-Гите...');
                
                // Получаем ответ от AI
                const aiResponse = await getAIResponse(userMessage);
                
                if (aiResponse) {
                    // Удаляем сообщение о загрузке
                    await bot.deleteMessage(chatId, loadingMsg.message_id);
                    // Отправляем ответ от AI
                    await historyDB.addMessage(userId, 'bot_response', aiResponse);
                    bot.sendMessage(chatId, aiResponse);
                } else {
                    // В случае ошибки отправляем стандартное сообщение
                    await bot.deleteMessage(chatId, loadingMsg.message_id);
                    await historyDB.addMessage(userId, 'bot_response', 'Не удалось найти конкретный совет, но помни: «Ты всегда имеешь право на деятельность, но не на её плоды» (Глава 2, стих 47).');
                    bot.sendMessage(chatId, 'Не удалось найти конкретный совет, но помни: «Ты всегда имеешь право на деятельность, но не на её плоды» (Глава 2, стих 47).');
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке сообщения:', error);
            if (error.response && error.response.statusCode === 403) {
                console.log('Бот был заблокирован пользователем');
            }
            bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    }
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

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

// Запускаем ежедневную рассылку
startDailyVerseScheduler();

console.log('Бот запущен...');
