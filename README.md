# BotsShink

[![Version](https://img.shields.io/badge/version-1.36.0-111111?style=for-the-badge&labelColor=000000)](https://github.com/Yuka2241/BotsShink/releases/latest)
[![Discord](https://img.shields.io/badge/мой%20Discord%20канал-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/cfh8DbCZ3g)
[![GitHub](https://img.shields.io/badge/GitHub-BotsShink-222222?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Yuka2241/BotsShink)

> [!CAUTION]
> ## ФЕЙКИ
> Я не веду никакие другие страницы, группы, Telegram или YouTube-каналы.  
> Если вы нашли что-то вне этой страницы GitHub, что распространяется от моего лица — **это фейк**.  
> Официальный Discord: **[мой Discord канал](https://discord.gg/cfh8DbCZ3g)**.

---

## Что такое BotsShink

**BotsShink** — это desktop-приложение для управления Minecraft Java ботами через удобный интерфейс.  
Оно сделано для запуска ботов на своём сервере или на сервере, где у тебя есть разрешение использовать ботов.

Приложение помогает:

- запускать несколько Minecraft-ботов;
- задавать IP, порт и версию Minecraft;
- включать AFK-режим;
- подключать отдельные скрипты к ботам;
- использовать общие модули: **Консоль**, **Телега**, **Дискорд**;
- проверять обновления через GitHub Releases;
- показывать Discord Activity / Rich Presence;
- устанавливать приложение через GitHub web-installer.

---

## Установка через web-installer

1. Открой страницу релизов:

   **[Скачать последнюю версию BotsShink](https://github.com/Yuka2241/BotsShink/releases/latest)**

2. Скачай файл вида:

```text
BotsShink-Web-Setup-1.36.0.exe
```

3. Запусти установщик.
4. Установщик сам скачает основной пакет приложения с GitHub.
5. После установки запусти **BotsShink**.

---

## Запуск из исходников

Нужно установить **Node.js LTS**.

```cmd
npm install
npm start
```

Для сборки web-installer:

```cmd
BUILD_WEB_INSTALLER_GITHUB.bat
```

Готовые файлы будут в:

```text
dist\nsis-web
```

Для GitHub Release нужны:

```text
BotsShink-Web-Setup-1.36.0.exe
botsshink-1.36.0-x64.nsis.7z
latest.yml
```

---

## Как пользоваться

1. Открой **BotsShink**.
2. На главной укажи:
   - IP сервера;
   - порт;
   - версию Minecraft или `auto`.
3. Во вкладке **Боты** добавь ники.
4. Во вкладке **Скрипты** включи нужные скрипты.
5. Нажми **Запуск**.

---

## Скрипты

Скрипты лежат в папке:

```text
BotSkripts
```

Первая строка каждого скрипта должна быть:

```js
Seleckt - BotSkripts
```

Русское название:

```js
// BotSkripts-Name: Название скрипта
```

Скрипт создаёт вкладку:

```js
// BotSkripts-CreateTab: Название вкладки
```

Скрипт общий для приложения:

```js
// BotSkripts-Global: true
```

Скрипт закреплён во вкладке “Скрипты”:

```js
// BotSkripts-Pinned: true
```

Скрипт нельзя применять к отдельным ботам:

```js
// BotSkripts-NoBotApply: true
```

---

## Discord Activity

В версии **1.36.0** добавлена Discord Activity / Rich Presence.

В Discord может отображаться:

```text
Играет в BotsShink
Актуальная версия: 1.36.0
Боты: 0 / 10 · Сервер: IP:порт · Скрипты: 3
```

В активности есть кнопки:

- **GitHub latest** — открывает последнюю версию на GitHub;
- **Discord channel** — открывает **[мой Discord канал](https://discord.gg/cfh8DbCZ3g)**.

Для работы нужно:

- открыть **Discord Desktop**;
- включить в Discord показ активности;
- использовать Discord Application ID: `1508794738478682183`.

---

## Логотип для Discord Activity

В архиве есть файл:

```text
build/discord_activity_logo_botsshink.png
```

Чтобы логотип появился в Discord Activity:

1. Открой Discord Developer Portal.
2. Зайди в приложение **BotsShink**.
3. Открой **Rich Presence → Art Assets**.
4. Загрузи файл `discord_activity_logo_botsshink.png`.
5. Назови asset так:

```text
botsshink
```

В коде уже указан ключ:

```js
largeImageKey: 'botsshink'
```

---

## Важно

BotsShink нужно использовать только:

- на своём Minecraft-сервере;
- или там, где тебе разрешили запускать ботов.

Если сервер пишет `Connection throttled`, увеличь задержку между входами.

---

## Ссылки

- **GitHub:** [Yuka2241/BotsShink](https://github.com/Yuka2241/BotsShink)
- **Последняя версия:** [GitHub Releases Latest](https://github.com/Yuka2241/BotsShink/releases/latest)
- **Discord:** [мой Discord канал](https://discord.gg/cfh8DbCZ3g)
