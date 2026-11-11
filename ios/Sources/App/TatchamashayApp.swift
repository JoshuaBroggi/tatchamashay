import SwiftUI

@main
struct TatchamashayApp: App {
    @State private var store = TreasureStore()
    @State private var location = LocationService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(location)
                .onAppear { location.start() }
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            Tab("Map", systemImage: "map.fill") { MapScreen() }
            Tab("Chest", systemImage: "shippingbox.fill") { ChestScreen() }
            Tab("Hide", systemImage: "plus.circle.fill") { CreateTreasureScreen() }
        }
        .tint(Palette.ink)
    }
}
