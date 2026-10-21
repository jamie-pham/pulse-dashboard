// Starts, updates and ends the "leave by" Live Activity.
//
// Free Apple ID: iOS only lets an app *start* a Live Activity while it's open, so this runs whenever Pulse
// opens (tap a widget, or have your alarm Shortcut open pulse://open). With the paid developer program the
// server can start it by push instead (ActivityKit push-to-start, iOS 17.2+) — no opening needed.

import ActivityKit
import Foundation

@MainActor
enum LeaveActivityManager {
    /// Start the countdown up to 2 hours ahead of "leave by".
    static let startWindow: TimeInterval = 2 * 3600

    static func sync(with feed: Feed, now: Date = .now) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        // End anything whose event has started — you've either left or you're not going.
        for a in Activity<LeaveAttributes>.activities where a.content.state.start <= now {
            await a.end(nil, dismissalPolicy: .immediate)
        }

        guard let leave = GlanceBuilder.nextLeave(feed, at: now, window: startWindow) else { return }
        let state = LeaveAttributes.ContentState(leaveAt: leave.at, start: leave.event.start)
        let content = ActivityContent(state: state, staleDate: leave.event.start)

        if let existing = Activity<LeaveAttributes>.activities.first(where: { $0.attributes.eventId == leave.event.id }) {
            await existing.update(content) // times may have moved (travel estimate, rescheduled event)
            return
        }

        // One countdown at a time.
        for a in Activity<LeaveAttributes>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
        let attrs = LeaveAttributes(
            eventId: leave.event.id,
            title: leave.event.title,
            place: leave.event.place,
            startText: GlanceBuilder.time(leave.event.start, feed.timeZone)
        )
        _ = try? Activity<LeaveAttributes>.request(attributes: attrs, content: content, pushType: nil)
    }
}
