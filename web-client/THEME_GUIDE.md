# GridPulse Enterprise Light — AI Theme & UI Guide

> **Instructions for AI Code Generators:**  
> When generating or modifying UI components, pages, or layouts for this project, you **MUST** strictly adhere to the tokens, utility classes, typography, and component patterns defined in this guide.  
> Do not introduce arbitrary colors, rounded corners, or drop shadows that deviate from this specification.

---

## 1. Design Philosophy
- **Aesthetic:** Corporate / Modern High-Density Utility Operations Console.
- **Visual Quietness:** Crisp, low-contrast mechanical boundaries; zero visual clutter; stark whites and cooling slates.
- **Elevation:** Flat structure using 1px borders (`border-slate-200` / `#e2e8f0`). Avoid dark or blurry drop shadows (`shadow-md`, `shadow-lg` are forbidden unless for modal popovers).
- **Density:** High-density 4px/8px coordinate rhythm designed for mission-critical monitoring (telemetry grids, inverter statuses, battery metrics).

---

## 2. Color Tokens & Semantic Mappings

Always favor shadcn semantic classes or the defined Tailwind slate scale over arbitrary hex codes.

### Canvas & Base Surfaces
| Semantic Token | Tailwind Class | Underlying Value | Intended Usage |
|---|---|---|---|
| `--background` | `bg-background` | `#f8fafc` (Slate 50) | Host application canvas / root screen background |
| `--card` | `bg-card` or `bg-white` | `#ffffff` | Cards, panels, modal dialogs, data tables |
| `--muted` / `--accent` | `bg-muted` or `bg-slate-100` | `#f1f5f9` (Slate 100) | Sub-panels, toolbar headers, table header rows, hover states |
| `--border` | `border-border` / `border-slate-200` | `#e2e8f0` (Slate 200) | Structural card borders, dividers, standard container outlines |
| `--input` | `border-input` / `border-slate-300` | `#cbd5e1` (Slate 300) | Form input outlines, unselected radios/checkboxes |

### Text & Contrast Hierarchy
| Element | Tailwind Class | Underlying Value | When to Use |
|---|---|---|---|
| **Primary Text** | `text-foreground` or `text-slate-900` | `#0f172a` (Slate 900) | Global page titles, primary headers, live numerical telemetry readouts |
| **Body & Labels** | `text-slate-800` | `#1e293b` (Slate 800) | Standard body text, form field labels, table row content |
| **Secondary / Metadata** | `text-muted-foreground` or `text-slate-600` | `#475569` (Slate 600) | Engineering units (`kW`, `Hz`, `MWh`), subheaders, timestamps, captions |
| **Muted / Placeholder** | `text-slate-400` | `#94a3b8` (Slate 400) | Input placeholders, disabled text |

### Primary Brand & Functional Actions
| Token | Tailwind Class | Value | Usage |
|---|---|---|---|
| Primary Brand | `bg-primary text-primary-foreground` | `#4f46e5` (Electric Indigo) | Primary action buttons, active tab indicators, selected radio/checkbox fills |
| Primary Hover | `hover:bg-[#4338ca]` | `#4338ca` | Button hover state |
| Primary Ring | `ring-primary/50` | `rgba(79, 70, 229, 0.5)` | 2px focus ring with 2px offset |

### Operational Status Colors (Critical for Microgrid / Inverter UI)
Do **not** substitute with arbitrary greens, yellows, or reds. Use these exact triplets (Background, Text, Border):

| Status | Badge / Chip Tailwind Classes | Pulse Node Fill | Context |
|---|---|---|---|
| **Active / Online** | `bg-emerald-50 text-emerald-700 border-emerald-200` (`#ecfdf5`, `#059669`, `#a7f3d0`) | `bg-emerald-500` (`#10b981`) | Normal inverter generation, grid synced, flowing state |
| **Warning / Throttled** | `bg-amber-50 text-amber-700 border-amber-200` (`#fffbeb`, `#d97706`, `#fde68a`) | `bg-amber-500` (`#d97706`) | Thermal alarms, load shedding, frequency/voltage variance |
| **Alert / Tripped** | `bg-red-50 text-red-700 border-red-200` (`#fef2f2`, `#dc2626`, `#fecaca`) | `bg-red-500` (`#dc2626`) | Ground fault, emergency stop, hardware disconnect, trip event |

---

## 3. Typography Scale & Font Families

The system enforces three distinct font families:
1. **Hanken Grotesk** (`font-display`): Page headers, structural section titles, executive KPI summaries.
2. **Inter** (`font-sans` - default): Standard UI copy, labels, inputs, table body text.
3. **JetBrains Mono** (`font-mono`): **Mandatory** for telemetry readings, numbers, units, bus frequencies (Hz), device IDs, coordinates, and log timestamps.

### Custom Typography Utility Classes
These utilities are registered directly in Tailwind:

