const { subscriptionDB, historyDB } = require('./database');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

// Загрузка данных из JSON
const gitaData = JSON.parse(fs.readFileSync('./gita-data.json', 'utf8'));

// Функция для получения случайного стиха
function getRandomVerse() {
    const randomTopic = gitaData[Math.floor(Math.random() * gitaData.length)];
    const verse = randomTopic.verses[Math.floor(Math.random() * randomTopic.verses.length)];
    
    return {
        text: verse.text,
        chapter: verse.chapter,
        verse: verse.verse,
        commentary: verse.commentary
    };
}

// Функция для отправки ежедневного стиха всем подписчикам
async function sendDailyVerse() {
    try {
        // Получаем всех активных подписчиков
        const subscribers = await subscriptionDB.getAllActiveSubscribers('daily_verse');
        
        if (subscribers.length === 0) {
            console.log('Нет активных подписчиков для ежедневной рассылки');
            return;
        }

        const verse = getRandomVerse();
        const message = `🌅 Ежедневный стих из Бхагавад-Гиты:\n\n` +
            `Глава ${verse.chapter}, стих ${verse.verse}:\n` +
            `"${verse.text}"\n\n` +
            `💭 Комментарий:\n` +
            `${verse.commentary}`;

        // Отправляем стих каждому подписчику
        for (const subscriber of subscribers) {
            try {
                await bot.sendMessage(subscriber.user_id, message);
                await historyDB.addMessage(
                    subscriber.user_id,
                    'daily_verse',
                    `Отправлен ежедневный стих: Глава ${verse.chapter}, стих ${verse.verse}`
                );
            } catch (error) {
                console.error(`Ошибка при отправке стиха пользователю ${subscriber.user_id}:`, error);
                
                // Если пользователь заблокировал бота, отписываем его
                if (error.response && error.response.statusCode === 403) {
                    await subscriptionDB.removeSubscription(subscriber.user_id, 'daily_verse');
                    console.log(`Пользователь ${subscriber.user_id} заблокировал бота и был отписан`);
                }
            }
        }
    } catch (error) {
        console.error('Ошибка при отправке ежедневных стихов:', error);
    }
}

// Функция для запуска ежедневной рассылки
function startDailyVerseScheduler() {
    // Проверяем текущее время
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(9, 0, 0, 0); // Устанавливаем время на 9:00

    // Если текущее время больше 9:00, планируем на следующий день
    if (now > targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
    }

    // Вычисляем время до следующей рассылки
    const timeUntilNext = targetTime - now;

    // Планируем первую рассылку
    setTimeout(() => {
        sendDailyVerse();
        // После первой рассылки планируем следующие каждые 24 часа
        setInterval(sendDailyVerse, 24 * 60 * 60 * 1000);
    }, timeUntilNext);

    console.log(`Следующая рассылка запланирована на ${targetTime.toLocaleString()}`);
}

module.exports = {
    startDailyVerseScheduler,
    sendDailyVerse
}; 