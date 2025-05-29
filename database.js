const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Создаем подключение к базе данных
const db = new sqlite3.Database(path.join(__dirname, 'bot_database.db'), (err) => {
    if (err) {
        console.error('Ошибка при подключении к базе данных:', err);
    } else {
        console.log('Подключение к базе данных установлено');
        initDatabase();
    }
});

// Включаем режим отладки для SQLite
db.on('trace', (sql) => {
    console.log('SQL:', sql);
});

// Инициализация таблиц базы данных
function initDatabase() {
    console.log('Начало инициализации базы данных...');
    db.serialize(() => {
        // Таблица пользователей
        db.run(`CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            language TEXT DEFAULT 'ru',
            request_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Ошибка при создании таблицы users:', err);
            } else {
                console.log('Таблица users создана или уже существует');
            }
        });

        // Таблица подписок
        db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            subscription_type TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка при создании таблицы subscriptions:', err);
            } else {
                console.log('Таблица subscriptions создана или уже существует');
            }
        });

        // Таблица истории сообщений
        db.run(`CREATE TABLE IF NOT EXISTS message_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message_type TEXT,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка при создании таблицы message_history:', err);
            } else {
                console.log('Таблица message_history создана или уже существует');
            }
        });
    });
}

// Функции для работы с пользователями
const userDB = {
    // Создание или обновление пользователя
    upsertUser: (userId, username) => {
        console.log(`Попытка создания/обновления пользователя: ${userId}, ${username}`);
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (user_id, username) 
                 VALUES (?, ?) 
                 ON CONFLICT(user_id) 
                 DO UPDATE SET 
                    username = excluded.username,
                    last_active = CURRENT_TIMESTAMP`,
                [userId, username],
                function(err) {
                    if (err) {
                        console.error('Ошибка при создании/обновлении пользователя:', err);
                        reject(err);
                    } else {
                        console.log(`Пользователь успешно создан/обновлен: ${userId}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    },

    // Получение информации о пользователе
    getUser: (userId) => {
        console.log(`Запрос информации о пользователе: ${userId}`);
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
                if (err) {
                    console.error('Ошибка при получении информации о пользователе:', err);
                    reject(err);
                } else {
                    console.log(`Получена информация о пользователе: ${userId}`, row);
                    resolve(row);
                }
            });
        });
    },

    // Обновление языка пользователя
    updateLanguage: (userId, language) => {
        console.log(`Обновление языка пользователя: ${userId}, язык: ${language}`);
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET language = ? WHERE user_id = ?',
                [language, userId],
                function(err) {
                    if (err) {
                        console.error('Ошибка при обновлении языка:', err);
                        reject(err);
                    } else {
                        console.log(`Язык пользователя ${userId} обновлен на ${language}`);
                        resolve(this.changes);
                    }
                }
            );
        });
    },

    // Увеличение счетчика запросов
    incrementRequestCount: (userId) => {
        console.log(`Увеличение счетчика запросов для пользователя: ${userId}`);
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET request_count = request_count + 1 WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) {
                        console.error('Ошибка при увеличении счетчика запросов:', err);
                        reject(err);
                    } else {
                        console.log(`Счетчик запросов пользователя ${userId} увеличен`);
                        resolve(this.changes);
                    }
                }
            );
        });
    }
};

// Функции для работы с подписками
const subscriptionDB = {
    // Добавление подписки
    addSubscription: (userId, subscriptionType) => {
        console.log(`Добавление подписки: пользователь ${userId}, тип ${subscriptionType}`);
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO subscriptions (user_id, subscription_type) 
                 VALUES (?, ?)`,
                [userId, subscriptionType],
                function(err) {
                    if (err) {
                        console.error('Ошибка при добавлении подписки:', err);
                        reject(err);
                    } else {
                        console.log(`Подписка успешно добавлена: ${userId}, ${subscriptionType}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    },

    // Отмена подписки
    removeSubscription: (userId, subscriptionType) => {
        console.log(`Отмена подписки: пользователь ${userId}, тип ${subscriptionType}`);
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE subscriptions 
                 SET is_active = 0 
                 WHERE user_id = ? AND subscription_type = ?`,
                [userId, subscriptionType],
                function(err) {
                    if (err) {
                        console.error('Ошибка при отмене подписки:', err);
                        reject(err);
                    } else {
                        console.log(`Подписка успешно отменена: ${userId}, ${subscriptionType}`);
                        resolve(this.changes);
                    }
                }
            );
        });
    },

    // Получение активных подписок пользователя
    getUserSubscriptions: (userId) => {
        console.log(`Запрос активных подписок пользователя: ${userId}`);
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM subscriptions 
                 WHERE user_id = ? AND is_active = 1`,
                [userId],
                (err, rows) => {
                    if (err) {
                        console.error('Ошибка при получении подписок:', err);
                        reject(err);
                    } else {
                        console.log(`Получены подписки пользователя ${userId}:`, rows);
                        resolve(rows);
                    }
                }
            );
        });
    },

    // Получение всех активных подписчиков
    getAllActiveSubscribers: (subscriptionType) => {
        console.log(`Запрос всех активных подписчиков типа: ${subscriptionType}`);
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT DISTINCT u.user_id, u.username 
                 FROM users u 
                 JOIN subscriptions s ON u.user_id = s.user_id 
                 WHERE s.subscription_type = ? AND s.is_active = 1`,
                [subscriptionType],
                (err, rows) => {
                    if (err) {
                        console.error('Ошибка при получении списка подписчиков:', err);
                        reject(err);
                    } else {
                        console.log(`Получен список активных подписчиков:`, rows);
                        resolve(rows);
                    }
                }
            );
        });
    }
};

// Функции для работы с историей сообщений
const historyDB = {
    // Добавление сообщения в историю
    addMessage: (userId, messageType, content) => {
        console.log(`Добавление сообщения в историю: пользователь ${userId}, тип ${messageType}`);
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO message_history (user_id, message_type, content) 
                 VALUES (?, ?, ?)`,
                [userId, messageType, content],
                function(err) {
                    if (err) {
                        console.error('Ошибка при добавлении сообщения в историю:', err);
                        reject(err);
                    } else {
                        console.log(`Сообщение успешно добавлено в историю: ${userId}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    },

    // Получение последних сообщений пользователя
    getRecentMessages: (userId, limit = 5) => {
        console.log(`Запрос последних ${limit} сообщений пользователя: ${userId}`);
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM message_history 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) {
                        console.error('Ошибка при получении истории сообщений:', err);
                        reject(err);
                    } else {
                        console.log(`Получена история сообщений пользователя ${userId}:`, rows);
                        resolve(rows);
                    }
                }
            );
        });
    }
};

module.exports = {
    db,
    userDB,
    subscriptionDB,
    historyDB
}; 