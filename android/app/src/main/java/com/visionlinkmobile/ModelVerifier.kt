package com.visionlinkmobile

import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

object ModelVerifier {
    private const val TAG = "ModelVerifier"

    // Complete 64-character SHA-256 checksums calculated from the exact production models
    const val SHA256_HAUSA = "7889E1A9E07CABF6E1CBEC4CE09D8EED49FC63BB729770F60DCB7DE2F1D34C74"
    const val SHA256_ENGLISH = "469C630D209E139DD392A66BF4ABDE4AB86390A0269C1E47B4E5D7CE81526B01"
    const val SHA256_ARABIC = "1578A9B27D01A0626227225B148179628B770607DD61BDBBC41865BD399106B1"
    const val SHA256_HINDI = "AA63BCF2CD493B55A450F280E23CF77F03AFC9AF7015E6E5ACD43B652F166C88"

    fun getExpectedHash(language: String): String? {
        val lang = language.lowercase()
        return when {
            lang.startsWith("ha") -> SHA256_HAUSA
            lang.startsWith("en") -> SHA256_ENGLISH
            lang.startsWith("ar") -> SHA256_ARABIC
            lang.startsWith("hi") -> SHA256_HINDI
            else -> null
        }
    }

    /**
     * Calculates the complete 64-character uppercase SHA-256 hash of a file.
     */
    fun calculateSha256(file: File): String {
        if (!file.exists()) {
            throw IllegalArgumentException("File does not exist: ${file.absolutePath}")
        }
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(64 * 1024)
            var bytesRead: Int
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
        }
        val hashBytes = digest.digest()
        val sb = StringBuilder()
        for (b in hashBytes) {
            sb.append(String.format("%02X", b))
        }
        return sb.toString()
    }

    /**
     * Verifies that a file exists and matches the expected full 64-character SHA-256 hash.
     */
    fun verifyChecksum(file: File, expectedHash: String): Boolean {
        if (!file.exists()) {
            Log.w(TAG, "Verification failed: File not found at ${file.absolutePath}")
            return false
        }
        return try {
            val actualHash = calculateSha256(file)
            val matches = actualHash.equals(expectedHash, ignoreCase = true)
            if (!matches) {
                Log.e(TAG, "SHA-256 Checksum MISMATCH for ${file.name}!")
                Log.e(TAG, "Expected: $expectedHash")
                Log.e(TAG, "Actual:   $actualHash")
            } else {
                Log.d(TAG, "SHA-256 Checksum VERIFIED for ${file.name} ($actualHash)")
            }
            matches
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating SHA-256 for ${file.absolutePath}: ${e.message}", e)
            false
        }
    }
}
