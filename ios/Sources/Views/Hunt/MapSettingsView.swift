import SwiftUI

struct MapSettingsView: View {
    @Environment(MapExperienceSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var settings = settings
        NavigationStack {
            Form {
                Section {
                    Toggle("Show 3D", isOn: $settings.enabled)
                        .accessibilityIdentifier("show3DMap")
                } footer: {
                    Text("Explore the streets as a character from My Chest. Turn this off to return to your usual treasure map.")
                }
                if settings.enabled {
                    Section {
                        Toggle("Use 2D map", isOn: $settings.useFlatMap)
                            .accessibilityIdentifier("flatCharacterMap")
                    } footer: {
                        Text("Keep your walking character on a flat map if 3D is slow or unavailable here. Map detail varies by location.")
                    }
                    Section {
                        Text("Open My Chest to choose a character you've found. Each new discovery becomes your character automatically while this mode is on.")
                    }
                }
            }
            .navigationTitle("Map settings")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .tint(Palette.gold)
    }
}
