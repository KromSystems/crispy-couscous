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

// Инициализация таблиц базы данных
function initDatabase() {
    db.serialize(() => {
        // Таблица пользователей
        db.run(`CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            language TEXT DEFAULT 'ru',
            request_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Таблица подписок
        db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            subscription_type TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`);

        // Таблица истории сообщений
        db.run(`CREATE TABLE IF NOT EXISTS message_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message_type TEXT,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`);
    });
}

// Функции для работы с пользователями
const userDB = {
    // Создание или обновление пользователя
    upsertUser: (userId, username) => {
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
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    // Получение информации о пользователе
    getUser: (userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Обновление языка пользователя
    updateLanguage: (userId, language) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET language = ? WHERE user_id = ?',
                [language, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    // Увеличение счетчика запросов
    incrementRequestCount: (userId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET request_count = request_count + 1 WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
};

// Функции для работы с подписками
const subscriptionDB = {
    // Добавление подписки
    addSubscription: (userId, subscriptionType) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO subscriptions (user_id, subscription_type) 
                 VALUES (?, ?)`,
                [userId, subscriptionType],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    // Отмена подписки
    removeSubscription: (userId, subscriptionType) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE subscriptions 
                 SET is_active = 0 
                 WHERE user_id = ? AND subscription_type = ?`,
                [userId, subscriptionType],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    // Получение активных подписок пользователя
    getUserSubscriptions: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM subscriptions 
                 WHERE user_id = ? AND is_active = 1`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
};

// Функции для работы с историей сообщений
const historyDB = {
    // Добавление сообщения в историю
    addMessage: (userId, messageType, content) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO message_history (user_id, message_type, content) 
                 VALUES (?, ?, ?)`,
                [userId, messageType, content],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    // Получение последних сообщений пользователя
    getRecentMessages: (userId, limit = 5) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM message_history 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
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