```html
<!-- Display & Headers (Hanken Grotesk) -->
<h1 class="text-display-lg">Dashboard Title (32px/700)</h1>
<h2 class="text-headline-lg">Section Header (24px/600)</h2>
<h3 class="text-headline-md">Panel Header (20px/600)</h3>
<h4 class="text-headline-sm">Widget Subhead (16px/600)</h4>

<!-- Body Copy (Inter) -->
<p class="text-body-lg">Prominent lead paragraph (15px/400)</p>
<p class="text-body-md">Standard body text (13px/400)</p>
<p class="text-body-sm">Fine print / auxiliary descriptions (12px/400)</p>
<label class="text-label-md">Field label (12px/500)</label>

<!-- Telemetry & Data Logs (JetBrains Mono) -->
<span class="text-telemetry-lg">482.4 kW</span>  <!-- 20px/600 - Main KPI Metric -->
<span class="text-telemetry-md">59.98 Hz</span>  <!-- 13px/500 - Grid Frequency / Matrix -->
<span class="text-label-sm uppercase">INV-04-A</span> <!-- 11px/500 - Hardware ID / Status Tag -->
```

---

## 4. Shapes & Border Radius

Strictly follow this radius distribution:
- `rounded` (`0.25rem` / 4px): **Standard UI controls** — buttons, text inputs, status chips, table rows.
- `rounded-lg` (`0.5rem` / 8px): **Containers** — metric cards, persistent panels, telemetry grids.
- `rounded-xl` (`0.75rem` / 12px): **Floating Overlays** — dialogs, modals, dropdown menus.
- `rounded-full` (9999px): **Exclusively reserved** for status indicator dots, avatars, and pill badges.

---

## 5. Ready-to-Use UI Patterns & Component Recipes

### A. Status Indicator Chips
```tsx
// Active / Generating
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-label-sm uppercase font-mono">
  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
  Online
</span>

// Warning / Throttled
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-label-sm uppercase font-mono">
  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
  Throttled
</span>

// Tripped / Emergency
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 text-label-sm uppercase font-mono">
  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
  Tripped
</span>
```

### B. Metric & Telemetry Card
```tsx
import { Card, CardContent } from "@/components/ui/card";

export function TelemetryCard({ label, value, unit, status = "online", trend }) {
  return (
    <Card className="rounded-lg border border-slate-200 bg-white shadow-none p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </span>
        {/* Status chip or indicator */}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className="text-telemetry-lg text-slate-900 font-mono font-semibold">
          {value}
        </span>
        <span className="text-xs font-mono text-slate-500">{unit}</span>
      </div>

      {trend && (
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
          {trend}
        </p>
      )}
    </Card>
  );
}
```

### C. Standard Buttons (`@/components/ui/button`)
```tsx
import { Button } from "@/components/ui/button";

// Primary Action (36px default height, Inter 13px weight 600, 4px radius)
<Button variant="default">Deploy Settings</Button>

// High-density Compact Button (32px height)
<Button variant="default" size="sm">Acknowledge</Button>

// Secondary / Outline Button (White surface, 1px #cbd5e1 border)
<Button variant="outline">Export CSV</Button>

// Emergency Disconnect / Critical Switch (Solid Red)
<Button variant="destructive">Emergency Trip</Button>
```

### D. High-Density Data Tables
```tsx
<div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
  <table className="w-full text-left border-collapse">
    <thead className="bg-slate-100 border-b border-slate-200">
      <tr className="h-7 text-[11px] uppercase font-mono text-slate-600">
        <th className="px-3 font-semibold">Inverter ID</th>
        <th className="px-3 font-semibold">Status</th>
        <th className="px-3 font-semibold text-right">AC Output</th>
        <th className="px-3 font-semibold text-right">Frequency</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100 text-[13px] text-slate-800">
      <tr className="h-9 hover:bg-slate-50 transition-colors">
        <td className="px-3 font-mono text-xs">INV-01</td>
        <td className="px-3">...</td>
        <td className="px-3 font-mono text-right">124.8 kW</td>
        <td className="px-3 font-mono text-right">60.02 Hz</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 6. AI Prompt Template (Quick Copy for Team)

When asking an AI model to generate a component or page for this project, attach this prompt:

```text
Follow the "GridPulse Enterprise Light" design system:
1. Base & Surfaces: Background is #f8fafc (bg-background), cards/panels are #ffffff (bg-white or bg-card) with a crisp 1px solid #e2e8f0 border (border-slate-200). Do NOT use heavy drop shadows.
2. Typography:
   - Page and section titles use Hanken Grotesk (text-display-lg, text-headline-lg, text-headline-md).
   - Body copy and controls use Inter (text-body-md, text-body-sm, text-label-md).
   - Telemetry readings, numerical values, device IDs, and timestamps MUST use JetBrains Mono (font-mono, text-telemetry-lg, text-telemetry-md, text-label-sm).
3. Buttons: Use @/components/ui/button. Default height is 36px (h-9), compact is 32px (h-8), border radius is 4px (rounded). Primary is #4f46e5. Secondary is white with #cbd5e1 border.
4. Inputs: Use @/components/ui/input. 1px solid #cbd5e1 border, white background, focus border #4f46e5 with subtle 1px outline box-shadow.
5. Status Indicators: Active is bg-emerald-50 text-emerald-700 border-emerald-200; Warning is bg-amber-50 text-amber-700 border-amber-200; Alert is bg-red-50 text-red-700 border-red-200.
```
