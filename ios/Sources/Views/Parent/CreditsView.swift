import SwiftUI

/// The bundled source records remain readable offline; source links open only when tapped.
struct CreditsView: View {
    var catalog: TreasureCatalog = .bundled

    var body: some View {
        List {
            ForEach(catalog.treasures.filter { $0.provenance != nil }) { entry in
                if let source = entry.provenance {
                    Section(entry.displayName) {
                        Text(source.title).font(.headline)
                        Text(source.creator)
                        Text(source.usage)
                        Text(source.changes)
                            .foregroundStyle(Palette.textSecondary)
                        Link("Model source", destination: source.source)
                            .frame(minHeight: 44)
                    }
                    .accessibilityIdentifier("credit-\(entry.id)")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
        .foregroundStyle(Palette.textPrimary)
        .navigationTitle("Treasure makers")
        .navigationBarTitleDisplayMode(.inline)
    }
}
