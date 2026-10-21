// Example data for the widget gallery and previews (relative to now, so it always looks current).

import Foundation

extension Feed {
    static var sample: Feed {
        let now = Date()
        let m: (Double) -> Date = { now.addingTimeInterval($0 * 60) }
        return Feed(
            v: 1,
            generatedAt: now,
            tz: TimeZone.current.identifier,
            weather: Weather(temp: 14, feels: 12, code: 2, isDay: true, icon: "⛅", label: "Partly cloudy", hi: 19, lo: 9,
                             rainAt: m(300), rainPop: 60, tip: "☂️ Umbrella — 60% chance of rain"),
            recovery: Recovery(score: 82, band: "green"),
            events: [
                Event(id: "a", title: "FIT1008 Applied", start: m(75), end: m(195), leaveAt: m(15), place: "Clayton", kind: "class"),
                Event(id: "b", title: "Shift", start: m(24 * 60), end: m(30 * 60), leaveAt: m(23.5 * 60), place: "Play centre", kind: "shift"),
            ],
            due: [Due(title: "Assignment 3", due: m(3 * 24 * 60), course: "FIT1049", weight: 18)],
            study: Study(title: "Assignment 3", start: m(240), end: m(360)),
            alert: nil,
            lines: []
        )
    }
}
