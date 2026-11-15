import SwiftUI

/// Credits stay readable offline. Only the grown-up's explicit link taps leave the app.
struct CreditsView: View {
    var catalog: TreasureCatalog = .bundled

    var body: some View {
        List {
            Section {
                Text("Thank you to the artists who helped fill our treasure chest.")
                    .foregroundStyle(Palette.textSecondary)
            }
            ForEach(catalog.creditedModels) { entry in
                if let credit = entry.attribution {
                    Section(entry.displayName) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(credit.title).font(.headline)
                            Text("By \(credit.author)")
                            Text(credit.changes)
                                .font(.subheadline)
                                .foregroundStyle(Palette.textSecondary)
                            creditLink("Artist: \(credit.author)", to: credit.authorURL)
                            creditLink("Original: \(credit.title)", to: credit.source)
                            creditLink("License: \(credit.license)", to: credit.licenseURL)
                        }
                        .padding(.vertical, 8)
                        .accessibilityIdentifier("credit-\(entry.id)")
                    }
                }
            }
            ForEach(catalog.sourcedModels) { entry in
                if let source = entry.provenance {
                    Section(entry.displayName) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(source.title).font(.headline)
                            Text(source.creator)
                            Text(source.changes)
                                .font(.subheadline)
                                .foregroundStyle(Palette.textSecondary)
                            creditLink("Model source", to: source.source)
                        }
                        .padding(.vertical, 8)
                        .accessibilityIdentifier("credit-\(entry.id)")
                    }
                }
            }
            Section("Lettering") {
                Text("Barlow Condensed — Copyright 2017 The Barlow Project Authors")
                creditLink("Barlow font project", to: URL(string: "https://github.com/jpt/barlow")!)
                NavigationLink("SIL Open Font License 1.1") {
                    ScrollView {
                        Text(fontLicense).font(.body).textSelection(.enabled).padding()
                    }
                    .navigationTitle("Font license")
                }
            }
            Section("Made for Tatchamashay") {
                Text("The original pirate chest, nine original treasures, and synthesized sounds were made for this game.")
                    .foregroundStyle(Palette.textSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
        .foregroundStyle(Palette.textPrimary)
        .tint(Palette.rune)
        .navigationTitle("Treasure makers")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func creditLink(_ title: String, to url: URL) -> some View {
        Link(destination: url) {
            Label(title, systemImage: "arrow.up.right.square")
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
        }
    }

    private var fontLicense: String {
        guard let url = Bundle.main.url(forResource: "BarlowCondensed-OFL", withExtension: "txt"),
              let text = try? String(contentsOf: url, encoding: .utf8) else {
            return "SIL Open Font License 1.1 — https://openfontlicense.org"
        }
        return text
    }
}
