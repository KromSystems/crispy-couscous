const { db } = require('./database');

// Функция для проверки содержимого таблицы
function checkTable(tableName) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
            if (err) {
                console.error(`Ошибка при проверке таблицы ${tableName}:`, err);
                reject(err);
            } else {
                console.log(`\nСодержимое таблицы ${tableName}:`);
                console.log('Количество записей:', rows.length);
                console.log('Записи:', rows);
                resolve(rows);
            }
        });
    });
}

// Проверяем все таблицы
async function checkDatabase() {
    try {
        console.log('Начало проверки базы данных...');
        
        // Проверяем структуру таблиц
        console.log('\nПроверка структуры таблиц:');
        await db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err) {
                console.error('Ошибка при получении списка таблиц:', err);
            } else {
                console.log('Существующие таблицы:', tables.map(t => t.name));
            }
        });

        // Проверяем содержимое каждой таблицы
        await checkTable('users');
        await checkTable('subscriptions');
        await checkTable('message_history');

        console.log('\nПроверка базы данных завершена');
    } catch (error) {
        console.error('Ошибка при проверке базы данных:', error);
    } finally {
        // Закрываем соединение с базой данных
        db.close((err) => {
            if (err) {
                console.error('Ошибка при закрытии базы данных:', err);
            } else {
                console.log('Соединение с базой данных закрыто');
            }
        });
    }
}

// Запускаем проверку
checkDatabase(); 