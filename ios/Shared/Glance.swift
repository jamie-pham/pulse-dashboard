// What the lock screen should say at a given moment. Pure — the widget asks for a Glance at each
// timeline entry, so "next event" flips over and "leave in…" appears on time without re-fetching.
//
// Priority (PRINCIPLES.md: glance first, one next step):
//   emergency → leave countdown / what's on now → next thing → weather → study window → next deadline

import Foundation

struct GlanceRow: Hashable {
    let symbol: String
    let text: String
    /// When set, the row shows `text` followed by a live countdown to this moment.
    var countdownTo: Date? = nil
    var bold = false
}

struct LeaveInfo {
    let event: Feed.Event
    let at: Date
}

struct Glance {
    let rows: [GlanceRow]
    let leave: LeaveInfo?
    let inline: String
    let inlineSymbol: String
}

enum GlanceBuilder {
    /// How long before "leave by" the countdown takes over the lock screen.
    static let leaveWindow: TimeInterval = 90 * 60

    static func glance(_ f: Feed, at now: Date) -> Glance {
        let tz = f.timeZone
        var rows: [GlanceRow] = []

        if let a = f.alert {
            rows.append(GlanceRow(symbol: "exclamationmark.triangle.fill", text: a.title, bold: true))
        }

        let live = f.events.first { $0.start <= now && $0.end > now }
        let next = f.events.first { $0.start > now }
        let leave = nextLeave(f, at: now)

        if let l = leave {
            if now < l.at {
                rows.append(GlanceRow(symbol: "car.fill", text: "Leave in", countdownTo: l.at, bold: true))
            } else {
                rows.append(GlanceRow(symbol: "car.fill", text: "Time to leave", bold: true))
            }
            rows.append(GlanceRow(symbol: symbol(for: l.event), text: "\(time(l.event.start, tz)) \(l.event.title)"))
        } else if let e = live {
            rows.append(GlanceRow(symbol: symbol(for: e), text: "\(e.title) → \(time(e.end, tz))", bold: true))
            if let n = next, sameDay(n.start, now, tz) {
                rows.append(GlanceRow(symbol: symbol(for: n), text: "\(time(n.start, tz)) \(n.title)"))
            }
        } else if let n = next {
            let leaveText = n.leaveAt.map { " · leave \(time($0, tz))" } ?? ""
            rows.append(GlanceRow(symbol: symbol(for: n), text: "\(dayPrefix(n.start, now, tz))\(time(n.start, tz)) \(n.title)\(leaveText)", bold: true))
        }

        if let w = f.weather {
            var text = "\(w.temp)° \(w.label) · \(w.hi)°"
            if let r = w.rainAt, r > now.addingTimeInterval(-3600), sameDay(r, now, tz) {
                text = r <= now ? "\(w.temp)° · raining now" : "\(w.temp)° · rain \(time(r, tz))"
            }
            rows.append(GlanceRow(symbol: weatherSymbol(w), text: text))
        }

        if let s = f.study, s.end > now, s.start.timeIntervalSince(now) < 4 * 3600 {
            let text = s.start <= now ? "Study now: \(s.title)" : "Study \(s.title) \(time(s.start, tz))"
            rows.append(GlanceRow(symbol: "book.fill", text: text))
        }

        if let d = f.due.first(where: { $0.due > now }) {
            let weight = d.weight.map { " (\(formatWeight($0)))" } ?? ""
            rows.append(GlanceRow(symbol: "checklist", text: "\(d.title)\(weight) · \(relDue(d.due, now, tz))"))
        }

        // One line for the inline slot above the clock.
        let inline: String
        let inlineSymbol: String
        if let l = leave {
            inline = now < l.at ? "Leave \(time(l.at, tz)) · \(l.event.title)" : "Leave now · \(l.event.title)"
            inlineSymbol = "car.fill"
        } else if let w = f.weather {
            let nextText = next.map { " · \(time($0.start, tz)) \($0.title)" } ?? ""
            inline = "\(w.temp)°\(nextText)"
            inlineSymbol = weatherSymbol(w)
        } else if let n = next {
            inline = "\(time(n.start, tz)) \(n.title)"
            inlineSymbol = symbol(for: n)
        } else {
            inline = "Nothing on"
            inlineSymbol = "checkmark"
        }

        return Glance(rows: rows, leave: leave, inline: inline, inlineSymbol: inlineSymbol)
    }

