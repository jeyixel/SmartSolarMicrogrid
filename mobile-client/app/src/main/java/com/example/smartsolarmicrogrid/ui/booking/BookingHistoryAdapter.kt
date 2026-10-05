package com.example.smartsolarmicrogrid.ui.booking

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class BookingHistoryAdapter(
    private var items: List<ReservationHistoryDto> = emptyList(),
    private val onItemClick: ((ReservationHistoryDto) -> Unit)? = null
) : RecyclerView.Adapter<BookingHistoryAdapter.HistoryViewHolder>() {

    fun updateItems(newItems: List<ReservationHistoryDto>) {
        this.items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_booking_history, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        holder.bind(items[position], onItemClick)
    }

    override fun getItemCount(): Int = items.size

    class HistoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvStationId: TextView = itemView.findViewById(R.id.tvStationId)
        private val tvStatusBadge: TextView = itemView.findViewById(R.id.tvStatusBadge)
        private val tvSlotDateTime: TextView = itemView.findViewById(R.id.tvSlotDateTime)
        private val tvEnergyAmount: TextView = itemView.findViewById(R.id.tvEnergyAmount)
        private val tvActionType: TextView = itemView.findViewById(R.id.tvActionType)
        private val tvRefId: TextView = itemView.findViewById(R.id.tvRefId)

        fun bind(item: ReservationHistoryDto, onItemClick: ((ReservationHistoryDto) -> Unit)?) {
            val displayName = if (item.stationName.isNotBlank() && item.stationName != "N/A") item.stationName else item.stationId
            tvStationId.text = displayName
            tvEnergyAmount.text = String.format(Locale.getDefault(), "%.1f kWh", item.energyAmountKWh)
            tvActionType.text = item.actionType

            // Format Reference ID
            val shortId = if (item.id.length >= 8) item.id.takeLast(8).uppercase() else item.id
            tvRefId.text = "Ref: #$shortId"

            // Format Date & Time
            tvSlotDateTime.text = formatDateTime(item.startTime, item.endTime)

            // Status Badge Formatting
            when (item.status.lowercase(Locale.getDefault())) {
                "approved", "completed" -> {
                    tvStatusBadge.text = "● ${item.status.uppercase()}"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_active)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.color_on_primary_container))
                }
                "cancelled" -> {
                    tvStatusBadge.text = "● ${item.status.uppercase()}"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_neutral)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.text_secondary))
                }
                "pending" -> {
                    tvStatusBadge.text = "● PENDING"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_review)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.color_on_warning_container))
                }
                else -> {
                    tvStatusBadge.text = "● ${item.status.uppercase()}"
                    tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_neutral)
                    tvStatusBadge.setTextColor(ContextCompat.getColor(itemView.context, R.color.text_primary))
                }
            }

            itemView.setOnClickListener {
                onItemClick?.invoke(item)
            }
        }

        private fun formatDateTime(startIso: String, endIso: String): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val outputDateFormat = SimpleDateFormat("dd MMM • HH:mm", Locale.getDefault())
                val startDate = inputFormat.parse(startIso.substringBefore('.'))
                if (startDate != null) outputDateFormat.format(startDate) else startIso
            } catch (e: Exception) {
                startIso
            }
        }
    }
}
