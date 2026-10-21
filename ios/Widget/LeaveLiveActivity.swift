// How the "leave by" Live Activity looks on the lock screen and in the Dynamic Island.

import ActivityKit
import SwiftUI
import WidgetKit

struct LeaveLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LeaveAttributes.self) { ctx in
            LeaveBanner(attributes: ctx.attributes, state: ctx.state, stale: ctx.isStale)
                .padding(16)
                .activityBackgroundTint(Color.black.opacity(0.55))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Leave", systemImage: "car.fill").font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(to: ctx.state.leaveAt).font(.title2.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(subtitle(ctx.attributes)).font(.subheadline).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "car.fill")
            } compactTrailing: {
                Countdown(to: ctx.state.leaveAt).frame(maxWidth: 48)
            } minimal: {
                Image(systemName: "car.fill")
            }
            .widgetURL(URL(string: "pulse://open"))
        }
    }
}

private func subtitle(_ a: LeaveAttributes) -> String {
    [a.startText + " " + a.title, a.place].compactMap { $0 }.joined(separator: " · ")
}

/// Counts down to `to`; the bounded interval means it stops at 0:00 instead of counting back up.
struct Countdown: View {
    let to: Date
    var body: some View {
        Text(timerInterval: to.addingTimeInterval(-6 * 3600)...to, countsDown: true, showsHours: false)
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
    }
}

struct LeaveBanner: View {
    let attributes: LeaveAttributes
    let state: LeaveAttributes.ContentState
    let stale: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Label(stale ? "Should have left" : "Leave in", systemImage: "car.fill")
                    .font(.headline)
                Spacer()
                Countdown(to: state.leaveAt)
                    .font(.system(size: 30, weight: .bold))
            }
            ProgressView(timerInterval: state.leaveAt.addingTimeInterval(-GlanceBuilder.leaveWindow)...state.leaveAt, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .tint(.orange)
            Text(subtitle(attributes))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .foregroundStyle(.white)
    }
}