    /// The next event you have to travel to, once you're within `window` of its leave-by time.
    static func nextLeave(_ f: Feed, at now: Date, window: TimeInterval = leaveWindow) -> LeaveInfo? {
        for e in f.events {
            guard let at = e.leaveAt, e.start > now else { continue }
            if now >= at.addingTimeInterval(-window) { return LeaveInfo(event: e, at: at) }
            return nil // the first event you travel to isn't close yet — don't jump ahead to a later one
        }
        return nil
    }

    /// Moments the glance changes — the widget gets a timeline entry at each, so it's right without a refetch.
    static func changePoints(_ f: Feed, from now: Date, hours: Double = 12) -> [Date] {
        var d: [Date] = []
        for e in f.events {
            d += [e.start, e.end]
            if let l = e.leaveAt { d += [l.addingTimeInterval(-leaveWindow), l] }
        }
        if let s = f.study { d += [s.start.addingTimeInterval(-4 * 3600), s.start, s.end] }
        d += f.due.map(\.due)
        if let r = f.weather?.rainAt { d.append(r.addingTimeInterval(3600)) }
        let end = now.addingTimeInterval(hours * 3600)
        return Array(Set(d.filter { $0 > now && $0 < end })).sorted().prefix(40).map { $0 }
    }

    // MARK: - Formatting

    static func time(_ d: Date, _ tz: TimeZone) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_AU")
        f.timeZone = tz
        f.dateFormat = calendar(tz).component(.minute, from: d) == 0 ? "ha" : "h:mma"
        return f.string(from: d).lowercased().replacingOccurrences(of: ".", with: "")
    }

    static func calendar(_ tz: TimeZone) -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = tz
        return c
    }

    static func sameDay(_ a: Date, _ b: Date, _ tz: TimeZone) -> Bool {
        calendar(tz).isDate(a, inSameDayAs: b)
    }

    static func dayPrefix(_ d: Date, _ now: Date, _ tz: TimeZone) -> String {
        if sameDay(d, now, tz) { return "" }
        if let tomorrow = calendar(tz).date(byAdding: .day, value: 1, to: now), sameDay(d, tomorrow, tz) { return "Tmrw " }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_AU")
        f.timeZone = tz
        f.dateFormat = "EEE "
        return f.string(from: d)
    }

    static func relDue(_ d: Date, _ now: Date, _ tz: TimeZone) -> String {
        if sameDay(d, now, tz) { return "today \(time(d, tz))" }
        let p = dayPrefix(d, now, tz).trimmingCharacters(in: .whitespaces)
        return p == "Tmrw" ? "tmrw" : p
    }

    static func formatWeight(_ w: Double) -> String {
        w == w.rounded() ? "\(Int(w))%" : String(format: "%.1f%%", w)
    }

    static func symbol(for e: Feed.Event) -> String {
        switch e.kind {
        case "class": return "graduationcap.fill"
        case "shift": return "briefcase.fill"
        default: return "calendar"
        }
    }

    /// WMO weather code → SF Symbol (lock screen widgets render symbols cleanly; emoji don't tint).
    static func weatherSymbol(_ w: Feed.Weather) -> String {
        switch w.code {
        case 0, 1: return w.isDay ? "sun.max.fill" : "moon.stars.fill"
        case 2: return w.isDay ? "cloud.sun.fill" : "cloud.moon.fill"
        case 3: return "cloud.fill"
        case 45, 48: return "cloud.fog.fill"
        case 51...57: return "cloud.drizzle.fill"
        case 61...67, 80...82: return "cloud.rain.fill"
        case 71...77, 85, 86: return "cloud.snow.fill"
        case 95...99: return "cloud.bolt.rain.fill"
        default: return "thermometer.medium"
        }
    }
}
