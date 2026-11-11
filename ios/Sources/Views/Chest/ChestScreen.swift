import SwiftUI

/// The child's chest, after the mockups' Vault screen without rarity. Shows the saved copy of each
/// treasure as it looked when found, so later edits or deletes never change it.
struct ChestScreen: View {
    @Environment(FamilyModel.self) private var family

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Overline(text: "My Chest")
                        Text(family.chest.count == 1 ? "1 treasure" : "\(family.chest.count) treasures")
                            .font(Typeface.headline(40))
                        if let child = family.child {
                            Text("\(child.pirateName)'s treasures")
                                .font(Typeface.body(13))
                                .foregroundStyle(Palette.textSecondary)
                        }
                    }

                    if family.chest.isEmpty {
                        Text("Your chest is empty. Follow the X on the map to find your first treasure!")
                            .font(Typeface.body(15))
                            .foregroundStyle(Palette.textSecondary)
                            .padding(.top, 40)
                    } else {
                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(family.chest) { record in
                                NavigationLink(value: record) { ChestTile(record: record) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 20)
            }
            .foregroundStyle(Palette.textPrimary)
            .background(Palette.ground1.ignoresSafeArea())
            .navigationDestination(for: CollectionRecord.self) { ChestDetailView(record: $0) }
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

struct ChestTile: View {
    let record: CollectionRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ZStack {
                RadialGradient(colors: [Color(record.savedCopy.color).opacity(0.6), .clear],
                               center: .center, startRadius: 0, endRadius: 45)
                Image(systemName: record.savedCopy.model.symbol)
                    .font(.system(size: 32))
                    .foregroundStyle(Color(record.savedCopy.color))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text(record.savedCopy.name)
                .font(Typeface.body(11, weight: .semibold))
                .lineLimit(2)
            if record.foundAgainCount > 0 {
                Label("×\(record.foundAgainCount + 1)", systemImage: "star.fill")
                    .font(Typeface.body(10))
                    .foregroundStyle(Palette.rune)
            }
        }
        .padding(8)
        .frame(height: 118)
        .background(Palette.ground2)
        .overlay(Rectangle().stroke(Palette.borderQuiet, lineWidth: 1))
    }
}

struct ChestDetailView: View {
    let record: CollectionRecord

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                TreasureModelView(look: record.savedCopy)
                    .frame(height: 320)
                    .background(Palette.ground0)
                    .overlay(Rectangle().stroke(Palette.borderQuiet, lineWidth: 1))
                Text(record.savedCopy.name)
                    .font(Typeface.headline(36))
                    .textCase(.uppercase)
                if !record.savedCopy.story.isEmpty {
                    Text(record.savedCopy.story)
                        .font(Typeface.body(16))
                        .foregroundStyle(Palette.textSecondary)
                }
                Text("Found \(record.foundAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(Typeface.body(13))
                    .foregroundStyle(Palette.textMuted)
                if record.foundAgainCount > 0 {
                    Label("Found again \(record.foundAgainCount) more \(record.foundAgainCount == 1 ? "time" : "times")",
                          systemImage: "star.circle.fill")
                        .font(Typeface.label(13))
                        .foregroundStyle(Palette.rune)
                }
                Text("Drag to turn it around")
                    .font(Typeface.body(12))
                    .foregroundStyle(Palette.textMuted)
            }
            .multilineTextAlignment(.center)
            .padding(16)
        }
        .foregroundStyle(Palette.textPrimary)
        .background(Palette.ground1.ignoresSafeArea())
    }
}
