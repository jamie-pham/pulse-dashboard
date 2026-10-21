// The app is a thin native shell around your Pulse dashboard. Its real job is the lock screen:
// every time it opens it refreshes the widgets and starts/updates the "leave by" Live Activity.

import SwiftUI
import WidgetKit

@main
struct PulseApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            if let url = PulseConfig.baseURL {
                DashboardWebView(url: url)
                    .ignoresSafeArea(edges: .bottom)
                    .background(Color(red: 0.05, green: 0.06, blue: 0.08))
            } else {
                SetupView()
            }
        }
        .task { await refresh() }
        .onChange(of: phase) { _, p in
            if p == .active { Task { await refresh() } }
        }
        // pulse://open — from tapping a widget, or the alarm Shortcut ("Open URLs: pulse://open").
        .onOpenURL { _ in Task { await refresh() } }
    }

    private func refresh() async {
        guard PulseConfig.isConfigured, let feed = await PulseClient.latest() else { return }
        WidgetCenter.shared.reloadAllTimelines()
        await LeaveActivityManager.sync(with: feed)
    }
}

struct SetupView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pulse isn't configured").font(.title2.bold())
            Text("Copy ios/Config.example.xcconfig to Config.xcconfig, fill in PULSE_HOST and PULSE_TOKEN, run xcodegen, and build again.")
                .foregroundStyle(.secondary)
        }
        .padding(24)
    }
}
