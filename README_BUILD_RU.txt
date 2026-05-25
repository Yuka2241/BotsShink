BotsShink build ready v1.22

Use BUILD_INSTALLER_EXE.bat to build installer.
Use CLEAN_BUILD_INSTALLER.bat if dependencies are broken.
Use BUILD_PORTABLE_EXE.bat for portable exe.
Use BUILD_UNPACKED_FAST.bat if installer/portable is too slow.

IMPORTANT: v1.22 fixes the Windows batch problem where npm -v could end the script early.

=== v1.24: GitHub update check ===

This version checks GitHub Releases:
https://github.com/Yuka2241/BotsShink/releases

How it works:
1. On app start, BotsShink checks the latest GitHub Release.
2. If latest release version is newer than package.json version, a top banner appears.
3. Button opens GitHub Releases so the user can download the installer/update.
4. If no releases exist yet, manual check will show that GitHub Release has not been created yet.

To make update check show an update:
1. Build version 1.24.0.
2. Upload current project to GitHub repo Yuka2241/BotsShink.
3. Create GitHub Release with tag v1.25.0 or higher.
4. Add installer files to that release.
5. Open app version 1.24.0 and press "Проверить обновления".
