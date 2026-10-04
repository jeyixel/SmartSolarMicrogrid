package com.example.smartsolarmicrogrid.util

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * Utility for rendering scannable, high-contrast QR Code bitmaps using ZXing Core.
 */
object QrBitmapGenerator {

    /**
     * Generates a square QR Code Bitmap from the provided token content.
     *
     * @param content The string payload (e.g. "SSM:RES:674A82F1:9B2F3A10")
     * @param size The desired width & height in pixels (e.g., 512)
     * @return Generated Bitmap ready for display in an ImageView
     */
    fun generateQrBitmap(
        content: String,
        size: Int = 512,
        foregroundColor: Int = Color.parseColor("#0F172A"),
        backgroundColor: Int = Color.WHITE
    ): Bitmap? {
        if (content.isBlank()) return null

        return try {
            val hints = mapOf(
                EncodeHintType.CHARACTER_SET to "UTF-8",
                EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.H,
                EncodeHintType.MARGIN to 2
            )

            val writer = QRCodeWriter()
            val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val pixels = IntArray(width * height)

            for (y in 0 until height) {
                val offset = y * width
                for (x in 0 until width) {
                    pixels[offset + x] = if (bitMatrix.get(x, y)) foregroundColor else backgroundColor
                }
            }

            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
            bitmap
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
