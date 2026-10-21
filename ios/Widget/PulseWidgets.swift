// Lock screen (and home screen) widgets. One fetch every ~30 min; between fetches the timeline has an entry
// at every moment the glance changes, and countdowns are live Text timers — no refresh needed for them.

import SwiftUI
import WidgetKit

@main
struct PulseWidgetBundle: WidgetBundle {
    var body: some Widget {
        PulseGlanceWidget()
        LeaveLiveActivity()
    }
}

struct PulseEntry: TimelineEntry {
    let date: Date
    let feed: Feed?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PulseEntry {
        PulseEntry(date: .now, feed: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (PulseEntry) -> Void) {
        if context.isPreview {
            completion(PulseEntry(date: .now, feed: PulseClient.cached() ?? .sample))
            return
        }
        Task { completion(PulseEntry(date: .now, feed: await PulseClient.latest() ?? .sample)) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PulseEntry>) -> Void) {
        Task {
            let now = Date()
            let feed = await PulseClient.latest()
            let points = feed.map { GlanceBuilder.changePoints($0, from: now) } ?? []
            let entries = ([now] + points).map { PulseEntry(date: $0, feed: feed) }
            // iOS decides the real refresh time; this is the earliest we ask for.
            let refresh = now.addingTimeInterval(feed == nil ? 15 * 60 : 30 * 60)
            completion(Timeline(entries: entries, policy: .after(refresh)))
        }
    }
}

struct PulseGlanceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PulseGlance", provider: Provider()) { entry in
            GlanceView(entry: entry)
        }
        .configurationDisplayName("Pulse")
        .description("What's next, when to leave, weather and your next deadline.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline, .accessoryCircular, .systemSmall, .systemMedium])
    }
}

struct GlanceView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PulseEntry

    var body: some View {
        content
            .containerBackground(for: .widget) { background }
            .widgetURL(URL(string: "pulse://open"))
    }

    @ViewBuilder private var background: some View {
        switch family {
        case .systemSmall, .systemMedium:
            LinearGradient(colors: [Color(red: 0.07, green: 0.08, blue: 0.11), Color(red: 0.12, green: 0.13, blue: 0.18)],
                           startPoint: .top, endPoint: .bottom)
        default:
            Color.clear
        }
    }

    @ViewBuilder private var content: some View {
        if let feed = entry.feed {
            let g = GlanceBuilder.glance(feed, at: entry.date)
            switch family {
            case .accessoryInline:
                Label(g.inline, systemImage: g.inlineSymbol)
            case .accessoryCircular:
                CircularView(glance: g, feed: feed, date: entry.date)
            case .systemSmall:
                HomeView(rows: Array(g.rows.prefix(4)), date: entry.date, compact: true)
            case .systemMedium:
                HomeView(rows: Array(g.rows.prefix(4)), date: entry.date, compact: false)
            default:
                RectView(rows: Array(g.rows.prefix(3)), date: entry.date)
            }
        } else {
            Label(PulseConfig.isConfigured ? "Can't reach Pulse" : "Open Pulse to set up", systemImage: "waveform.path.ecg")
                .font(.caption)
        }
    }
}

struct RowView: View {
    let row: GlanceRow
    let date: Date
    var size: CGFloat = 13

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: row.symbol)
                .font(.system(size: size - 2, weight: .semibold))
                .frame(width: size + 1)
            label
                .font(.system(size: size, weight: row.bold ? .semibold : .regular))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }

    private var label: Text {
        if let c = row.countdownTo, c > date {
            return Text(row.text + " ") + Text(timerInterval: date...c, countsDown: true, showsHours: false).monospacedDigit()
        }
        return Text(row.text)
    }
}

/// Lock screen rectangle: three lines.
struct RectView: View {
    let rows: [GlanceRow]
    let date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                RowView(row: r, date: date)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Lock screen circle: leave countdown when it matters, otherwise recovery, otherwise temperature.
struct CircularView: View {
    let glance: Glance
    let feed: Feed
    let date: Date

    var body: some View {
        if let l = glance.leave, date < l.at {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "car.fill").font(.system(size: 12, weight: .semibold))
                    Text(timerInterval: date...l.at, countsDown: true, showsHours: false)
                        .font(.system(size: 13, weight: .semibold))
                        .monospacedDigit()
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 46)
                }
            }
        } else if let r = feed.recovery {
            Gauge(value: Double(r.score), in: 0...100) {
                Image(systemName: "heart.fill")
            } currentValueLabel: {
                Text("\(r.score)")
            }
            .gaugeStyle(.accessoryCircular)
        } else if let w = feed.weather {
            let lo = Double(min(w.lo, w.temp))
            let hi = Double(max(w.hi, w.temp, min(w.lo, w.temp) + 1))
            Gauge(value: Double(w.temp), in: lo...hi) {
                Image(systemName: GlanceBuilder.weatherSymbol(w))
            } currentValueLabel: {
                Text("\(w.temp)°")
            } minimumValueLabel: {
                Text("\(w.lo)")
            } maximumValueLabel: {
                Text("\(w.hi)")
            }
            .gaugeStyle(.accessoryCircular)
        } else {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "waveform.path.ecg")
            }
        }
    }
}

/// Home screen / StandBy.
struct HomeView: View {
    let rows: [GlanceRow]
    let date: Date
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 5 : 6) {
            Text("PULSE")
                .font(.system(size: 10, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(.white.opacity(0.5))
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                RowView(row: r, date: date, size: compact ? 12 : 14)
                    .foregroundStyle(r.bold ? Color.white : Color.white.opacity(0.8))
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

#Preview(as: .accessoryRectangular) {
    PulseGlanceWidget()
} timeline: {
    PulseEntry(date: .now, feed: .sample)
    PulseEntry(date: .now.addingTimeInterval(20 * 60), feed: .sample)
}
