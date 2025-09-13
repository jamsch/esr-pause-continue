package expo.modules.audioutils

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.*
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.*

class AudioutilsModule : Module() {
  
  // Helper function to find the data chunk in a WAV file
  private fun findDataChunk(data: ByteArray): Pair<Long, Long> {
    var offset = 12L // Start after RIFF header
    
    while (offset < data.size - 8) {
      // Read chunk ID (4 bytes)
      val chunkID = String(data, offset.toInt(), 4)
      
      // Read chunk size (4 bytes, little-endian)
      val chunkSize = (data[offset.toInt() + 4].toInt() and 0xFF) or
                     ((data[offset.toInt() + 5].toInt() and 0xFF) shl 8) or
                     ((data[offset.toInt() + 6].toInt() and 0xFF) shl 16) or
                     ((data[offset.toInt() + 7].toInt() and 0xFF) shl 24)
      
      if (chunkID == "data") {
        return Pair(offset + 8, chunkSize.toLong())
      }
      
      // Move to next chunk
      offset += 8 + chunkSize
      if (chunkSize % 2 == 1) {
        offset += 1 // Skip padding byte if chunk size is odd
      }
    }
    
    // Fallback: assume data starts at offset 44 (standard WAV header)
    return Pair(44, data.size.toLong() - 44)
  }
  
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('Audioutils')` in JavaScript.
    Name("Audioutils")
    
    AsyncFunction("joinAudioFiles") { audioFiles: List<String> ->
      try {
        if (audioFiles.isEmpty()) {
          throw IllegalArgumentException("No audio files provided")
        }
        
        // Convert URL strings to file paths
        val firstFilePath = if (audioFiles[0].startsWith("file://")) {
          audioFiles[0].substring(7) // Remove "file://" prefix
        } else {
          audioFiles[0]
        }
        
        // Generate output file path
        val outputPath = File(firstFilePath).parent + "/joined_audio_${System.currentTimeMillis()}.wav"
        
        // Read first file to get header information
        val firstFile = File(firstFilePath)
        if (!firstFile.exists()) {
          throw FileNotFoundException("First audio file not found: $firstFilePath")
        }
        
        val firstFileStream = FileInputStream(firstFile)
        val header = ByteArray(44) // Standard WAV header size
        firstFileStream.read(header)
        firstFileStream.close()
        
        // Validate WAV header
        val headerString = String(header, 0, 4)
        if (headerString != "RIFF") {
          throw IllegalArgumentException("First file is not a valid WAV file")
        }
        
        // Calculate total data size and find data chunk positions
        var totalDataSize = 0L
        val convertedFilePaths = mutableListOf<String>()
        val dataChunkOffsets = mutableListOf<Long>()
        val dataChunkSizes = mutableListOf<Long>()
        
        for (audioFile in audioFiles) {
          // Convert URL string to file path
          val filePath = if (audioFile.startsWith("file://")) {
            audioFile.substring(7) // Remove "file://" prefix
          } else {
            audioFile
          }
          convertedFilePaths.add(filePath)
          
          val file = File(filePath)
          if (!file.exists()) {
            throw FileNotFoundException("Audio file not found: $filePath")
          }
          
          val fileData = file.readBytes()
          val (dataOffset, dataSize) = findDataChunk(fileData)
          dataChunkOffsets.add(dataOffset)
          dataChunkSizes.add(dataSize)
          totalDataSize += dataSize
        }
        
        // Create a clean WAV header (extract format info from first file)
        val fmtChunk = header.sliceArray(12..35) // Extract fmt chunk
        
        // Create new header with clean structure
        val newHeader = ByteArray(44)
        val buffer = ByteBuffer.wrap(newHeader)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        
        // RIFF header
        buffer.put("RIFF".toByteArray())
        buffer.putInt((36 + totalDataSize).toInt())
        buffer.put("WAVE".toByteArray())
        
        // fmt chunk
        buffer.position(12)
        buffer.put(fmtChunk)
        
        // data chunk header
        buffer.position(36)
        buffer.put("data".toByteArray())
        buffer.putInt(totalDataSize.toInt())
        
        // Write joined file
        val outputStream = FileOutputStream(outputPath)
        outputStream.write(newHeader)
        
        // Append data from all files (only the data chunks)
        for ((index, filePath) in convertedFilePaths.withIndex()) {
          val fileData = File(filePath).readBytes()
          val dataOffset = dataChunkOffsets[index].toInt()
          val dataSize = dataChunkSizes[index].toInt()
          
          // Extract only the data chunk
          val audioData = fileData.sliceArray(dataOffset until (dataOffset + dataSize))
          outputStream.write(audioData)
        }
        
        outputStream.close()
        
        return@AsyncFunction outputPath
      } catch (e: Exception) {
        throw RuntimeException("Failed to join audio files: ${e.message}", e)
      }
    }
  }
}
