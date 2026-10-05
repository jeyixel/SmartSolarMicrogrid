/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * RecyclerView Adapter for presenting open energy booking slots in SlotPickerActivity.
 */
package com.example.smartsolarmicrogrid.ui.booking

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.remote.dto.SlotDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Adapter managing the list of available physical booking slots for selection.
 *
 * @param items List of open SlotDto objects.
 * @param onSlotSelected Callback invoked when a user taps a slot.
 */
class SlotPickerAdapter(
    private var items: List<SlotDto> = emptyList(),
    private val onSlotSelected: (SlotDto) -> Unit
) : RecyclerView.Adapter<SlotPickerAdapter.SlotViewHolder>() {

    /**
     * Replaces the data items and notifies the view of updates.
     */
    fun updateItems(newItems: List<SlotDto>) {
        this.items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SlotViewHolder {
        // Inflate slot picker item card
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_slot_picker, parent, false)
        return SlotViewHolder(view)
    }

    override fun onBindViewHolder(holder: SlotViewHolder, position: Int) {
        // Bind item data to view holder
        holder.bind(items[position], onSlotSelected)
    }

    override fun getItemCount(): Int = items.size

    class SlotViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvSlotCode: TextView = itemView.findViewById(R.id.tvSlotCode)
        private val tvSlotTradeType: TextView = itemView.findViewById(R.id.tvSlotTradeType)
        private val tvSlotTimeWindow: TextView = itemView.findViewById(R.id.tvSlotTimeWindow)
        private val tvSlotAvailability: TextView = itemView.findViewById(R.id.tvSlotAvailability)

        /**
         * Binds SlotDto telemetry and attaches selection click handler.
         */
        fun bind(item: SlotDto, onSlotSelected: (SlotDto) -> Unit) {
            tvSlotCode.text = if (item.slotCode.isNotBlank()) item.slotCode else "SLOT-${item.id.takeLast(6).uppercase()}"
            tvSlotTradeType.text = item.tradeType.uppercase(Locale.getDefault())

            // Format trade type badge styling
            if (item.tradeType.equals("Drop-off", ignoreCase = true) || item.tradeType.equals("Discharging", ignoreCase = true)) {
                tvSlotTradeType.setBackgroundResource(R.drawable.bg_pill_review)
                tvSlotTradeType.setTextColor(ContextCompat.getColor(itemView.context, R.color.solar_amber))
            } else {
                tvSlotTradeType.setBackgroundResource(R.drawable.bg_pill_active)
                tvSlotTradeType.setTextColor(ContextCompat.getColor(itemView.context, R.color.solar_green_primary))
            }

            // Format slot start and end time window
            tvSlotTimeWindow.text = formatSlotTime(item.startTime, item.endTime)

            // Availability display
            val freeBays = item.availableBatterySlots.coerceAtLeast(0)
            val totalBays = item.totalBatterySlots
            tvSlotAvailability.text = "$freeBays / $totalBays bays free"

            itemView.setOnClickListener {
                onSlotSelected(item)
            }
        }

        /**
         * Formats UTC ISO 8601 start and end timestamps into human-readable date & time range.
         */
        private fun formatSlotTime(startIso: String, endIso: String): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val dateFmt = SimpleDateFormat("dd MMM", Locale.US)
                val timeFmt = SimpleDateFormat("HH:mm", Locale.US)

                val startDate = inputFormat.parse(startIso.substringBefore('.'))
                val endDate = inputFormat.parse(endIso.substringBefore('.'))

                if (startDate != null && endDate != null) {
                    "${dateFmt.format(startDate)} • ${timeFmt.format(startDate)} - ${timeFmt.format(endDate)}"
                } else {
                    startIso
                }
            } catch (e: Exception) {
                if (startIso.isNotBlank()) startIso else "Scheduled Window"
            }
        }
    }
}
