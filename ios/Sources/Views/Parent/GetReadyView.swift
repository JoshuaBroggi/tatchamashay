import SwiftUI

/// **Get ready**: before leaving, check every treasure, sound and line the adventure needs opens on
/// this phone, and check the map, warning plainly that it may be blank without signal.
struct GetReadyView: View {
    let adventureID: Adventure.ID
    let onDone: () -> Void

    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @State private var report = ReadyReport(items: GetReady.items())

    var body: some View {
        List {
            Section {
                ReadyBanner(report: report, title: family.data.adventure(adventureID)?.title ?? "Your hunt")
                    .listRowInsets(EdgeInsets())
            }
            Section {
                ForEach(report.items) { item in ReadyRow(item: item) }
            } footer: {
                Text("Everything stays on this phone, so the hunt works without signal.")
            }
            Section {
                Button("Check again") { Task { await check() } }
                    .disabled(report.isChecking)
                    .accessibilityIdentifier("checkAgain")
                Button("Done", action: onDone)
                    .accessibilityIdentifier("getReadyDone")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Get ready")
        .navigationBarTitleDisplayMode(.inline)
        .task { await check() }
    }

    private func check() async {
        guard let adventure = family.data.adventure(adventureID) else { return }
        report = ReadyReport(items: GetReady.items())
        await GetReady.run(adventure: adventure, data: family.data, library: app.stories,
                           pirateName: family.child?.pirateName, grownUp: family.grownUpName,
                           loaders: BundledReadyLoaders(catalog: app.catalog)) { item in
            if let i = report.items.firstIndex(where: { $0.id == item.id }) { report.items[i] = item }
        }
    }
}

private struct ReadyBanner: View {
    let report: ReadyReport
    let title: String

    var body: some View {
        VStack(spacing: 8) {
            if report.isReady {
                Image(systemName: "checkmark.seal.fill").font(.system(size: 52)).foregroundStyle(Palette.ground1)
                Text("Ready!")
                    .font(Typeface.headline(44))
                    .foregroundStyle(Palette.ground1)
                    .accessibilityIdentifier("readyState")
                Text("\(title) is on this phone. Have a great hunt!")
                    .font(Typeface.body(15))
                    .foregroundStyle(Palette.ground1)
            } else if report.isChecking {
                ProgressView().tint(Palette.gold)
                Text("Checking…").font(Typeface.headline(28)).foregroundStyle(Palette.textPrimary)
            } else {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 44)).foregroundStyle(Palette.gold)
                Text("Not ready yet").font(Typeface.headline(28)).foregroundStyle(Palette.textPrimary)
                    .accessibilityIdentifier("notReady")
                Text("Fix the items below, then check again.")
                    .font(Typeface.body(14)).foregroundStyle(Palette.textSecondary)
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 16)
        .background(report.isReady ? Palette.gold : Palette.ground2)
    }
}

private struct ReadyRow: View {
    let item: ReadyItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            icon.frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title).font(Typeface.body(16, weight: .semibold))
                if let note { Text(note).font(Typeface.body(13)).foregroundStyle(Palette.textSecondary) }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("ready-\(item.id)")
    }

    @ViewBuilder private var icon: some View {
        switch item.status {
        case .checking: ProgressView()
        case .ok: Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.gold)
        case .warning: Image(systemName: "exclamationmark.circle.fill").foregroundStyle(Palette.parchmentMid)
        case .problem: Image(systemName: "xmark.octagon.fill").foregroundStyle(Palette.mapRed)
        }
    }

    private var note: String? {
        switch item.status {
        case .checking: "Checking…"
        case .ok: nil
        case .warning(let text), .problem(let text): text
        }
    }
}
