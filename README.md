# Branch Beetle 🌿🪲

**Branch Beetle** is a mobile-first interactive storytelling app for creating short branching narrative games on a phone.

It is being developed as part of a PhD research project on participatory game-making, low-barrier authoring tools, autobiographical/lived-experience storytelling, and mobile-first creative tools. The app is inspired by tools such as Twine, but is designed specifically for short workshops with novice creators who may not have access to laptops or prior game-making experience.

> Working tagline: **Create branching narrative games on your phone.**

---

## ✨ What Branch Beetle does

Branch Beetle lets creators make small interactive stories from:

- **Stories** — one complete branching project
- **Scenes** — short story moments or pages
- **Choices** — buttons that let players move through the story
- **Story traces** — things the story remembers after a choice
- **Conditional choices** — choices that appear only when the story remembers something
- **Story values** — simple values that can increase or decrease
- **Media** — uploaded images, drawings, audio files, and voice notes
- **Play mode** — a clean preview/player experience
- **HTML export** — export a playable story outside the app

The interface is designed to stay gentle, beginner-friendly, and workshop-ready.

---

## 🪲 Design metaphor

The current app identity uses a soft **Branch Beetle** metaphor:

| App concept | Metaphor |
| --- | --- |
| Home screen | Forest |
| Story project | Story tree |
| Scene | Branch |
| Choice | Fork |
| Player | Beetle |
| Story trace | Something the beetle remembers or picks up |

The metaphor is mainly used for onboarding, templates, illustrations, and friendly interface language. Core terms stay clear and simple: **Story**, **Scene**, **Choice**, **Story traces**, **Play**, and **Export**.

---

## 📱 Current feature state

Implemented or in active prototype form:

- Multiple story projects
- Create, rename, delete, import, and export stories
- Create and edit scenes
- Add, edit, delete, and link choices
- Create new scenes from choices
- Preview from a selected scene
- Play through a full story
- Track visited scenes and chosen choices during play
- Story traces / remembered choices
- Conditional choices based on story traces
- Story-level values
- Uploaded images
- Finger drawings
- Uploaded audio
- Voice notes
- HTML export with embedded media and branching logic

This is still a research prototype, so some features may change during evaluation.

---

## 🧪 Research context

Branch Beetle is part of a design science / HCI research project asking how mobile-first storytelling tools can support participatory game-making workshops.

The broader research context includes:

- participatory game-making
- interactive storytelling
- novice creator support
- mobile-first authorship
- low-barrier creative tools
- autobiographical and lived-experience storytelling
- migration and displacement storytelling
- ethical support for sensitive, personal, symbolic, or fictional narratives

The app is intended to support participant control: creators should be able to decide how personal, fictionalized, abstract, private, or shareable their story becomes.

---

## 🛠️ Tech stack

- [Expo](https://expo.dev/)
- React Native
- TypeScript
- Expo Router
- Zustand
- AsyncStorage
- Zod
- expo-file-system
- expo-sharing
- expo-document-picker
- expo-image-picker
- expo-audio
- react-native-gesture-handler
- react-native-reanimated
- react-native-signature-canvas
- react-native-webview

---

## 🚀 Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npx expo start
```

You can then open the app using:

- Expo Go
- an Android emulator
- an iOS simulator
- a development build

---

## 📦 Building a test app

For internal Android testing, use EAS Build:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

A preview build can be shared with expert evaluators as an installable Android APK link.

For iOS testing, additional Apple signing and device registration steps may be required.

---

## 🧹 Useful development checks

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Run Expo project diagnostics:

```bash
npx expo-doctor
```

---

## 🗂️ Project structure

The exact structure may change during development, but the main app areas are:

```text
app/
  index.tsx              # Home / story forest
  story.tsx              # Story overview / story tree
  scene-editor.tsx       # Scene writing and branching
  scene-media.tsx        # Images, drawings, audio, voice notes
  draw.tsx               # Drawing pad
  play.tsx               # Play mode
store/
  storyStore.ts          # Story data, persistence, export/import logic
```

---

## 🧭 Design principles

Branch Beetle should feel:

- gentle
- playful
- low-pressure
- mobile-first
- cognitively accessible
- emotionally careful
- suitable for workshops
- supportive of personal, symbolic, and fictional storytelling

The goal is not to become a full game engine. The goal is to make small interactive stories possible without overwhelming new creators.

---

## ⚠️ Status

Branch Beetle is currently an early research prototype under active development and evaluation.

It is not yet a public production app.

---

## 👩‍💻 Author

Developed by **Kseniia Harshina** as part of PhD research at the University of Klagenfurt.

Research areas: HCI, game studies, participatory design, mobile-first game-making, autobiographical game-making, and interactive storytelling.

---

## 📄 License

License information is not finalized yet.

Before reuse, publication, or distribution, please contact the author.
