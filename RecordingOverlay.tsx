import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { useResumableSpeechRecognition } from "./useResumableSpeechRecognition";

interface RecordingOverlayProps {
  onClose: () => void;
}

export const RecordingOverlay: React.FC<RecordingOverlayProps> = ({
  onClose,
}) => {
  const {
    isListening,
    isPaused,
    transcript,
    interimTranscript,
    start,
    pause,
    resume,
    stop,
  } = useResumableSpeechRecognition();

  const [isHolding, setIsHolding] = useState(false);

  const handlePressIn = async () => {
    setIsHolding(true);
    try {
      if (isPaused) {
        await resume();
      } else if (!isListening) {
        await start({
          lang: "en-US",
          interimResults: true,
          continuous: true,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start recording");
      setIsHolding(false);
    }
  };

  const handlePressOut = async () => {
    setIsHolding(false);
    try {
      if (isListening) {
        await pause();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pause recording");
    }
  };

  const handleStopRecording = async () => {
    try {
      await stop();
      onClose();
    } catch (error) {
      Alert.alert("Error", "Failed to stop recording");
    }
  };

  const getStatusText = () => {
    if (isListening) return "Recording...";
    if (isPaused) return "Paused";
    return "Ready";
  };

  const getStatusColor = () => {
    if (isListening) return "#4CAF50";
    if (isPaused) return "#FF9800";
    return "#9E9E9E";
  };

  const getRecordButtonColor = () => {
    if (isListening) return "#F44336";
    if (isPaused) return "#FF9800";
    return "#4CAF50";
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={"light-content"} backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor() },
            ]}
          >
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Transcript Display */}
      <ScrollView style={styles.transcriptContainer}>
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>
            {transcript}
            {interimTranscript && (
              <Text style={styles.interimText}> {interimTranscript}</Text>
            )}
          </Text>
        </View>
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Record Button */}
        <TouchableOpacity
          style={[
            styles.recordButton,
            { backgroundColor: getRecordButtonColor() },
            isHolding && styles.recordButtonPressed,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
        >
          <View style={styles.recordButtonInner}>
            <Text style={styles.recordButtonText}>
              {isListening
                ? "Recording..."
                : isPaused
                ? "Hold to Resume"
                : "Hold to Record"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Instructions */}
        <Text style={styles.instructions}>
          Hold the button to record • Release to pause • Tap I'm Done to finish
        </Text>

        {/* Stop Button */}
        <TouchableOpacity
          style={[
            styles.stopButton,
            {
              opacity: isListening || isPaused ? 1 : 0.7,
            },
          ]}
          onPress={handleStopRecording}
          disabled={!isListening && !isPaused}
        >
          <Text style={styles.stopButtonText}>I'm Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // we really really should use safe area view here
    paddingTop: Platform.OS === "ios" ? 55 : 30,
    paddingBottom: Platform.OS === "ios" ? 0 : 25,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  statusContainer: {
    flex: 1,
    alignItems: "center",
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#333",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
  transcriptContainer: {
    flex: 1,
    padding: 20,
  },
  transcriptBox: {
    backgroundColor: "#1a1a1a",
    padding: 20,
    borderRadius: 12,
    minHeight: 200,
    borderWidth: 1,
    borderColor: "#333",
  },
  transcriptText: {
    fontSize: 18,
    lineHeight: 28,
    color: "#fff",
  },
  interimText: {
    color: "#999",
    fontStyle: "italic",
  },
  controls: {
    padding: 30,
    backgroundColor: "#1a1a1a",
    borderTopWidth: 1,
    borderTopColor: "#333",
    alignItems: "center",
  },
  recordButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  recordButtonInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
  },
  instructions: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  stopButton: {
    backgroundColor: "#F44336",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    opacity: 1,
  },
  stopButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
