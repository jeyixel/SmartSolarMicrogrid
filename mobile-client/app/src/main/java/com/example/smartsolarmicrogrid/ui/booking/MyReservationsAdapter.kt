/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * RecyclerView Adapter for managing and modifying prosumer energy reservations.
 * Enforces client-side UI affordances for the 12-hour modification and cancellation rule.
 */
package com.example.smartsolarmicrogrid.ui.booking

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import com.google.android.material.button.MaterialButton
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Adapter presenting the prosumer's bookings with Modify, Cancel, and View QR action buttons.
 *
 * @param items List of reservation history items.
 * @param onModifyClick Action callback when user selects Modify.
 * @param onCancelClick Action callback when user selects Cancel.
 * @param onViewQrClick Action callback when user selects View QR.
 */
class MyReservationsAdapter(
    private var items: List<ReservationHistoryDto> = emptyList(),
    private val onModifyClick: (ReservationHistoryDto) -> Unit,
    private val onCancelClick: (ReservationHistoryDto) -> Unit,
    private val onViewQrClick: (ReservationHistoryDto) -> Unit
) : RecyclerView.Adapter<MyReservationsAdapter.ReservationViewHolder>() {

    /**
     * Updates the dataset and triggers a list re-render.
     */
    fun updateItems(newItems: List<ReservationHistoryDto>) {
        this.items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ReservationViewHolder {
        // Inflate reservation card layout
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_my_reservation, parent, false)
        return ReservationViewHolder(view)
    }

    override fun onBindViewHolder(holder: ReservationViewHolder, position: Int) {
        // Bind item at given position
        holder.bind(items[position], onModifyClick, onCancelClick, onViewQrClick)
    }

    override fun getItemCount(): Int = items.size

    class ReservationViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvStationId: TextView = itemView.findViewById(R.id.tvStationId)
        private val tvStatusBadge: TextView = itemView.findViewById(R.id.tvStatusBadge)
        private val tvSlotDateTime: TextView = itemView.findViewById(R.id.tvSlotDateTime)
        private val tvEnergyAmount: TextView = itemView.findViewById(R.id.tvEnergyAmount)
        private val tvActionType: TextView = itemView.findViewById(R.id.tvActionType)
        private val tvRefId: TextView = itemView.findViewById(R.id.tvRefId)
        private val tvRule12HrNotice: TextView = itemView.findViewById(R.id.tvRule12HrNotice)
        private val layoutActionButtons: View = itemView.findViewById(R.id.layoutActionButtons)
        private val btnModify: MaterialButton = itemView.findViewById(R.id.btnModify)
        private val btnCancel: MaterialButton = itemView.findViewById(R.id.btnCancel)
        private val btnViewQr: MaterialButton = itemView.findViewById(R.id.btnViewQr)

        /**
         * Binds reservation record and evaluates the 12-hour rule for action button states.
         */
        fun bind(
            item: ReservationHistoryDto,
            onModifyClick: (ReservationHistoryDto) -> Unit,
            onCancelClick: (ReservationHistoryDto) -> Unit,
            onViewQrClick: (ReservationHistoryDto) -> Unit
        ) {
            val displayName = if (item.stationName.isNotBlank() && item.stationName != "N/A") item.stationName else item.stationId
            tvStationId.text = displayName
            tvEnergyAmount.text = String.format(Locale.US, "%.1f kWh", item.energyAmountKWh)
            tvActionType.text = item.actionType
            tvSlotDateTime.text = formatDateTime(item.startTime, item.endTime)

            val shortId = if (item.id.length >= 8) item.id.takeLast(8).uppercase(Locale.US) else item.id
            tvRefId.text = "Ref: #$shortId"

            val statusLower = item.status.lowercase(Locale.US)

            // Format status badge pill
            when (statusLower) {
                "approved", "confirmed" -> {
                    tvStatusBadge.text = "● ${item.status.uppercase(Locale.US)}"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_active)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.solar_green_primary))
                }
                "completed" -> {
                    tvStatusBadge.text = "● COMPLETED"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_active)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.solar_green_primary))
                }
                "cancelled" -> {
                    tvStatusBadge.text = "● CANCELLED"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_dark)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.text_secondary))
                }
                "rejected" -> {
                    tvStatusBadge.text = "● REJECTED"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_dark)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.error_red))
                }
                "pending" -> {
                    tvStatusBadge.text = "● PENDING"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_review)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.solar_amber))
                }
                else -> {
                    tvStatusBadge.text = "● ${item.status.uppercase(Locale.US)}"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_dark)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.text_primary))
                }
            }

            // Evaluate 12-Hour Rule
            val nowMs = System.currentTimeMillis()
            val startMs = parseUtcTimestamp(item.startTime)
            val hoursUntilStart = (startMs - nowMs) / (1000.0 * 60.0 * 60.0)

            val isCancelled = statusLower == "cancelled" || statusLower == "rejected"
            val isCompleted = statusLower == "completed"
            val isPending = statusLower == "pending"
            val isLockedBy12HourRule = hoursUntilStart < 12.0

            if (isCancelled) {
                // Cancelled/Rejected bookings cannot be modified, cancelled again, or scanned via QR
                btnModify.visibility = View.GONE
                btnCancel.visibility = View.GONE
                btnViewQr.visibility = View.GONE
                tvRule12HrNotice.visibility = View.VISIBLE
                tvRule12HrNotice.text = if (statusLower == "rejected") "Rejected by Operator" else "Cancelled"
                tvRule12HrNotice.setTextColor(ContextCompat.getColor(itemView.context, R.color.text_secondary))
            } else if (isCompleted) {
                // Completed bookings show historical QR but no modification
                btnModify.visibility = View.GONE
                btnCancel.visibility = View.GONE
                btnViewQr.visibility = View.VISIBLE
                btnViewQr.isEnabled = true
                tvRule12HrNotice.visibility = View.GONE
            } else {
                // Active or Pending bookings
                btnModify.visibility = View.VISIBLE
                btnCancel.visibility = View.VISIBLE

                // QR pass is strictly accessible only once approved
                if (isPending) {
                    btnViewQr.visibility = View.GONE
                } else {
                    btnViewQr.visibility = View.VISIBLE
                    btnViewQr.isEnabled = true
                }

                if (isLockedBy12HourRule) {
                    // Under 12 hours: buttons disabled with visual notice
                    btnModify.isEnabled = false
                    btnCancel.isEnabled = false
                    tvRule12HrNotice.visibility = View.VISIBLE
                    tvRule12HrNotice.text = "🔒 Locked (< 12h notice)"
                    tvRule12HrNotice.setTextColor(ContextCompat.getColor(itemView.context, R.color.error_red))
                } else {
                    // Eligible for modification and cancellation
                    btnModify.isEnabled = true
                    btnCancel.isEnabled = true
                    tvRule12HrNotice.visibility = View.GONE
                }
            }

            // Click listeners
            btnModify.setOnClickListener {
                onModifyClick(item)
            }
            btnCancel.setOnClickListener {
                onCancelClick(item)
            }
            btnViewQr.setOnClickListener {
                onViewQrClick(item)
            }
        }

        private fun parseUtcTimestamp(isoString: String): Long {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                inputFormat.parse(isoString.substringBefore('.'))?.time ?: 0L
            } catch (e: Exception) {
                0L
            }
        }

        private fun formatDateTime(startIso: String, endIso: String): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val dateFmt = SimpleDateFormat("dd MMM", Locale.US)
                val timeFmt = SimpleDateFormat("HH:mm", Locale.US)

                val start = inputFormat.parse(startIso.substringBefore('.'))
                val end = inputFormat.parse(endIso.substringBefore('.'))

                if (start != null && end != null) {
                    "${dateFmt.format(start)} • ${timeFmt.format(start)} - ${timeFmt.format(end)}"
                } else {
                    startIso
                }
            } catch (e: Exception) {
                startIso
            }
        }
    }
}
