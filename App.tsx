import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useResumableSpeechRecognition } from "./useResumableSpeechRecognition";
import { RecordingOverlay } from "./RecordingOverlay";
import AudioutilsModule from "./modules/audioutils";

interface AudioPlayerItemProps {
  fileUri: string;
  fileName: string;
}

const AudioPlayerItem: React.FC<AudioPlayerItemProps> = ({
  fileUri,
  fileName,
}) => {
  const player = useAudioPlayer({ uri: fileUri });
  const status = useAudioPlayerStatus(player);

  const handlePlay = () => {
    player.play();
  };

  const handleStop = () => {
    player.pause();
    player.seekTo(0);
  };

  const isPlaying = status.playing;

  return (
    <View style={styles.audioFileItem}>
      <View style={styles.audioFileInfo}>
        <Text style={styles.audioFileName}>{fileName}</Text>
      </View>
      <View style={styles.audioControls}>
        <TouchableOpacity
          style={[
            styles.audioButton,
            { backgroundColor: isPlaying ? "#FF9800" : "#4CAF50" },
          ]}
          onPress={isPlaying ? handleStop : handlePlay}
        >
          <Text style={styles.audioButtonText}>
            {isPlaying ? "Stop" : "Play"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function App() {
  const {
    isListening,
    isPaused,
    currentSession,
    allSessions,
    transcript,
    interimTranscript,
    start,
    pause,
    resume,
    stop,
    clearSessions,
    createNewSession,
    switchToSession,
  } = useResumableSpeechRecognition();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [currentPlayingFile, setCurrentPlayingFile] = useState<string | null>(
    null
  );
  const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
  const [joinedAudioFile, setJoinedAudioFile] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Player for joined audio file
  const joinedAudioPlayer = useAudioPlayer({
    uri: joinedAudioFile || "",
  });
  const joinedAudioStatus = useAudioPlayerStatus(joinedAudioPlayer);

  const handleStartRecording = async () => {
    try {
      await start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const handleClearSessions = async () => {
    Alert.alert(
      "Clear Sessions",
      "Are you sure you want to clear all sessions and delete audio files?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearSessions();
              setSelectedSessionId(null);
            } catch (error) {
              Alert.alert("Error", "Failed to clear sessions");
            }
          },
        },
      ]
    );
  };

  const handleCreateNewSession = () => {
    createNewSession();
    setSelectedSessionId(null);
    setShowRecordingOverlay(true);
  };

  const handleSwitchSession = (sessionId: string) => {
    switchToSession(sessionId);
    setSelectedSessionId(sessionId);
  };

  const handleJoinAudioFiles = async () => {
    if (!currentSession || currentSession.audioFiles.length === 0) {
      Alert.alert("No Audio", "No audio files available to join");
      return;
    }

    setIsJoining(true);
    try {
      console.log("Joining audio files:", currentSession.audioFiles);
      const joinedFileUri = await AudioutilsModule.joinAudioFiles(
        currentSession.audioFiles
      );
      setJoinedAudioFile(joinedFileUri);
      console.log("Joined audio file created:", joinedFileUri);
      Alert.alert("Success", "Audio files joined successfully!");
    } catch (error) {
      console.error("Error joining audio files:", error);
      Alert.alert("Error", "Failed to join audio files");
    } finally {
      setIsJoining(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (showRecordingOverlay) {
    return <RecordingOverlay onClose={() => setShowRecordingOverlay(false)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView style={styles.content}>
        {/* Session Tabs */}
        {allSessions.length > 0 && (
          <View style={styles.tabsContainer}>
            <Text style={styles.sectionTitle}>
              Sessions ({allSessions.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScrollView}
            >
              <View style={styles.tabsRow}>
                {allSessions.map((session, index) => {
                  const isSelected = selectedSessionId === session.id;
                  const sessionNumber = index + 1;
                  const timeStr = session.startTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <TouchableOpacity
                      key={session.id}
                      style={[
                        styles.tab,
                        isSelected && styles.activeTab,
                        session.isActive && styles.activeSessionTab,
                      ]}
                      onPress={() => handleSwitchSession(session.id)}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          isSelected && styles.activeTabText,
                        ]}
                      >
                        Session {sessionNumber}
                      </Text>
                      <Text
                        style={[
                          styles.tabSubtext,
                          isSelected && styles.activeTabSubtext,
                        ]}
                      >
                        {timeStr} • {session.audioFiles.length} files
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Transcript Display */}
        <View style={styles.transcriptContainer}>
          <Text style={styles.sectionTitle}>Transcript</Text>
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>
              {transcript}
              {interimTranscript && (
                <Text style={styles.interimText}>{interimTranscript}</Text>
              )}
            </Text>
          </View>
        </View>

        {/* Audio Files for Current Session */}
        {currentSession && currentSession.audioFiles.length > 0 && (
          <View style={styles.audioFilesContainer}>
            <Text style={styles.sectionTitle}>
              Audio Files ({currentSession.audioFiles.length})
            </Text>
            {currentSession.audioFiles.map((fileUri, index) => {
              const fileName =
                fileUri.split("/").pop() || `Recording ${index + 1}`;
              const isCurrentlyPlaying = currentPlayingFile === fileUri;

              return (
                <AudioPlayerItem
                  key={fileUri}
                  fileUri={fileUri}
                  fileName={fileName}
                />
              );
            })}

            {/* Join Audio Files Button */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.joinButton,
                isJoining && styles.buttonDisabled,
              ]}
              onPress={handleJoinAudioFiles}
              disabled={isJoining}
            >
              <Text style={styles.buttonText}>
                {isJoining ? "Joining..." : "Join Audio Files"}
              </Text>
            </TouchableOpacity>

            {/* Joined Audio Player */}
            {joinedAudioFile && (
              <View style={styles.joinedAudioContainer}>
                <Text style={styles.sectionTitle}>Joined Audio</Text>
                <View style={styles.joinedAudioPlayer}>
                  <View style={styles.joinedAudioInfo}>
                    <Text style={styles.joinedAudioFileName}>
                      {joinedAudioFile.split("/").pop() || "Joined Audio"}
                    </Text>
                    <Text style={styles.joinedAudioDuration}>
                      {formatTime(joinedAudioStatus.duration || 0)}
                    </Text>
                  </View>
                  <View style={styles.joinedAudioControls}>
                    <TouchableOpacity
                      style={[
                        styles.joinedAudioButton,
                        {
                          backgroundColor: joinedAudioStatus.playing
                            ? "#FF9800"
                            : "#4CAF50",
                        },
                      ]}
                      onPress={() => {
                        if (joinedAudioStatus.playing) {
                          joinedAudioPlayer.pause();
                        } else {
                          joinedAudioPlayer.play();
                        }
                      }}
                    >
                      <Text style={styles.joinedAudioButtonText}>
                        {joinedAudioStatus.playing ? "Pause" : "Play"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.joinedAudioButton, styles.stopButton]}
                      onPress={() => {
                        joinedAudioPlayer.pause();
                        joinedAudioPlayer.seekTo(0);
                      }}
                    >
                      <Text style={styles.joinedAudioButtonText}>Stop</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${
                              joinedAudioStatus.duration &&
                              joinedAudioStatus.duration > 0
                                ? ((joinedAudioStatus.currentTime || 0) /
                                    joinedAudioStatus.duration) *
                                  100
                                : 0
                            }%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.newSessionButton]}
            onPress={handleCreateNewSession}
          >
            <Text style={styles.buttonText}>New Session</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClearSessions}
            disabled={allSessions.length === 0}
          >
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingVertical: 30,
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
  },
  statusText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  sessionInfo: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  sessionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  transcriptContainer: {
    marginBottom: 20,
  },
  transcriptBox: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  interimText: {
    color: "#999",
    fontStyle: "italic",
  },
  tabsContainer: {
    marginBottom: 20,
  },
  tabsScrollView: {
    marginTop: 10,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 5,
  },
  tab: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    minWidth: 80,
  },
  activeTab: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  activeSessionTab: {
    borderColor: "#4CAF50",
    borderWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 2,
  },
  activeTabText: {
    color: "#fff",
  },
  tabSubtext: {
    fontSize: 10,
    color: "#999",
  },
  activeTabSubtext: {
    color: "#fff",
  },
  controls: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  pauseButton: {
    backgroundColor: "#FF9800",
  },
  stopButton: {
    backgroundColor: "#F44336",
  },
  newSessionButton: {
    backgroundColor: "#2196F3",
  },
  clearButton: {
    backgroundColor: "#9E9E9E",
  },
  audioFilesContainer: {
    marginBottom: 20,
  },
  audioFileItem: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "space-between",
  },
  audioFileInfo: {
    flex: 1,
    marginRight: 10,
  },
  audioFileName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  audioFileUri: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
  },
  audioControls: {
    flexDirection: "row",
    gap: 10,
  },
  audioButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    minWidth: 60,
  },
  audioButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  joinButton: {
    backgroundColor: "#9C27B0",
    marginTop: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  joinedAudioContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  joinedAudioPlayer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  joinedAudioInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  joinedAudioFileName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  joinedAudioDuration: {
    fontSize: 14,
    color: "#666",
  },
  joinedAudioControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    marginBottom: 15,
  },
  joinedAudioButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 80,
  },
  joinedAudioButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  progressBarContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 2,
  },
});
