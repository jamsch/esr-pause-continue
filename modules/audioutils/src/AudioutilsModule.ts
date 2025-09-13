import { NativeModule, requireNativeModule } from "expo";

import { AudioutilsModuleEvents } from "./Audioutils.types";

declare class AudioutilsModule extends NativeModule<AudioutilsModuleEvents> {
  /**
   * Join audio files into a single audio file
   * @param audioFiles - Array of audio file paths (.wav files)
   * @returns Path to the joined audio file
   */
  joinAudioFiles(audioFiles: string[]): Promise<string>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<AudioutilsModule>("Audioutils");
