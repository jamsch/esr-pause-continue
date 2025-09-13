# Resumable Speech Recognition with Expo

Just a proof-of-concept mostly generated with gpt slop.

The goal of this is just to show that it's possible to pause/continue speech recognition and also join the resulting audio files together.

`AudioUtilsModule` was created using

```sh
npx create-expo-module@latest --local audioutils
```

And is used like the following:

```ts
const joinedFileUri = await AudioutilsModule.joinAudioFiles([
  "file://path/to/recording1.wav",
  "file://path/to/recording2.wav",
]);
```
