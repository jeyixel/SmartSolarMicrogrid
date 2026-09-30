package com.example.smartsolarmicrogrid.data.remote.dto

/**
 /// DTO containing dynamic QR code generation payload and reservation verification details.
 */
data class QrCodeDetailsDto(
    val reservationId: String,
    val reservationCode: String? = null,
    val qrCodeToken: String,
    val stationId: String,
    val stationName: String? = null,
    val prosumerNIC: String,
    val prosumerName: String? = null,
    val slotStartTime: String,
    val slotEndTime: String,
    val requestedKWh: Double,
    val actionType: String,
    val status: String,
    val generatedAtUtc: String
)
