import { useState, useCallback, useRef } from "react";
import {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionOptions,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as FileSystem from "expo-file-system";

export interface SpeechRecognitionResult {
  transcript: string;
  audioFileUri?: string;
}

export interface RecordingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  audioFiles: string[];
  transcripts: SpeechRecognitionResult[];
  isActive: boolean;
}

export interface UseResumableSpeechRecognitionReturn {
  // State
  isListening: boolean;
  isPaused: boolean;
  currentSession: RecordingSession | null;
  allSessions: RecordingSession[];
  transcript: string;
  interimTranscript: string;

  // Actions
  start: (options: ExpoSpeechRecognitionOptions) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  clearSessions: () => Promise<void>;

  // Session management
  createNewSession: () => RecordingSession;
  switchToSession: (sessionId: string) => void;
}

export const useResumableSpeechRecognition =
  (): UseResumableSpeechRecognitionReturn => {
    const [isListening, setIsListening] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentSession, setCurrentSession] =
      useState<RecordingSession | null>(null);
    const [allSessions, setAllSessions] = useState<RecordingSession[]>([]);
    const [transcript, setTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");

    const sessionCounterRef = useRef(0);

    // Handle speech recognition events using the hook
    useSpeechRecognitionEvent("start", () => {
      setIsListening(true);
      setIsPaused(false);
    });

    useSpeechRecognitionEvent("audiostart", (event) => {
      // Note: don't use this file until the "audioend" event is emitted
      // Note: event.uri will be null if `recordingOptions.persist` is not enabled
      console.log("Recording started for file:", event.uri);
    });

    useSpeechRecognitionEvent("result", (event) => {
      if (event.results && event.results.length > 0) {
        const result = event.results[0];

        const transcriptResult: SpeechRecognitionResult = {
          transcript: result.transcript,
        };

        if (event.isFinal) {
          // Final result
          setTranscript((prev) => prev + " " + result.transcript);
          setInterimTranscript("");

          // Update current session
          if (currentSession) {
            setAllSessions((prev) =>
              prev.map((session) =>
                session.id === currentSession.id
                  ? {
                      ...session,
                      transcripts: [...session.transcripts, transcriptResult],
                    }
                  : session
              )
            );

            setCurrentSession((prev) =>
              prev
                ? {
                    ...prev,
                    transcripts: [...prev.transcripts, transcriptResult],
                  }
                : null
            );
          }
        } else {
          // Interim result
          setInterimTranscript(result.transcript);
        }
      }
    });

    useSpeechRecognitionEvent("audioend", (event: any) => {
      // Recording ended, the file is now safe to use
      console.log("Local file path:", event.uri);
      // Android: Will be saved as a .wav file
      // iOS: Will be saved as a .wav file

      // Add the audio file to the current session and associate with latest transcript
      if (currentSession && event.uri) {
        updateSessionWithAudioFile(currentSession.id, event.uri);

        // Update the latest transcript with the audio file URI
        setAllSessions((prev) =>
          prev.map((session) =>
            session.id === currentSession.id
              ? {
                  ...session,
                  transcripts: session.transcripts.map((transcript, index) =>
                    index === session.transcripts.length - 1
                      ? { ...transcript, audioFileUri: event.uri }
                      : transcript
                  ),
                }
              : session
          )
        );

        if (currentSession) {
          setCurrentSession((prev) =>
            prev
              ? {
                  ...prev,
                  transcripts: prev.transcripts.map((transcript, index) =>
                    index === prev.transcripts.length - 1
                      ? { ...transcript, audioFileUri: event.uri }
                      : transcript
                  ),
                }
              : null
          );
        }
      }
    });

    useSpeechRecognitionEvent("end", () => {
      setIsListening(false);
      setIsPaused(true);
    });

    useSpeechRecognitionEvent("error", (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setIsPaused(false);
    });

    // Create a new recording session
    const createNewSession = useCallback((): RecordingSession => {
      const sessionId = `session_${Date.now()}_${sessionCounterRef.current++}`;
      const newSession: RecordingSession = {
        id: sessionId,
        startTime: new Date(),
        audioFiles: [],
        transcripts: [],
        isActive: true,
      };

      setAllSessions((prev) => [...prev, newSession]);
      setCurrentSession(newSession);
      setTranscript("");
      setInterimTranscript("");

      return newSession;
    }, []);

    // Switch to an existing session
    const switchToSession = useCallback(
      (sessionId: string) => {
        const session = allSessions.find((s) => s.id === sessionId);
        if (session) {
          setCurrentSession(session);
          setTranscript(session.transcripts.map((t) => t.transcript).join(" "));
          setInterimTranscript("");
        }
      },
      [allSessions]
    );

    // Update session with new audio file from recording events
    const updateSessionWithAudioFile = useCallback(
      (sessionId: string, audioFileUri: string) => {
        setAllSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  audioFiles: [...session.audioFiles, audioFileUri],
                }
              : session
          )
        );

        if (currentSession?.id === sessionId) {
          setCurrentSession((prev) =>
            prev
              ? { ...prev, audioFiles: [...prev.audioFiles, audioFileUri] }
              : null
          );
        }
      },
      [currentSession]
    );

    const sessionOptions = useRef<ExpoSpeechRecognitionOptions | undefined>(
      undefined
    );

    // Start recording
    const start = useCallback(
      async (options?: ExpoSpeechRecognitionOptions): Promise<void> => {
        const { status } =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (status !== "granted") {
          console.error("Permissions not granted");
          throw new Error("Permissions not granted");
        }
        if (options) {
          sessionOptions.current = options;
        }
        // Create new session if none exists or current session is ended
        if (!currentSession || !currentSession.isActive) {
          createNewSession();
        }

        // Merge with default recording options
        const startOptions = {
          ...sessionOptions.current,
          recordingOptions: {
            persist: true,
            outputDirectory: FileSystem.Paths.document.uri || undefined,
            outputFileName: `recording_${
              currentSession?.id || "session"
            }_${Date.now()}.wav`,
            outputSampleRate: 16000,
            outputEncoding: "pcmFormatInt16" as const,
            ...sessionOptions.current?.recordingOptions,
          },
        };

        return new Promise((resolve, reject) => {
          const startListener = ExpoSpeechRecognitionModule.addListener(
            "start",
            () => {
              startListener.remove();
              resolve();
            }
          );

          const errorListener = ExpoSpeechRecognitionModule.addListener(
            "error",
            (error) => {
              errorListener.remove();
              reject(error);
            }
          );

          ExpoSpeechRecognitionModule.start(startOptions);
        });
      },
      [currentSession, createNewSession]
    );

    // Pause recording
    const pause = useCallback(async () => {
      try {
        if (!isListening) {
          console.warn("Not currently listening");
          return;
        }
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.error("Error pausing speech recognition:", error);
      }
    }, [isListening]);

    // Resume recording
    const resume = useCallback(async () => {
      try {
        if (isListening) {
          console.warn("Already listening");
          return;
        }

        if (!currentSession) {
          console.warn("No active session to resume");
          return;
        }

        await start();
      } catch (error) {
        console.error("Error resuming speech recognition:", error);
      }
    }, [isListening, currentSession, start]);

    // Stop recording
    const stop = useCallback(async () => {
      try {
        if (!isListening && !isPaused) {
          console.warn("Not currently recording");
          return;
        }

        if (isListening) {
          ExpoSpeechRecognitionModule.stop();
        }

        setIsListening(false);
        setIsPaused(false);

        // End current session
        if (currentSession) {
          setAllSessions((prev) =>
            prev.map((session) =>
              session.id === currentSession.id
                ? { ...session, isActive: false, endTime: new Date() }
                : session
            )
          );

          setCurrentSession((prev) =>
            prev ? { ...prev, isActive: false, endTime: new Date() } : null
          );
        }
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
      }
    }, [isListening, isPaused, currentSession]);

    // Clear all sessions
    const clearSessions = useCallback(async () => {
      try {
        // Delete all audio files
        for (const session of allSessions) {
          for (const audioFile of session.audioFiles) {
            try {
              const file = new FileSystem.File(audioFile);
              const fileInfo = file.info();
              if (fileInfo.exists) {
                file.delete();
              }
            } catch (error) {
              console.error("Error deleting audio file:", audioFile, error);
            }
          }
        }

        setAllSessions([]);
        setCurrentSession(null);
        setTranscript("");
        setInterimTranscript("");
      } catch (error) {
        console.error("Error clearing sessions:", error);
      }
    }, [allSessions]);

    return {
      // State
      isListening,
      isPaused,
      currentSession,
      allSessions,
      transcript,
      interimTranscript,

      // Actions
      start,
      pause,
      resume,
      stop,
      clearSessions,

      // Session management
      createNewSession,
      switchToSession,
    };
  };
