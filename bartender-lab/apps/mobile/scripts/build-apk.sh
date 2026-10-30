#!/usr/bin/env bash
# Builds an installable Android APK (release build, signed with the development key).
# Requirements: Node 22, JDK 17+, Android SDK (ANDROID_HOME). Output: apps/mobile/dist/bartender-lab.apk
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ANDROID_HOME:?Define ANDROID_HOME con la ruta del Android SDK}"

CI=1 npx expo prebuild --platform android --clean --no-install
# React Native release builds need more memory than the template default.
sed -i.bak 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8/' android/gradle.properties
rm -f android/gradle.properties.bak

(cd android && NODE_ENV=production ./gradlew assembleRelease --console=plain)

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/bartender-lab.apk
echo "APK listo: $(pwd)/dist/bartender-lab.apk"
