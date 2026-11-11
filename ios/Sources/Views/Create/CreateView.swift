import SwiftUI

/// The child's treasure maker, after the mockups' Invent Treasure screen without rarity: start a new
/// invention, or make a new version of an old one. Treasures already found keep the look they had.
struct CreateView: View {
    @Environment(FamilyModel.self) private var family

    @State private var inventing = false
    @State private var editing: TreasureDesign?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Overline(text: "Treasure maker", color: Palette.invented)
                    Text("Invent a treasure")
                        .font(Typeface.headline(36))
                        .foregroundStyle(Palette.textPrimary)
                    if let child = family.child {
                        Text("Created by \(child.pirateName)")
                            .font(Typeface.body(13))
                            .foregroundStyle(Palette.textSecondary)
                    }
                }

                Button {
                    inventing = true
                } label: {
                    Label("Make a treasure", systemImage: "sparkles")
                }
                .buttonStyle(GoldButtonStyle(height: 88, fontSize: 28))
                .accessibilityIdentifier("makeTreasure")
                .disabled(family.isDemo)

                if family.isDemo {
                    Text("Turn Demo mode off to make a real treasure.")
                        .font(Typeface.body(13))
                        .foregroundStyle(Palette.textMuted)
                }

                if !family.inventions.isEmpty {
                    Overline(text: "My inventions", color: Palette.invented)
                    ForEach(family.inventions) { design in
                        InventionRow(design: design, status: status(of: design)) { editing = design }
                    }
                }
            }
            .padding(16)
        }
        .background(Palette.ground1.ignoresSafeArea())
        .fullScreenCover(isPresented: $inventing) { InventFlowView() }
        .fullScreenCover(item: $editing) { InventFlowView(editing: $0) }
    }

    private func status(of design: TreasureDesign) -> InventionRow.Status {
        let placements = family.data.placements.filter { $0.designID == design.id }
        if placements.isEmpty { return .notHidden }
        let found = placements.contains { placement in family.data.collections.contains { $0.placementID == placement.id } }
        return found ? .found : .hidden
    }
}

private struct InventionRow: View {
    enum Status { case notHidden, hidden, found }

    let design: TreasureDesign
    let status: Status
    let onEdit: () -> Void

    var body: some View {
        let look = design.current.look
        HStack(spacing: 12) {
            Thumbnail(model: look.model)
                .frame(width: 64, height: 64)
                .background(Color(look.color).opacity(0.35))
                .overlay(Rectangle().stroke(Palette.invented, lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(look.name)
                    .font(Typeface.body(17, weight: .semibold))
                    .foregroundStyle(Palette.textPrimary)
                Text(statusText + (design.versions.count > 1 ? " · version \(design.current.number)" : ""))
                    .font(Typeface.body(12))
                    .foregroundStyle(Palette.textSecondary)
            }
            Spacer()
            Button(action: onEdit) {
                Image(systemName: "wand.and.stars").font(.title2)
                    .frame(width: 56, height: 56)
                    .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
            }
            .foregroundStyle(Palette.gold)
            .accessibilityLabel("Make a new version of \(look.name)")
            .accessibilityIdentifier("editInvention")
        }
        .padding(10)
        .background(Palette.ground2)
        .overlay(Rectangle().stroke(Palette.borderQuiet, lineWidth: 1))
    }

    private var statusText: String {
        switch status {
        case .notHidden: "Not hidden yet"
        case .hidden: "Hidden for your grown-up"
        case .found: "Found!"
        }
    }
}
