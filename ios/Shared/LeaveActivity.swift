// Live Activity for "leave by" — a countdown on the lock screen and in the Dynamic Island.
// Attributes are shared: the app starts/updates/ends it, the widget extension draws it.

import ActivityKit
import Foundation

struct LeaveAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var leaveAt: Date
        var start: Date
    }

    var eventId: String
    var title: String
    var place: String?
    var startText: String
}
