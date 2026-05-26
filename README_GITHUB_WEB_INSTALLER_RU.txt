BotsShink GitHub Web Installer v1.25
====================================

Repo:
https://github.com/Yuka2241/BotsShink

Что делает эта версия:
- Создаёт маленький web-installer: BotsShink-Web-Setup-1.29.0.exe
- Основное приложение будет скачиваться с GitHub Releases.
- В installer уже прописана ссылка на пакет:
  https://github.com/Yuka2241/BotsShink/releases/download/v1.29.0/botsshink-1.29.0-x64.nsis.7z

ВАЖНО:
Web-installer заработает только после того, как ты загрузишь пакет приложения в GitHub Release v1.29.0.

Шаги:

1) Распакуй эту папку.

2) Запусти:
   BUILD_WEB_INSTALLER_GITHUB.bat

3) После сборки откроется папка dist.
   В ней должны быть файлы:
   - BotsShink-Web-Setup-1.29.0.exe
   - botsshink-1.29.0-x64.nsis.7z
   - latest.yml

4) Открой GitHub:
   https://github.com/Yuka2241/BotsShink

5) Перейди:
   Releases -> Draft a new release

6) Создай release:
   Tag: v1.29.0
   Title: BotsShink 1.29.0

7) Загрузи в release эти 3 файла из dist:
   - BotsShink-Web-Setup-1.29.0.exe
   - botsshink-1.29.0-x64.nsis.7z
   - latest.yml

8) Нажми Publish release.

9) Теперь пользователь скачивает только:
   BotsShink-Web-Setup-1.29.0.exe

   А сам installer скачает основной пакет с GitHub.

Если сборка пишет ENOSPC:
- освободи 5-10 ГБ на диске C:
- удали старые node_modules/dist из старых версий проекта

Если CMD сразу закрывается:
- запусти bat через обычный cmd, а не двойным кликом
