import { registerWebModule, NativeModule } from "expo";

import { ChangeEventPayload } from "./Audioutils.types";

type AudioutilsModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};

class AudioutilsModule extends NativeModule<AudioutilsModuleEvents> {
  PI = Math.PI;
  async joinAudioFiles(audioFiles: string[]): Promise<string> {
    return Promise.resolve("");
  }
}

export default registerWebModule(AudioutilsModule, "AudioutilsModule");
