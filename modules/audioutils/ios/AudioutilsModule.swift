import ExpoModulesCore
import Foundation

public class AudioutilsModule: Module {
  
  // Helper function to find the data chunk in a WAV file
  private func findDataChunk(in data: Data) -> (offset: Int64, size: Int64) {
    var offset = 12 // Start after RIFF header
    
    while offset < data.count - 8 {
      // Read chunk ID (4 bytes)
      let chunkID = data.subdata(in: offset..<(offset + 4))
      let chunkIDString = String(data: chunkID, encoding: .ascii) ?? ""
      
      // Read chunk size (4 bytes, little-endian)
      let chunkSizeBytes = data.subdata(in: (offset + 4)..<(offset + 8))
      let chunkSize = chunkSizeBytes.withUnsafeBytes { bytes in
        bytes.load(as: UInt32.self)
      }
      
      if chunkIDString == "data" {
        return (Int64(offset + 8), Int64(chunkSize))
      }
      
      // Move to next chunk
      offset += 8 + Int(chunkSize)
      if chunkSize % 2 == 1 {
        offset += 1 // Skip padding byte if chunk size is odd
      }
    }
    
    // Fallback: assume data starts at offset 44 (standard WAV header)
    return (44, Int64(data.count - 44))
  }
  
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('Audioutils')` in JavaScript.
    Name("Audioutils")

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("joinAudioFiles") { (audioFiles: [String]) -> String in
      guard !audioFiles.isEmpty else {
        throw NSError(domain: "AudioutilsModule", code: 1, userInfo: [NSLocalizedDescriptionKey: "No audio files provided"])
      }
      
      // Convert URL strings to file paths
      let firstFilePath = audioFiles[0].hasPrefix("file://") ? 
        URL(string: audioFiles[0])!.path : audioFiles[0]
      
      // Generate output file path
      let firstFileURL = URL(fileURLWithPath: firstFilePath)
      let outputPath = firstFileURL.deletingLastPathComponent().appendingPathComponent("joined_audio_\(Int(Date().timeIntervalSince1970)).wav").path
      
      // Read first file to get header information
      guard FileManager.default.fileExists(atPath: firstFilePath) else {
        throw NSError(domain: "AudioutilsModule", code: 2, userInfo: [NSLocalizedDescriptionKey: "First audio file not found: \(firstFilePath)"])
      }
      
      guard let firstFileData = FileManager.default.contents(atPath: firstFilePath) else {
        throw NSError(domain: "AudioutilsModule", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not read first audio file"])
      }
      
      guard firstFileData.count >= 44 else {
        throw NSError(domain: "AudioutilsModule", code: 4, userInfo: [NSLocalizedDescriptionKey: "First file is too small to be a valid WAV file"])
      }
      
      // Validate WAV header
      let headerBytes = firstFileData.subdata(in: 0..<4)
      let headerString = String(data: headerBytes, encoding: .ascii) ?? ""
      guard headerString == "RIFF" else {
        throw NSError(domain: "AudioutilsModule", code: 5, userInfo: [NSLocalizedDescriptionKey: "First file is not a valid WAV file"])
      }
      
      // Calculate total data size and find data chunk positions
      var totalDataSize: Int64 = 0
      var convertedFilePaths: [String] = []
      var dataChunkOffsets: [Int64] = []
      var dataChunkSizes: [Int64] = []
      
      for audioFile in audioFiles {
        // Convert URL string to file path
        let filePath = audioFile.hasPrefix("file://") ? 
          URL(string: audioFile)!.path : audioFile
        convertedFilePaths.append(filePath)
        
        guard FileManager.default.fileExists(atPath: filePath) else {
          throw NSError(domain: "AudioutilsModule", code: 6, userInfo: [NSLocalizedDescriptionKey: "Audio file not found: \(filePath)"])
        }
        
        guard let fileData = FileManager.default.contents(atPath: filePath) else {
          throw NSError(domain: "AudioutilsModule", code: 7, userInfo: [NSLocalizedDescriptionKey: "Could not read audio file: \(filePath)"])
        }
        
        // Find the data chunk
        let (dataOffset, dataSize) = findDataChunk(in: fileData)
        dataChunkOffsets.append(dataOffset)
        dataChunkSizes.append(dataSize)
        totalDataSize += dataSize
      }
      
      // Create a clean WAV header (extract format info from first file)
      let fmtChunk = firstFileData.subdata(in: 12..<36) // Extract fmt chunk
      
      // Create new header with clean structure
      var newHeader = Data()
      
      // RIFF header
      newHeader.append("RIFF".data(using: .ascii)!)
      var riffSize = UInt32(36 + totalDataSize)
      newHeader.append(Data(bytes: &riffSize, count: 4))
      newHeader.append("WAVE".data(using: .ascii)!)
      
      // fmt chunk
      newHeader.append(fmtChunk)
      
      // data chunk header
      newHeader.append("data".data(using: .ascii)!)
      var dataSize = UInt32(totalDataSize)
      newHeader.append(Data(bytes: &dataSize, count: 4))
      
      // Create output file
      FileManager.default.createFile(atPath: outputPath, contents: nil, attributes: nil)
      
      guard let outputHandle = FileHandle(forWritingAtPath: outputPath) else {
        throw NSError(domain: "AudioutilsModule", code: 7, userInfo: [NSLocalizedDescriptionKey: "Could not create output file"])
      }
      
      // Write new clean header
      outputHandle.write(newHeader)
      
      // Append data from all files (only the data chunks)
      for (index, filePath) in convertedFilePaths.enumerated() {
        guard let fileData = FileManager.default.contents(atPath: filePath) else {
          outputHandle.closeFile()
          throw NSError(domain: "AudioutilsModule", code: 8, userInfo: [NSLocalizedDescriptionKey: "Could not read audio file: \(filePath)"])
        }
        
        // Extract only the data chunk
        let dataOffset = Int(dataChunkOffsets[index])
        let dataSize = Int(dataChunkSizes[index])
        let audioData = fileData.subdata(in: dataOffset..<(dataOffset + dataSize))
        outputHandle.write(audioData)
      }
      
      outputHandle.closeFile()
      
      return outputPath
    }
  }
}
